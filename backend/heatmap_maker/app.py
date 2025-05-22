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

# Import from backend files
from job_manager import init_db, get_db_connection
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
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173"],  # Frontend URL
        "methods": ["GET", "POST", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

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

def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def update_job_status_in_db(job_id, job):
    conn = get_db_connection()
    conn.execute('''
        UPDATE jobs 
        SET status = ?, message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
    ''', (job['status'], job['message'], job_id))
    conn.commit()
    conn.close()

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

        # Save detections and fps to JSON
        detections_path = os.path.join(RESULTS_FOLDER, job_id, 'detections.json')
        with open(detections_path, 'w') as f:
            json.dump({"fps": fps, "detections": detections}, f)

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
        blend_heatmap(
            detections,
            floorplan_path,
            output_heatmap_image_path,
            output_video_path,
            video_path
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
        conn.execute('''
            UPDATE jobs 
            SET status = ?, message = ?, updated_at = CURRENT_TIMESTAMP, output_heatmap_path = ?
            WHERE job_id = ?
        ''', (job['status'], job['message'], output_heatmap_image_path, job_id))
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
        conn.execute('''
            UPDATE jobs 
            SET status = ?, message = ?, updated_at = CURRENT_TIMESTAMP
            WHERE job_id = ?
        ''', (job['status'], job['message'], job_id))
        conn.commit()
        conn.close()

def update_job_progress(job_id, stage, progress):
    """Update job progress in both memory and database."""
    job = jobs[job_id]
    job['message'] = f'{stage} ({int(progress * 100)}%)'
    
    # Update database
    conn = get_db_connection()
    conn.execute('''
        UPDATE jobs 
        SET message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
    ''', (job['message'], job_id))
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
            job_row = conn.execute('''SELECT job_id FROM jobs WHERE user = ? AND input_video_name = ? ORDER BY created_at DESC LIMIT 1''', (current_user, video_filename)).fetchone()
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
            conn.execute('''
                INSERT INTO jobs (job_id, user, input_video_name, input_floorplan_name, status, message, start_datetime, end_datetime)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                (job_id, current_user, video_filename, floorplan_filename, 'pending', 'Job submitted, awaiting processing.', start_datetime, end_datetime))
            conn.commit()
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

        return jsonify({"job_id": job_id, "status": "pending", "message": "Job submitted for processing."}), 202
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
        db_job = conn.execute("SELECT job_id, status, message FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
        conn.close()
        if db_job:
            return jsonify({"job_id": db_job['job_id'], "status": db_job['status'], "message": db_job['message']})
        else:
            return jsonify({"error": "Job not found or not authorized"}), 404

@app.route('/api/heatmap_jobs/<job_id>/result/image', methods=['GET'])
def get_heatmap_image(job_id):
    conn = get_db_connection()
    job_row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
    conn.close()
    if not job_row or job_row['status'] != 'completed':
        return jsonify({"error": "Job not found or not completed"}), 404

    output_image_path = job_row['output_heatmap_path'] if 'output_heatmap_path' in job_row.keys() else None
    if not output_image_path or not os.path.exists(output_image_path):
        # Try .jpg if .png not found
        jpg_path = output_image_path.replace('.png', '.jpg') if output_image_path else None
        if jpg_path and os.path.exists(jpg_path):
            output_image_path = jpg_path
        else:
            return jsonify({"error": "Result image file not found on server"}), 404
    return send_from_directory(os.path.dirname(output_image_path), os.path.basename(output_image_path))

@app.route('/api/heatmap_jobs/<job_id>/result/video', methods=['GET'])
def get_processed_video(job_id):
    conn = get_db_connection()
    job_row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
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
    current_user = get_jwt_identity()  # Get the current user's ID from the JWT
    conn = get_db_connection()
    history_jobs_cursor = conn.execute('''
        SELECT job_id,
               input_video_name,
               input_floorplan_name,
               status,
               message,
               start_datetime,
               end_datetime,
               created_at,
               updated_at
        FROM jobs WHERE user = ? ORDER BY created_at DESC
    ''', (current_user,))
    history_jobs = [dict(row) for row in history_jobs_cursor.fetchall()]
    conn.close()
    return jsonify(history_jobs)

@app.route('/api/heatmap_jobs/<job_id>', methods=['DELETE'])
@jwt_required()
def delete_heatmap_job(job_id):
    try:
        conn = get_db_connection()
        job_row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
        if not job_row:
            conn.close()
            return jsonify({"error": "Job not found"}), 404
        # Remove from DB
        conn.execute("DELETE FROM jobs WHERE job_id = ?", (job_id,))
        conn.commit()
        conn.close()
        # Remove files (results and uploads)
        results_folder = os.path.join(RESULTS_FOLDER, job_id)
        uploads_folder = os.path.join(UPLOAD_FOLDER, job_id)
        for folder in [results_folder, uploads_folder]:
            if os.path.exists(folder):
                shutil.rmtree(folder)
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
        conn.execute("UPDATE jobs SET status = ?, message = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?", ('cancelled', 'Job was cancelled by user.', job_id))
        conn.commit()
        conn.close()
        logger.info(f"Job {job_id} status updated to 'cancelled' in DB (in-memory case).")
        return jsonify({"success": True, "message": "Job cancelled."})
    # If not in memory, try to cancel in the database
    conn = get_db_connection()
    job_row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
    if not job_row:
        conn.close()
        logger.error(f"Cancel failed: Job {job_id} not found in DB.")
        return jsonify({"error": "Job not found"}), 404
    if job_row['status'] in ('completed', 'cancelled', 'error'):
        conn.close()
        logger.info(f"Job {job_id} already finished with status {job_row['status']}.")
        return jsonify({"success": True, "message": f"Job already {job_row['status']}."})
    # Update status in DB
    conn.execute("UPDATE jobs SET status = ?, message = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?", ('cancelled', 'Job was cancelled by user.', job_id))
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

@app.route('/api/user/username', methods=['PUT', 'OPTIONS'])
@cross_origin(origins=["http://localhost:5173"], methods=["PUT", "OPTIONS"], allow_headers=["Content-Type", "Authorization"])
@jwt_required()
def update_username():
    user_id = get_jwt_identity()
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json()
    new_username = data.get('username')

    if not new_username:
        return jsonify({"error": "New username is required"}), 400

    try:
        # Check if new username already exists in Supabase
        existing_user = supabase.table('users').select('username').eq('username', new_username).execute()
        if existing_user.data:
            return jsonify({"error": "Username already exists"}), 400

        # Update username in Supabase for the current user
        result = supabase.table('users').update({'username': new_username}).eq('id', user_id).execute()
        if result.data:
            return jsonify({
                "message": "Username updated successfully",
                "username": new_username
            })
        else:
            return jsonify({"error": "Failed to update username"}), 500
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

@app.route('/api/user/password', methods=['PUT', 'OPTIONS'])
@cross_origin(origins=["http://localhost:5173"], methods=["PUT", "OPTIONS"], allow_headers=["Content-Type", "Authorization"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')

    if not current_password or not new_password:
        return jsonify({"error": "Current and new password are required"}), 400
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters long"}), 400

    try:
        # Fetch the user's email from Supabase
        user_data = supabase.table('users').select('email').eq('id', user_id).execute()
        if not user_data.data:
            return jsonify({"error": "User not found"}), 404
        email = user_data.data[0]['email']

        # Authenticate with current password to verify
        auth_resp = supabase.auth.sign_in_with_password({"email": email, "password": current_password})
        if not getattr(auth_resp, 'user', None):
            return jsonify({"error": "Current password is incorrect"}), 400

        # Update password using Supabase auth API
        update_resp = supabase.auth.update_user({"password": new_password})
        if getattr(update_resp, 'user', None):
            return jsonify({"message": "Password updated successfully"})
        else:
            return jsonify({"error": "Failed to update password"}), 500
    except Exception as e:
        return jsonify({"error": f"Error updating password: {str(e)}"}), 500

@app.route('/api/heatmap_jobs/<job_id>/export/csv', methods=['GET'])
@jwt_required()
def export_heatmap_csv(job_id):
    try:
        conn = get_db_connection()
        job_row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
        conn.close()
        
        if not job_row:
            logger.error(f"Job {job_id} not found in database")
            return jsonify({"error": "Job not found"}), 404
            
        if job_row['status'] != 'completed':
            logger.error(f"Job {job_id} status is {job_row['status']}, not completed")
            return jsonify({"error": "Job not completed"}), 404

        # Get date and time range from query parameters
        start_datetime = request.args.get('start_datetime', '')
        end_datetime = request.args.get('end_datetime', '')
        area = request.args.get('area', 'all')
        start_time = request.args.get('start_time', type=float)
        end_time = request.args.get('end_time', type=float)

        detections_path = os.path.join(RESULTS_FOLDER, job_id, 'detections.json')
        logger.debug(f"Looking for detections at: {detections_path}")
        
        if not os.path.exists(detections_path):
            logger.error(f"Detections file not found at {detections_path}")
            return jsonify({"error": "Detections file not found"}), 404

        with open(detections_path, 'r') as f:
            det_data = json.load(f)
            detections = det_data.get("detections", [])
            fps = det_data.get("fps")
            
        if not detections:
            logger.warning(f"No detections found in {detections_path}")
            return jsonify({"error": "No detections data available"}), 404

        # Filter detections by time range if specified
        if start_time is not None and end_time is not None:
            detections = [
                det for det in detections
                if 'timestamp' in det and start_time <= det['timestamp'] <= end_time
            ]

        # --- Load analysis data ---
        if start_time is not None and end_time is not None:
            # Use custom heatmap for analysis
            heatmap_path = os.path.join(
                RESULTS_FOLDER, job_id, f"custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}.jpg"
            )
        else:
            heatmap_path = job_row['output_heatmap_path']

        if not os.path.exists(heatmap_path):
            logger.error(f"Heatmap file not found at {heatmap_path}")
            return jsonify({"error": "Heatmap file not found"}), 404

        heatmap = cv2.imread(heatmap_path, cv2.IMREAD_GRAYSCALE)
        if heatmap is None:
            logger.error(f"Could not load heatmap from {heatmap_path}")
            return jsonify({"error": "Could not load heatmap"}), 500
            
        analysis = analyze_heatmap(heatmap, (1080, 1920), detections=detections, fps=fps)

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
        job_row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
        conn.close()
        
        if not job_row:
            return jsonify({'error': 'Job not found'}), 404
            
        if job_row['status'] != 'completed':
            return jsonify({'error': 'Job not completed'}), 404

        # Load detections
        detections_path = os.path.join(RESULTS_FOLDER, job_id, 'detections.json')
        if not os.path.exists(detections_path):
            return jsonify({'error': 'Detections file not found'}), 404

        with open(detections_path, 'r') as f:
            det_data = json.load(f)
            detections = det_data.get("detections", [])
            fps = det_data.get("fps")

        # Filter detections by time range if specified
        if start_time is not None and end_time is not None:
            detections = [
                det for det in detections
                if 'timestamp' in det and start_time <= det['timestamp'] <= end_time
            ]

        # Get analysis data
        if start_time is not None and end_time is not None:
            # Use custom heatmap for analysis
            heatmap_path = os.path.join(
                RESULTS_FOLDER, job_id, f"custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}.jpg"
            )
        else:
            heatmap_path = job_row['output_heatmap_path']

        if not os.path.exists(heatmap_path):
            return jsonify({'error': 'Heatmap file not found'}), 404

        heatmap = cv2.imread(heatmap_path, cv2.IMREAD_GRAYSCALE)
        if heatmap is None:
            return jsonify({'error': 'Could not load heatmap'}), 500

        analysis = analyze_heatmap(heatmap, (1080, 1920), detections=detections, fps=fps)
        if not analysis:
            return jsonify({'error': 'Analysis not found'}), 404

        # Create PDF
        buffer = BytesIO()
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
        elements.append(Paragraph(f"Heatmap Analysis Report - {job_row['input_video_name']}", title_style))

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

        # Add heatmap image
        if os.path.exists(heatmap_path):
            img = Image(heatmap_path, width=400, height=300)
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
    job_row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
    conn.close()
    if not job_row or job_row['status'] != 'completed':
        return jsonify({"error": "Job not found or not completed"}), 404

    heatmap_path = job_row['output_heatmap_path']
    if not os.path.exists(heatmap_path):
        return jsonify({"error": "Heatmap file not found"}), 404

    heatmap = cv2.imread(heatmap_path, cv2.IMREAD_GRAYSCALE)
    if heatmap is None:
        return jsonify({"error": "Could not load heatmap"}), 500

    floorplan_filename = job_row['input_floorplan_name']
    floorplan_path = os.path.join(UPLOAD_FOLDER, job_id, floorplan_filename)
    floorplan = cv2.imread(floorplan_path)
    if floorplan is None:
        return jsonify({"error": "Could not load floorplan"}), 500

    # Load detections and fps
    detections_path = os.path.join(RESULTS_FOLDER, job_id, 'detections.json')
    if os.path.exists(detections_path):
        with open(detections_path, 'r') as f:
            det_data = json.load(f)
            fps = det_data.get("fps")
            detections = det_data.get("detections", [])
    else:
        fps = None
        detections = None

    analysis = analyze_heatmap(heatmap, floorplan.shape[:2], detections=detections, fps=fps)
    return jsonify(analysis)

@app.route('/api/heatmap_jobs/<job_id>/custom_heatmap', methods=['POST'])
@jwt_required()
def generate_custom_heatmap(job_id):
    try:
        data = request.get_json()
        start_time = float(data.get('start_time'))
        end_time = float(data.get('end_time'))
        area = data.get('area', 'all')

        # Fetch job info from DB
        conn = get_db_connection()
        job_row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
        conn.close()
        if not job_row or job_row['status'] != 'completed':
            return jsonify({"error": "Job not found or not completed"}), 404

        # Load detections
        detections_path = os.path.join(RESULTS_FOLDER, job_id, 'detections.json')
        if not os.path.exists(detections_path):
            return jsonify({"error": "Detections file not found"}), 404
        with open(detections_path, 'r') as f:
            det_data = json.load(f)
            detections = det_data.get("detections", [])
            fps = det_data.get("fps")

        # Filter detections by time range
        filtered_detections = [
            det for det in detections
            if 'timestamp' in det and start_time <= det['timestamp'] <= end_time
        ]

        # (Optional) Filter by area if you have area logic
        # For now, just pass through

        # Generate a temporary output path for the custom heatmap
        custom_heatmap_path = os.path.join(
            RESULTS_FOLDER, job_id, f"custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}.jpg"
        )
        floorplan_path = os.path.join(UPLOAD_FOLDER, job_id, job_row['input_floorplan_name'])

        # Generate the heatmap
        def progress_callback(progress):
            custom_heatmap_progress[job_id] = progress

        blend_heatmap(
            filtered_detections,
            floorplan_path,
            custom_heatmap_path,
            os.path.join(RESULTS_FOLDER, job_id, f"video_{job_id}.mp4"),
            os.path.join(UPLOAD_FOLDER, job_id, job_row['input_video_name']),
            progress_callback=progress_callback
        )
        custom_heatmap_progress[job_id] = 1.0  # Mark as done

        # Return the path or a URL to the generated heatmap
        return jsonify({
            "success": True,
            "heatmap_url": f"/api/heatmap_jobs/{job_id}/custom_heatmap_image?start={start_time}&end={end_time}"
        })
    except Exception as e:
        logger.error(f"Error generating custom heatmap: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/heatmap_jobs/<job_id>/custom_heatmap_image')
#@jwt_required()
def get_custom_heatmap_image(job_id):
    start = request.args.get('start')
    end = request.args.get('end')
    filename = f"custom_heatmap_{float(start):.1f}_{float(end):.1f}.jpg"
    folder = os.path.join(RESULTS_FOLDER, job_id)
    if not os.path.exists(os.path.join(folder, filename)):
        return jsonify({"error": "Custom heatmap not found"}), 404
    return send_from_directory(folder, filename)

@app.route('/api/heatmap_jobs/<job_id>/custom_heatmap_progress')
def get_custom_heatmap_progress(job_id):
    progress = custom_heatmap_progress.get(job_id, 0.0)
    return jsonify({"progress": progress})

@app.route('/api/heatmap_jobs/<job_id>/detections', methods=['GET'])
@jwt_required()
def get_detections_from_json(job_id):
    """
    Fetch detections from the detections.json file for a given job ID.
    
    Args:
        job_id (str): The ID of the job to fetch detections for.
    
    Returns:
        JSON response containing the list of detections and the fps.
    """
    # Construct the path to the detections.json file
    detections_path = os.path.join(RESULTS_FOLDER, job_id, 'detections.json')
    
    # Check if the detections.json file exists
    if not os.path.exists(detections_path):
        logger.error(f"Detections file not found for job ID: {job_id}")
        return jsonify({"error": "Detections file not found"}), 404
    
    # Read the detections.json file
    try:
        with open(detections_path, 'r') as f:
            det_data = json.load(f)
            detections = det_data.get("detections", [])
            fps = det_data.get("fps")
        
        # Return the detections and fps in a structured JSON response
        return jsonify({"detections": detections, "fps": fps}), 200
    except Exception as e:
        logger.error(f"Error reading detections file for job ID {job_id}: {str(e)}")
        return jsonify({"error": "Failed to read detections data"}), 500

@app.route('/api/heatmap_jobs/<job_id>/custom_analysis', methods=['GET'])
@jwt_required()
def get_custom_heatmap_analysis(job_id):
    try:
        # Get time range parameters
        start_time = request.args.get('start_time', type=float)
        end_time = request.args.get('end_time', type=float)
        area = request.args.get('area', 'all')

        # Get job data from database
        conn = get_db_connection()
        job_row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
        conn.close()
        
        if not job_row:
            return jsonify({'error': 'Job not found'}), 404
            
        if job_row['status'] != 'completed':
            return jsonify({'error': 'Job not completed'}), 404

        # Load detections
        detections_path = os.path.join(RESULTS_FOLDER, job_id, 'detections.json')
        if not os.path.exists(detections_path):
            return jsonify({'error': 'Detections file not found'}), 404

        with open(detections_path, 'r') as f:
            det_data = json.load(f)
            detections = det_data.get("detections", [])
            fps = det_data.get("fps")

        # Filter detections by time range
        filtered_detections = [
            det for det in detections
            if 'timestamp' in det and start_time <= det['timestamp'] <= end_time
        ]

        # Load the custom heatmap
        custom_heatmap_path = os.path.join(
            RESULTS_FOLDER, job_id, f"custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}.jpg"
        )
        if not os.path.exists(custom_heatmap_path):
            return jsonify({'error': 'Custom heatmap not found'}), 404

        # Analyze the custom heatmap
        heatmap = cv2.imread(custom_heatmap_path, cv2.IMREAD_GRAYSCALE)
        if heatmap is None:
            return jsonify({'error': 'Could not load custom heatmap'}), 500

        analysis = analyze_heatmap(
            heatmap,
            (1080, 1920),  # Default dimensions
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
    job_row = conn.execute("SELECT start_datetime, end_datetime FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
    conn.close()
    if not job_row:
        return jsonify({"error": "Job not found"}), 404
    # Parse the datetime strings
    start_dt = str(job_row['start_datetime']) if job_row['start_datetime'] else ''
    end_dt = str(job_row['end_datetime']) if job_row['end_datetime'] else ''
    # Split into date and time
    start_date, start_time = ('', '')
    end_date, end_time = ('', '')
    if ' ' in start_dt:
        start_date, start_time = start_dt.split(' ')
    elif 'T' in start_dt:
        start_date, start_time = start_dt.split('T')
    if ' ' in end_dt:
        end_date, end_time = end_dt.split(' ')
    elif 'T' in end_dt:
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
    # Find jobs that are not completed/cancelled/errored
    orphaned = conn.execute(
        "SELECT job_id FROM jobs WHERE status IN ('pending', 'processing')"
    ).fetchall()
    for row in orphaned:
        job_id = row['job_id']
        # If job is not in memory (not running), mark as error
        if job_id not in jobs:
            conn.execute(
                "UPDATE jobs SET status = ?, message = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?",
                ('error', 'Job was interrupted by server shutdown.', job_id)
            )
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    cleanup_orphaned_jobs()  # Clean up jobs on startup
    app.run(host='0.0.0.0', port=5000, debug=True)