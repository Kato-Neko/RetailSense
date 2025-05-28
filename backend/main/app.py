"""
app.py
Flask entry point for the backend, using refactored modules.
"""

import os
import uuid
import threading
import logging
from flask import Flask, request, jsonify, session, send_from_directory, Response, send_file
from flask_cors import CORS, cross_origin
from werkzeug.utils import secure_filename
import datetime
import cv2
from flask_jwt_extended import JWTManager
import shutil
import json
from supabase import create_client, Client
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from dotenv import load_dotenv
import csv
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import Image, Paragraph, Spacer, SimpleDocTemplate
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import numpy as np
from io import BytesIO
import pytz
from dateutil import parser

# Import from backend files
from job_manager import get_db_connection
from video_processing import validate_video_file
from heatmap_maker import blend_heatmap, analyze_heatmap
from utils import hash_password, verify_password
from object_tracking import detect_and_track
from auth import auth_bp 

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = b'supersecretkey'  # Replace with a secure key in production
app.config['JWT_SECRET_KEY'] = 'superjwtsecretkey'  # Change this in production
jwt = JWTManager(app)

# Configure CORS properly
CORS(app, resources={r"/api/*": {"origins": "*"}})

UPLOAD_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../project_uploads'))
RESULTS_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../project_results'))
ALLOWED_EXTENSIONS_VIDEO = {'mp4', 'avi', 'mov'}
ALLOWED_EXTENSIONS_IMAGE = {'png', 'jpg', 'jpeg'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

jobs = {}

# Initialize Supabase client using environment variables
url = os.getenv("SUPABASE_URL")  # Get Supabase URL from environment variable
key = os.getenv("SUPABASE_KEY")   # Get Supabase key from environment variable
supabase: Client = create_client(url, key)

# Register the authentication blueprint
app.register_blueprint(auth_bp)

custom_heatmap_progress = {}

# Use this helper to convert datetimes to Asia/Manila
manila = pytz.timezone('Asia/Manila')
def to_manila_iso(dt):
    if not dt:
        return ''
    if isinstance(dt, str):
        dt = parser.parse(dt)
    if dt.tzinfo is None:
        # Assume naive datetimes are already in Asia/Manila
        dt = manila.localize(dt)
    return dt.isoformat()

def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def update_job_status_in_db(job_id, job):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        UPDATE jobs 
        SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP
        WHERE job_id = %s
    ''', (job['status'], job['message'], job_id))
    cur.close()
    conn.commit()
    conn.close()

# Helper to upload a file to Supabase Storage and remove local copy

def upload_to_supabase_and_remove_local(local_path, supabase_path, content_type):
    try:
        bucket = "projectresults"
        with open(local_path, "rb") as f:
            supabase.storage.from_(bucket).upload(supabase_path, f, {"content-type": content_type})
        os.remove(local_path)
        logger.info(f"Uploaded and removed local: {local_path} -> {bucket}/{supabase_path}")
    except Exception as e:
        logger.error(f"Failed to upload {local_path} to Supabase: {e}")
        raise

def upload_json_to_supabase(data, supabase_path):
    bucket = "projectresults"
    json_bytes = json.dumps(data).encode("utf-8")
    supabase.storage.from_(bucket).upload(
        supabase_path,
        json_bytes,  # Pass raw bytes, not BytesIO
        {"content-type": "application/json"}
    )
    logger.info(f"Uploaded JSON to Supabase: {bucket}/{supabase_path}")

def upload_image_to_supabase(image_np, supabase_path):
    bucket = "projectresults"
    success, img_encoded = cv2.imencode('.jpg', image_np)
    if not success:
        raise Exception("Failed to encode image to JPEG")
    img_bytes = img_encoded.tobytes()
    supabase.storage.from_(bucket).upload(
        supabase_path,
        img_bytes,  # Pass raw bytes, not BytesIO
        {"content-type": "image/jpg"}  # Use image/jpg instead of image/jpeg
    )
    logger.info(f"Uploaded image to Supabase: {bucket}/{supabase_path}")

def process_video_job(job_id):
    """
    Process a video job in the background (restore backend detection).
    Supports cancellation: if the job's 'cancelled' flag is set (by the cancel endpoint),
    the object tracking loop will stop early and the job will be marked as cancelled.
    """
    try:
        job = jobs[job_id]
        job['status'] = 'processing'
        job['message'] = 'Starting video processing...'
        job['cancelled'] = job.get('cancelled', False)

        # Validate video file
        video_path = job['input_files']['video']
        floorplan_path = job['input_files']['floorplan']
        points_path = job['input_files']['points']
        with open(points_path, 'r') as f:
            points_data = json.load(f)
        cap = validate_video_file(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.release()

        # Check for cancellation before starting detection
        if job.get('cancelled'):
            job['status'] = 'cancelled'
            job['message'] = 'Job was cancelled by user.'
            update_job_status_in_db(job_id, job)
            return

        # Update status for YOLO detection
        job['message'] = 'Running YOLO detection (0%)'
        output_video_path, detections, fps = detect_and_track(
            video_path,
            job['output_files_expected']['video'],
            progress_callback=lambda p: update_job_progress(job_id, 'YOLO detection', p),
            preview_folder=job['output_files_expected']['image'] and os.path.dirname(job['output_files_expected']['image']),
            cancelled_flag=lambda: job.get('cancelled', False)
        )

        # Check for cancellation after detection
        if job.get('cancelled'):
            job['status'] = 'cancelled'
            job['message'] = 'Job was cancelled by user.'
            update_job_status_in_db(job_id, job)
            return

        # Save detections and fps to Supabase (no local file)
        detections_data = {"fps": fps, "detections": detections}
        upload_json_to_supabase(
            detections_data,
            f"{job_id}/detections.json"
        )

        # For testing: use static points from Points/floorplan_points.txt
        points = [[768, 204], [690, 200], [655, 305], [793, 309]]

        # Check for cancellation before heatmap generation
        if job.get('cancelled'):
            job['status'] = 'cancelled'
            job['message'] = 'Job was cancelled by user.'
            update_job_status_in_db(job_id, job)
            return

        # Now, generate the blended heatmap using blend_heatmap with real detections and points
        output_heatmap_image_path = job['output_files_expected']['image']
        # Instead of saving to disk, get the blended image from blend_heatmap
        blended_img = blend_heatmap(
            detections,
            floorplan_path,
            None,  # Don't save to disk
            output_video_path,
            video_path,
            return_image=True
        )
        # Upload main heatmap JPG to Supabase (no local file)
        upload_image_to_supabase(
            blended_img,
            f"{job_id}/video_heatmap.jpg"
        )

        # Check for cancellation after heatmap generation
        if job.get('cancelled'):
            job['status'] = 'cancelled'
            job['message'] = 'Job was cancelled by user.'
            update_job_status_in_db(job_id, job)
            return

        # Update status for heatmap generation
        job['message'] = 'Processing completed successfully'
        job['status'] = 'completed'
        job['message'] = 'Processing completed successfully'
        # Update database
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            UPDATE jobs 
            SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP, output_heatmap_path = %s
            WHERE job_id = %s
        ''', (job['status'], job['message'], output_heatmap_image_path, job_id))
        cur.close()
        conn.commit()
        conn.close()

    except Exception as e:
        if hasattr(job, 'cancelled') and job['cancelled']:
            job['status'] = 'cancelled'
            job['message'] = 'Job was cancelled by user.'
            update_job_status_in_db(job_id, job)
        else:
            job['status'] = 'error'
            job['message'] = f'Error during processing: {str(e)}'
        logger.error(f"Error processing job {job_id}: {str(e)}", exc_info=True)
        # Update database with error
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            UPDATE jobs 
            SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP
            WHERE job_id = %s
        ''', (job['status'], job['message'], job_id))
        cur.close()
        conn.commit()
        conn.close()

def update_job_progress(job_id, stage, progress):
    """Update job progress in both memory and database."""
    job = jobs[job_id]
    job['message'] = f'{stage} ({int(progress * 100)}%)'
    
    # Update database
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        UPDATE jobs 
        SET message = %s, updated_at = CURRENT_TIMESTAMP
        WHERE job_id = %s
    ''', (job['message'], job_id))
    cur.close()
    conn.commit()
    conn.close()

def get_video_duration(video_path):
    cap = cv2.VideoCapture(video_path)
    duration = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS))
    cap.release()
    return duration  # Duration in seconds

@app.route('/api/heatmap_jobs', methods=['POST'])
@jwt_required()
def create_heatmap_job():
    try:
        logger.debug("Received job creation request")
        logger.debug(f"Files in request: {request.files}")
        logger.debug(f"Form data: {request.form}")

        # Check if we are reusing a file
        reuse_file = request.form.get('reuseFile', 'false').lower() == 'true'
        video_filename = None
        input_video_path = None
        if reuse_file:
            # Get the filename to reuse
            video_filename = request.form.get('videoFilename')
            current_user = get_jwt_identity()
            # Find the most recent job for this user with this video file
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute('''SELECT job_id FROM jobs WHERE "user" = %s AND input_video_name = %s ORDER BY created_at DESC LIMIT 1''', (current_user, video_filename))
            job_row = cur.fetchone()
            cur.close()
            conn.close()
            if not job_row:
                logger.error("No previous upload found to reuse.")
                return jsonify({"error": "No previous upload found to reuse."}), 400
            # Use the previous upload path
            prev_job_id = job_row['job_id']
            prev_upload_folder = os.path.join(UPLOAD_FOLDER, prev_job_id)
            prev_video_path = os.path.join(prev_upload_folder, video_filename)
            if not os.path.exists(prev_video_path):
                logger.error("Previous video file not found on server.")
                return jsonify({"error": "Previous video file not found on server."}), 400
            # Copy the file to the new job's upload folder
            job_id = str(uuid.uuid4())
            job_upload_folder = os.path.join(UPLOAD_FOLDER, job_id)
            os.makedirs(job_upload_folder, exist_ok=True)
            input_video_path = os.path.join(job_upload_folder, video_filename)
            shutil.copy(prev_video_path, input_video_path)
        else:
            if 'videoFile' not in request.files:
                logger.error("Missing required video file")
                return jsonify({"error": "Missing videoFile"}), 400
            video_file = request.files['videoFile']
            video_filename = secure_filename(video_file.filename)
            job_id = str(uuid.uuid4())
            job_upload_folder = os.path.join(UPLOAD_FOLDER, job_id)
            os.makedirs(job_upload_folder, exist_ok=True)
            input_video_path = os.path.join(job_upload_folder, video_filename)
            video_file.save(input_video_path)
        
        points_data_str = request.form.get('pointsData')
        if not points_data_str:
            logger.error("Missing points data")
            return jsonify({"error": "Missing pointsData"}), 400
        try:
            points_data = json.loads(points_data_str)
            if not (isinstance(points_data, list) and len(points_data) == 4):
                raise ValueError("pointsData must be a list of 4 points")
        except Exception as e:
            logger.error(f"Invalid pointsData: {e}")
            return jsonify({"error": f"Invalid pointsData: {e}"}), 400

        logger.debug(f"Video file: {video_filename}")
        if not (video_filename and allowed_file(video_filename, ALLOWED_EXTENSIONS_VIDEO)):
            logger.error("Invalid video file type")
            return jsonify({"error": "Invalid video file type"}), 400

        job_results_folder = os.path.join(RESULTS_FOLDER, job_id)
        os.makedirs(job_results_folder, exist_ok=True)

        # Extract first frame as floorplan
        cap = cv2.VideoCapture(input_video_path)
        ret, frame = cap.read()
        cap.release()
        if not ret:
            logger.error("Failed to extract first frame from video")
            return jsonify({"error": "Failed to extract first frame from video"}), 500
        floorplan_filename = f"floorplan_{job_id}.jpg"
        input_floorplan_path = os.path.join(job_upload_folder, floorplan_filename)
        cv2.imwrite(input_floorplan_path, frame)

        output_heatmap_image_path = os.path.join(job_results_folder, f"video_{job_id}_heatmap.jpg")
        output_processed_video_path = os.path.join(job_results_folder, f"video_{job_id}.mp4")

        # Get date and time from the request
        start_date = request.form.get('start_date')
        end_date = request.form.get('end_date')
        start_time = request.form.get('start_time')
        end_time = request.form.get('end_time')

        # Validate date and time inputs
        if not (start_date and end_date and start_time and end_time):
            return jsonify({"error": "Missing date or time inputs"}), 400

        # Combine date and time into datetime objects
        start_datetime = datetime.datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %H:%M:%S")
        end_datetime = datetime.datetime.strptime(f"{end_date} {end_time}", "%Y-%m-%d %H:%M:%S")

        # Validate that the time range does not exceed the video duration
        video_duration = get_video_duration(input_video_path)
        print("start_date:", start_date, "start_time:", start_time)
        print("end_date:", end_date, "end_time:", end_time)
        print("start_datetime:", start_datetime)
        print("end_datetime:", end_datetime)
        print("video_duration (seconds):", video_duration)
        print("time range (seconds):", (end_datetime - start_datetime).total_seconds())
        if (end_datetime - start_datetime).total_seconds() > video_duration:
            return jsonify({"error": "Time range exceeds video duration"}), 400
        if (end_datetime - start_datetime).total_seconds() <= 0:
            return jsonify({"error": "Time range must be greater than zero."}), 400

        # Save points data (works for both new upload and reuse)
        points_filename = f"points_{job_id}.json"
        input_points_path = os.path.join(job_upload_folder, points_filename)
        with open(input_points_path, 'w') as f:
            json.dump(points_data, f)

        # Store the date and time in the job entry
        jobs[job_id] = {
            'status': 'pending',
            'message': 'Job submitted, awaiting processing.',
            'input_files': {
                'video': input_video_path,
                'floorplan': input_floorplan_path,
                'points': input_points_path
            },
            'output_files_expected': {
                'image': output_heatmap_image_path,
                'video': output_processed_video_path
            },
            'time_range': {
                'start': start_datetime,
                'end': end_datetime
            }
        }

        # Get current user from JWT
        current_user = get_jwt_identity()
        logger.debug(f"Current user: {current_user}")

        # Create database entry
        conn = get_db_connection()
        try:
            logger.debug("Creating database entry")
            cur = conn.cursor()
            cur.execute('''
                INSERT INTO jobs (job_id, "user", input_video_name, input_floorplan_name, status, message, start_datetime, end_datetime)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)''',
                (job_id, current_user, video_filename, floorplan_filename, 'pending', 'Job submitted, awaiting processing.', start_datetime, end_datetime))
            conn.commit()
            logger.info(f"Inserted job into Supabase: {job_id}")
            # Fetch the inserted row for debug
            cur.execute('SELECT * FROM jobs WHERE job_id = %s', (job_id,))
            inserted_row = cur.fetchone()
            logger.info(f"Inserted row: {inserted_row}")
            cur.close()
            logger.debug("Database entry created successfully")
        except Exception as db_error:
            logger.error(f"Database error: {str(db_error)}")
            raise
        finally:
            conn.close()

        # Start processing in background thread
        processing_thread = threading.Thread(target=process_video_job, args=(job_id,))
        processing_thread.daemon = True
        processing_thread.start()

        return jsonify({"job_id": job_id, "status": "pending", "message": "Job submitted for processing.", "inserted_row": str(inserted_row)}), 202
    except Exception as e:
        logger.error(f"Error in create_heatmap_job: {str(e)}", exc_info=True)
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/heatmap_jobs/<job_id>/status', methods=['GET'])
def get_job_status(job_id):
    job = jobs.get(job_id)
    if job:
        return jsonify({"job_id": job_id, "status": job['status'], "message": job.get('message', '')})
    else:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT job_id, status, message FROM jobs WHERE job_id = %s", (job_id,))
        db_job = cur.fetchone()
        cur.close()
        conn.close()
        if db_job:
            return jsonify({"job_id": db_job['job_id'], "status": db_job['status'], "message": db_job['message']})
        else:
            return jsonify({"error": "Job not found or not authorized"}), 404

@app.route('/api/heatmap_jobs/<job_id>/result/image', methods=['GET'])
def get_heatmap_image(job_id):
    # Always fetch from Supabase
    supabase_path = f"{job_id}/video_heatmap.jpg"
    img_bytes = download_image_bytes_from_supabase(supabase_path)
    if img_bytes is None:
        return jsonify({"error": "Result image file not found in Supabase"}), 404
    return Response(img_bytes, mimetype="image/jpeg")

@app.route('/api/heatmap_jobs/<job_id>/result/video', methods=['GET'])
def get_processed_video(job_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
    job_row = cur.fetchone()
    cur.close()
    conn.close()
    if not job_row or job_row['status'] != 'completed':
        return jsonify({"error": "Job not found or not completed"}), 404

    output_video_path = job_row['output_video_path'] if 'output_video_path' in job_row.keys() else None
    if not output_video_path or not os.path.exists(output_video_path):
        return jsonify({"error": "Result video file not found on server"}), 404
    return send_from_directory(os.path.dirname(output_video_path), os.path.basename(output_video_path), as_attachment=True)

@app.route('/api/heatmap_jobs/history', methods=['GET'])
@jwt_required()
def get_job_history():
    current_user = get_jwt_identity()
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        SELECT job_id,
               input_video_name,
               input_floorplan_name,
               status,
               message,
               start_datetime,
               end_datetime,
               created_at,
               updated_at
        FROM jobs WHERE "user" = %s ORDER BY created_at DESC
    ''', (current_user,))
    rows = cur.fetchall()
    history_jobs = [
        {
            "job_id": row[0],
            "input_video_name": row[1],
            "input_floorplan_name": row[2],
            "status": row[3],
            "message": row[4],
            "start_datetime": to_manila_iso(row[5]),
            "end_datetime": to_manila_iso(row[6]),
            "created_at": to_manila_iso(row[7]),
            "updated_at": to_manila_iso(row[8]),
        }
        for row in rows
    ]
    cur.close()
    conn.close()
    return jsonify(history_jobs)

@app.route('/api/heatmap_jobs/<job_id>', methods=['DELETE'])
@jwt_required()
def delete_heatmap_job(job_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
        job_row = cur.fetchone()
        if not job_row:
            cur.close()
            conn.close()
            return jsonify({"error": "Job not found"}), 404
        # Remove from DB
        cur.execute("DELETE FROM jobs WHERE job_id = %s", (job_id,))
        cur.close()
        conn.commit()
        conn.close()
        # Remove files (results and uploads)
        results_folder = os.path.join(RESULTS_FOLDER, job_id)
        uploads_folder = os.path.join(UPLOAD_FOLDER, job_id)
        for folder in [results_folder, uploads_folder]:
            if os.path.exists(folder):
                shutil.rmtree(folder)
        # Delete all files in the job's folder from Supabase Storage
        bucket = "projectresults"
        try:
            files = supabase.storage.from_(bucket).list(path=job_id)
            if files and isinstance(files, list):
                for file in files:
                    file_path = f"{job_id}/{file['name']}"
                    supabase.storage.from_(bucket).remove(file_path)
            logger.info(f"Deleted files in Supabase bucket for job {job_id}")
        except Exception as e:
            logger.error(f"Error deleting files from Supabase bucket for job {job_id}: {e}")
        return jsonify({"success": True, "message": "Heatmap job deleted."})
    except Exception as e:
        logger.error(f"Error deleting job {job_id}: {str(e)}", exc_info=True)
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/heatmap_jobs/<job_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_heatmap_job(job_id):
    current_user = get_jwt_identity()
    logger.info(f"User {current_user} requested cancellation for job {job_id}")
    # Set the cancelled flag in memory if the job is running
    job = jobs.get(job_id)
    if job:
        job['cancelled'] = True  # This flag is now checked in the object tracking loop
        logger.info(f"Job {job_id} found in memory, marked as cancelled.")
        # Also update status in DB immediately
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE jobs SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP WHERE job_id = %s", ('cancelled', 'Job was cancelled by user.', job_id))
        cur.close()
        conn.commit()
        conn.close()
        logger.info(f"Job {job_id} status updated to 'cancelled' in DB (in-memory case).")
        return jsonify({"success": True, "message": "Job cancelled."})
    # If not in memory, try to cancel in the database
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
    job_row = cur.fetchone()
    if not job_row:
        cur.close()
        conn.close()
        logger.error(f"Cancel failed: Job {job_id} not found in DB.")
        return jsonify({"error": "Job not found"}), 404
    if job_row['status'] in ('completed', 'cancelled', 'error'):
        cur.close()
        conn.close()
        logger.info(f"Job {job_id} already finished with status {job_row['status']}.")
        return jsonify({"success": True, "message": f"Job already {job_row['status']}."})
    # Update status in DB
    cur.execute("UPDATE jobs SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP WHERE job_id = %s", ('cancelled', 'Job was cancelled by user.', job_id))
    cur.close()
    conn.commit()
    conn.close()
    logger.info(f"Job {job_id} status updated to 'cancelled' in DB (DB-only case).")
    return jsonify({"success": True, "message": "Job cancelled in DB."})

@app.route('/api/heatmap_jobs/<job_id>/preview/detections', methods=['GET'])
def get_detection_preview(job_id):
    job_folder = os.path.join(RESULTS_FOLDER, job_id)
    preview_path = os.path.join(job_folder, 'preview_detections.jpg')
    if not os.path.exists(preview_path):
        return jsonify({"error": "No detection preview available yet."}), 404
    return send_from_directory(job_folder, 'preview_detections.jpg')

@app.route('/api/heatmap_jobs/<job_id>/preview/heatmap', methods=['GET'])
def get_heatmap_preview(job_id):
    job_folder = os.path.join(RESULTS_FOLDER, job_id)
    preview_path = os.path.join(job_folder, 'preview_heatmap.jpg')
    if not os.path.exists(preview_path):
        return jsonify({"error": "No heatmap preview available yet."}), 404
    return send_from_directory(job_folder, 'preview_heatmap.jpg')

@app.route('/api/heatmap_jobs/<job_id>/detections', methods=['POST'])
def receive_live_detections(job_id):
    if job_id not in jobs:
        return jsonify({'error': 'Job not found'}), 404
    try:
        data = request.get_json()
        detections = data.get('detections', [])
        if 'live_detections' not in jobs[job_id]:
            jobs[job_id]['live_detections'] = []
        jobs[job_id]['live_detections'].extend(detections)
        # Optionally, trigger heatmap update here
        return jsonify({'success': True, 'count': len(detections)})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# Helper function to load detections and fps from Supabase
def load_detections(job_id):
    supabase_path = f"{job_id}/detections.json"
    det_data = download_json_from_supabase(supabase_path)
    if det_data is None:
        logger.error(f"Detections file not found for job ID: {job_id} in Supabase")
        return None, None
    detections = det_data.get("detections", [])
    fps = det_data.get("fps")
    return detections, fps

@app.route('/api/heatmap_jobs/<job_id>/detections', methods=['GET'])
@jwt_required()
def get_detections_from_json(job_id):
    detections, fps = load_detections(job_id)
    if detections is None:
        return jsonify({"error": "Detections file not found"}), 404
    return jsonify({"detections": detections, "fps": fps}), 200

@app.route('/api/heatmap_jobs/<job_id>/export/csv', methods=['GET'])
@jwt_required()
def export_heatmap_csv(job_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
        job_row = cur.fetchone()
        cur.close()
        conn.close()
        
        if not job_row:
            logger.error(f"Job {job_id} not found in database")
            return jsonify({"error": "Job not found"}), 404
            
        if job_row[6] != 'completed':  # status
            logger.error(f"Job {job_id} status is {job_row[6]}, not completed")
            return jsonify({"error": "Job not completed"}), 404

        # Get date and time range from query parameters
        start_datetime = request.args.get('start_datetime', '')
        end_datetime = request.args.get('end_datetime', '')
        area = request.args.get('area', 'all')
        start_time = request.args.get('start_time', type=float)
        end_time = request.args.get('end_time', type=float)

        detections, fps = load_detections(job_id)
        if detections is None:
            logger.error(f"Detections file not found for job {job_id}")
            return jsonify({"error": "Detections file not found"}), 404
        
        if not detections:
            logger.warning(f"No detections found in detections.json for job {job_id}")
            return jsonify({"error": "No detections data available"}), 404

        # --- Load analysis data ---
        if start_time is not None and end_time is not None:
            # Use custom heatmap from Supabase
            supabase_path = f"{job_id}/custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}.jpg"
        else:
            supabase_path = f"{job_id}/video_heatmap.jpg"
        heatmap_color = download_image_from_supabase(supabase_path)
        if heatmap_color is None:
            logger.error(f"Heatmap not found in Supabase: {supabase_path}")
            return jsonify({"error": "Heatmap not found in Supabase"}), 404
        # Convert to grayscale for analysis only
        heatmap = heatmap_color
        if len(heatmap.shape) == 3:
            heatmap_gray = cv2.cvtColor(heatmap, cv2.COLOR_BGR2GRAY)
        else:
            heatmap_gray = heatmap

        analysis = analyze_heatmap(heatmap_gray, (1080, 1920), detections=detections, fps=fps)

        output = io.StringIO()
        writer = csv.writer(output)

        # Write date and time range information
        writer.writerow(['Heatmap Analysis Report'])
        writer.writerow([])
        writer.writerow(['Date and Time Range'])
        writer.writerow(['Start:', start_datetime if start_datetime else 'Full video duration'])
        writer.writerow(['End:', end_datetime if end_datetime else 'Full video duration'])
        writer.writerow(['Area:', area])
        writer.writerow([])

        # Write analysis summary
        writer.writerow(['Traffic Distribution'])
        writer.writerow(['High Traffic (%)', 'Medium Traffic (%)', 'Low Traffic (%)'])
        writer.writerow([
            analysis['areas']['high']['percentage'],
            analysis['areas']['medium']['percentage'],
            analysis['areas']['low']['percentage']
        ])
        writer.writerow([])
        writer.writerow(['Recommendations'])
        for rec in analysis['recommendations']:
            writer.writerow([rec])
        if not analysis['recommendations']:
            writer.writerow(['No recommendations available.'])
        writer.writerow([])
        writer.writerow(['Peak Hours'])
        if analysis['peak_hours']:
            writer.writerow(['Start Minute', 'End Minute', 'Detections'])
            for ph in analysis['peak_hours']:
                writer.writerow([ph['start_minute'], ph['end_minute'], ph['count']])
        else:
            writer.writerow(['No peak hours detected.'])
        writer.writerow([])

        # Write detections data
        writer.writerow(['Detections'])
        writer.writerow(['Frame', 'Track ID', 'X1', 'Y1', 'X2', 'Y2', 'Timestamp'])
        for det in detections:
            writer.writerow([
                det['frame'],
                det['track_id'],
                det['bbox'][0],
                det['bbox'][1],
                det['bbox'][2],
                det['bbox'][3],
                det.get('timestamp', 'N/A')
            ])
        output.seek(0)
        
        logger.info(f"Successfully generated CSV export for job {job_id}")
        return Response(
            output,
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename=heatmap_{job_id}.csv'}
        )
    except Exception as e:
        logger.error(f"Error exporting CSV for job {job_id}: {str(e)}", exc_info=True)
        return jsonify({"error": f"Error generating CSV export: {str(e)}"}), 500

@app.route('/api/heatmap_jobs/<job_id>/export/pdf', methods=['GET'])
def export_heatmap_pdf(job_id):
    try:
        # Get query parameters
        start_datetime = request.args.get('start_datetime', 'Full video duration')
        end_datetime = request.args.get('end_datetime', 'Full video duration')
        area = request.args.get('area', 'all')
        start_time = request.args.get('start_time', type=float)
        end_time = request.args.get('end_time', type=float)

        # Get job data from database
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
        job_row = cur.fetchone()
        cur.close()
        conn.close()
        
        if not job_row:
            return jsonify({'error': 'Job not found'}), 404
            
        if job_row[6] != 'completed':  # status
            return jsonify({'error': 'Job not completed'}), 404

        # Load detections
        detections, fps = load_detections(job_id)
        if detections is None:
            return jsonify({'error': 'Detections file not found'}), 404

        # Filter detections by time range if specified
        if start_time is not None and end_time is not None:
            detections = [
                det for det in detections
                if 'timestamp' in det and start_time <= det['timestamp'] <= end_time
            ]

        # Get analysis data
        if start_time is not None and end_time is not None:
            supabase_path = f"{job_id}/custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}.jpg"
        else:
            supabase_path = f"{job_id}/video_heatmap.jpg"
        heatmap_color = download_image_from_supabase(supabase_path)
        if heatmap_color is None:
            return jsonify({'error': 'Heatmap not found in Supabase'}), 404
        # Convert to grayscale for analysis only
        heatmap = heatmap_color
        if len(heatmap.shape) == 3:
            heatmap_gray = cv2.cvtColor(heatmap, cv2.COLOR_BGR2GRAY)
        else:
            heatmap_gray = heatmap

        analysis = analyze_heatmap(heatmap_gray, (1080, 1920), detections=detections, fps=fps)
        if not analysis:
            return jsonify({'error': 'Analysis not found'}), 404

        # Create PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []

        # Add title
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30
        )
        elements.append(Paragraph(f"Heatmap Analysis Report - {job_row[2]}", title_style))  # input_video_name

        # Add date and time range
        date_style = ParagraphStyle(
            'DateStyle',
            parent=styles['Normal'],
            fontSize=12,
            spaceAfter=20
        )
        elements.append(Paragraph(f"Date and Time Range:", date_style))
        elements.append(Paragraph(f"Start: {start_datetime}", date_style))
        elements.append(Paragraph(f"End: {end_datetime}", date_style))
        elements.append(Paragraph(f"Area: {area}", date_style))
        elements.append(Spacer(1, 20))

        # Add heatmap image (always color)
        _, img_encoded = cv2.imencode('.jpg', heatmap_color)
        img_bytes = img_encoded.tobytes()
        img_buffer = io.BytesIO(img_bytes)
        img = Image(img_buffer, width=400, height=300)
        elements.append(img)

        elements.append(Spacer(1, 20))

        # Add analysis data
        elements.append(Paragraph("Analysis Results:", styles['Heading2']))
        elements.append(Paragraph(f"Total Visitors: {analysis['total_visitors']}", styles['Normal']))
        elements.append(Spacer(1, 10))

        # Add traffic distribution
        elements.append(Paragraph("Traffic Distribution:", styles['Heading3']))
        elements.append(Paragraph(f"High Traffic Areas: {analysis['areas']['high']['percentage']}%", styles['Normal']))
        elements.append(Paragraph(f"Medium Traffic Areas: {analysis['areas']['medium']['percentage']}%", styles['Normal']))
        elements.append(Paragraph(f"Low Traffic Areas: {analysis['areas']['low']['percentage']}%", styles['Normal']))
        elements.append(Spacer(1, 10))

        # Add recommendations
        elements.append(Paragraph("Recommendations:", styles['Heading3']))
        for rec in analysis['recommendations']:
            elements.append(Paragraph(f"• {rec}", styles['Normal']))
        elements.append(Spacer(1, 10))

        # Add peak hours
        elements.append(Paragraph("Peak Hours:", styles['Heading3']))
        for ph in analysis['peak_hours']:
            elements.append(Paragraph(
                f"• {ph['start_minute']}-{ph['end_minute']} minutes: {ph['count']} detections",
                styles['Normal']
            ))

        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'heatmap_{job_id}_report.pdf'
        )

    except Exception as e:
        logger.error(f"Error generating PDF: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/heatmap_jobs/<job_id>/analysis', methods=['GET'])
@jwt_required()
def get_heatmap_analysis(job_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
    job_row = cur.fetchone()
    cur.close()
    conn.close()

    if not job_row:
        logger.error(f"Job {job_id} not found in database")
        return jsonify({"error": "Job not found"}), 404

    if job_row[6] != 'completed':  # status is 7th column (index 6)
        logger.error(f"Job {job_id} status is {job_row[6]}, not completed")
        return jsonify({"error": "Job not completed"}), 404

    # Get the heatmap path from the job row
    heatmap_path = job_row[4]  # output_heatmap_path is 5th column (index 4)

    supabase_path = f"{job_id}/video_heatmap.jpg"
    img = download_image_from_supabase(supabase_path)
    if img is None:
        return jsonify({"error": "Heatmap file not found in Supabase"}), 404

    # Convert to grayscale if needed
    if len(img.shape) == 3:
        img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        img_gray = img

    floorplan_filename = job_row[3]  # input_floorplan_name is 4th col (index 3)
    floorplan_path = os.path.join(UPLOAD_FOLDER, job_id, floorplan_filename)
    floorplan = cv2.imread(floorplan_path)
    if floorplan is None:
        return jsonify({"error": "Could not load floorplan"}), 500

    detections, fps = load_detections(job_id)
    analysis = analyze_heatmap(img_gray, floorplan.shape[:2], detections=detections, fps=fps)
    return jsonify(analysis)

# Helper function to run custom heatmap generation in a thread

def run_custom_heatmap_job(job_id, start_time, end_time):
    try:
        # Fetch job info from DB
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
        job_row = cur.fetchone()
        cur.close()
        conn.close()
        if not job_row or job_row[6] != 'completed':  # status is 7th col (index 6)
            custom_heatmap_progress[job_id] = 1.0
            return

        # Load detections from Supabase
        det_data = download_json_from_supabase(f"{job_id}/detections.json")
        if det_data is None:
            custom_heatmap_progress[job_id] = 1.0
            return
        detections = det_data.get("detections", [])
        fps = det_data.get("fps")

        # Filter detections by time range
        filtered_detections = [
            det for det in detections
            if 'timestamp' in det and start_time <= det['timestamp'] <= end_time
        ]

        custom_heatmap_path = os.path.join(
            RESULTS_FOLDER, job_id, f"custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}.jpg"
        )
        floorplan_path = os.path.join(UPLOAD_FOLDER, job_id, job_row[3])  # input_floorplan_name is 4th col (index 3)

        def progress_callback(progress):
            custom_heatmap_progress[job_id] = progress

        # Instead of saving to disk, get the blended image from blend_heatmap
        blended_img = blend_heatmap(
            filtered_detections,
            floorplan_path,
            None,  # Don't save to disk
            os.path.join(RESULTS_FOLDER, job_id, f"video_{job_id}.mp4"),
            os.path.join(UPLOAD_FOLDER, job_id, job_row[2]),  # input_video_name is 3rd col (index 2)
            progress_callback=progress_callback,
            return_image=True
        )
        # Upload custom heatmap JPG to Supabase (no local file)
        upload_image_to_supabase(
            blended_img,
            f"{job_id}/custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}.jpg"
        )
        custom_heatmap_progress[job_id] = 1.0
    except Exception as e:
        custom_heatmap_progress[job_id] = 1.0
        logger.error(f"Error in custom heatmap thread: {str(e)}", exc_info=True)

@app.route('/api/heatmap_jobs/<job_id>/custom_heatmap', methods=['POST'])
@jwt_required()
def generate_custom_heatmap(job_id):
    try:
        data = request.get_json()
        start_time = float(data.get('start_time'))
        end_time = float(data.get('end_time'))
        logger.info(f"Custom heatmap request: job_id={job_id}, start_time={start_time}, end_time={end_time}")
        # Start background thread for custom heatmap generation
        custom_heatmap_progress[job_id] = 0.0
        t = threading.Thread(target=run_custom_heatmap_job, args=(job_id, start_time, end_time))
        t.daemon = True
        t.start()
        # Immediately return success, frontend will poll progress
        return jsonify({
            "success": True,
            "message": "Custom heatmap generation started. Poll progress endpoint.",
        })
    except Exception as e:
        logger.error(f"Error generating custom heatmap: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/heatmap_jobs/<job_id>/custom_heatmap_image')
def get_custom_heatmap_image(job_id):
    start = request.args.get('start')
    end = request.args.get('end')
    supabase_path = f"{job_id}/custom_heatmap_{float(start):.1f}_{float(end):.1f}.jpg"
    img_bytes = download_image_bytes_from_supabase(supabase_path)
    if img_bytes is None:
        return jsonify({"error": "Custom heatmap not found in Supabase"}), 404
    return Response(img_bytes, mimetype="image/jpeg")

@app.route('/api/heatmap_jobs/<job_id>/custom_heatmap_progress')
def get_custom_heatmap_progress(job_id):
    progress = custom_heatmap_progress.get(job_id, 0.0)
    return jsonify({"progress": progress})

@app.route('/api/heatmap_jobs/<job_id>/custom_analysis', methods=['GET'])
@jwt_required()
def get_custom_heatmap_analysis(job_id):
    try:
        start_time = request.args.get('start_time', type=float)
        end_time = request.args.get('end_time', type=float)
        area = request.args.get('area', 'all')
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
        job_row = cur.fetchone()
        cur.close()
        conn.close()
        if not job_row:
            return jsonify({'error': 'Job not found'}), 404
        if job_row[6] != 'completed':
            return jsonify({'error': 'Job not completed'}), 404
        detections, fps = load_detections(job_id)
        if detections is None:
            return jsonify({'error': 'Detections file not found'}), 404
        filtered_detections = [
            det for det in detections
            if 'timestamp' in det and start_time <= det['timestamp'] <= end_time
        ]
        supabase_path = f"{job_id}/custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}.jpg"
        img = download_image_from_supabase(supabase_path)
        if img is None:
            return jsonify({'error': 'Custom heatmap not found in Supabase'}), 404
        # Convert to grayscale if needed
        if len(img.shape) == 3:
            img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            img_gray = img
        analysis = analyze_heatmap(
            img_gray,
            (1080, 1920),
            detections=filtered_detections,
            fps=fps
        )
        return jsonify(analysis)
    except Exception as e:
        logger.error(f"Error getting custom heatmap analysis: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/heatmap_jobs/<job_id>/points', methods=['GET'])
@jwt_required()
def get_job_points(job_id):
    """
    API endpoint to return the 4 points (pointsData) for a given job.
    Reads the points JSON file saved during job creation and returns it as JSON.
    """
    # Find the job's upload folder and points file
    job_upload_folder = os.path.join(UPLOAD_FOLDER, job_id)
    # The points file is named points_<job_id>.json
    points_filename = f"points_{job_id}.json"
    points_path = os.path.join(job_upload_folder, points_filename)
    if not os.path.exists(points_path):
        return jsonify({"error": "Points file not found for this job."}), 404
    try:
        with open(points_path, 'r') as f:
            points_data = json.load(f)
        # Return the points data as JSON
        return jsonify({"pointsData": points_data})
    except Exception as e:
        return jsonify({"error": f"Failed to read points file: {str(e)}"}), 500

@app.route('/api/heatmap_jobs/<job_id>/time_range', methods=['GET'])
@jwt_required()
def get_job_time_range(job_id):
    """
    API endpoint to return the start and end date/time for a given job.
    Returns start_date, end_date, start_time, end_time as separate fields for easy frontend restoration.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT start_datetime, end_datetime FROM jobs WHERE job_id = %s", (job_id,))
    job_row = cur.fetchone()
    cur.close()
    conn.close()
    if not job_row:
        return jsonify({"error": "Job not found"}), 404
    start_dt = to_manila_iso(job_row[0])
    end_dt = to_manila_iso(job_row[1])
    # Split into date and time
    start_date, start_time = ('', '')
    end_date, end_time = ('', '')
    if 'T' in start_dt:
        start_date, start_time = start_dt.split('T')
    if 'T' in end_dt:
        end_date, end_time = end_dt.split('T')
    # Truncate time to HH:MM:SS
    start_time = start_time[:8]
    end_time = end_time[:8]
    return jsonify({
        "start_date": start_date,
        "end_date": end_date,
        "start_time": start_time,
        "end_time": end_time
    })

# On backend startup, clean up orphaned jobs left as 'pending' or 'processing' if not running in memory

def cleanup_orphaned_jobs():
    conn = get_db_connection()
    cur = conn.cursor()
    # Find jobs that are not completed/cancelled/errored
    cur.execute(
        "SELECT job_id FROM jobs WHERE status IN ('pending', 'processing')"
    )
    orphaned = cur.fetchall()
    for row in orphaned:
        job_id = row[0]  # psycopg2 returns tuples, not dicts
        # If job is not in memory (not running), mark as error
        if job_id not in jobs:
            cur.execute(
                "UPDATE jobs SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP WHERE job_id = %s",
                ('error', 'Job was interrupted by server shutdown.', job_id)
            )
    cur.close()
    conn.commit()
    conn.close()

def download_json_from_supabase(supabase_path):
    bucket = "projectresults"
    res = supabase.storage.from_(bucket).download(supabase_path)
    if res is None:
        return None
    return json.loads(res.decode('utf-8'))

def download_image_from_supabase(supabase_path):
    bucket = "projectresults"
    res = supabase.storage.from_(bucket).download(supabase_path)
    if res is None:
        return None
    file_bytes = np.frombuffer(res, np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    return img

def download_image_bytes_from_supabase(supabase_path):
    bucket = "projectresults"
    res = supabase.storage.from_(bucket).download(supabase_path)
    if res is None:
        return None
    return res

if __name__ == '__main__':
    # init_db()  # No longer needed, handled by Supabase
    cleanup_orphaned_jobs()  # Clean up jobs on startup
    app.run(host='0.0.0.0', port=5000, debug=True)