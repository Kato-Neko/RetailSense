"""
app.py
Flask entry point for the backend, using refactored modules.
"""

import os
import uuid
import threading
import logging
from flask import Flask, request, jsonify, session, send_from_directory, Response
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
from reportlab.platypus import Image, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
import numpy as np

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

def process_video_job(job_id):
    """Process a video job in the background (restore backend detection)."""
    try:
        job = jobs[job_id]
        job['status'] = 'processing'
        job['message'] = 'Starting video processing...'
        job['cancelled'] = False

        # Validate video file
        video_path = job['input_files']['video']
        floorplan_path = job['input_files']['floorplan']
        points_path = job['input_files']['points']
        with open(points_path, 'r') as f:
            points_data = json.load(f)
        cap = validate_video_file(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.release()

        # Update status for YOLO detection
        job['message'] = 'Running YOLO detection (0%)'
        output_video_path, detections, fps = detect_and_track(
            video_path,
            job['output_files_expected']['video'],
            progress_callback=lambda p: update_job_progress(job_id, 'YOLO detection', p),
            preview_folder=job['output_files_expected']['image'] and os.path.dirname(job['output_files_expected']['image'])
        )

        # Save detections and fps to JSON
        detections_path = os.path.join(RESULTS_FOLDER, job_id, 'detections.json')
        with open(detections_path, 'w') as f:
            json.dump({"fps": fps, "detections": detections}, f)

        # For testing: use static points from Points/floorplan_points.txt
        points = [[768, 204], [690, 200], [655, 305], [793, 309]]

        # Now, generate the blended heatmap using blend_heatmap with real detections and points
        output_heatmap_image_path = job['output_files_expected']['image']
        blend_heatmap(
            detections,
            floorplan_path,
            output_heatmap_image_path,
            output_video_path,
            video_path
        )

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

@app.route('/api/heatmap_jobs', methods=['POST'])
@jwt_required()
def create_heatmap_job():
    try:
        logger.debug("Received job creation request")
        logger.debug(f"Files in request: {request.files}")
        logger.debug(f"Form data: {request.form}")

        if 'videoFile' not in request.files:
            logger.error("Missing required video file")
            return jsonify({"error": "Missing videoFile"}), 400
        
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

        video_file = request.files['videoFile']
        logger.debug(f"Video file: {video_file.filename}")
        if not (video_file.filename and allowed_file(video_file.filename, ALLOWED_EXTENSIONS_VIDEO)):
            logger.error("Invalid video file type")
            return jsonify({"error": "Invalid video file type"}), 400

        job_id = str(uuid.uuid4())
        logger.debug(f"Generated job ID: {job_id}")

        job_upload_folder = os.path.join(UPLOAD_FOLDER, job_id)
        job_results_folder = os.path.join(RESULTS_FOLDER, job_id)
        os.makedirs(job_upload_folder, exist_ok=True)
        os.makedirs(job_results_folder, exist_ok=True)

        video_filename = secure_filename(video_file.filename)
        points_filename = f"points_{job_id}.json"
        floorplan_filename = f"floorplan_{job_id}.jpg"

        input_video_path = os.path.join(job_upload_folder, video_filename)
        input_points_path = os.path.join(job_upload_folder, points_filename)
        input_floorplan_path = os.path.join(job_upload_folder, floorplan_filename)

        logger.debug(f"Saving files to: {job_upload_folder}")
        video_file.save(input_video_path)
        with open(input_points_path, 'w') as f:
            json.dump(points_data, f)

        # Extract first frame as floorplan
        cap = cv2.VideoCapture(input_video_path)
        ret, frame = cap.read()
        cap.release()
        if not ret:
            logger.error("Failed to extract first frame from video")
            return jsonify({"error": "Failed to extract first frame from video"}), 500
        cv2.imwrite(input_floorplan_path, frame)

        output_heatmap_image_path = os.path.join(job_results_folder, f"video_{job_id}_heatmap.jpg")
        output_processed_video_path = os.path.join(job_results_folder, f"video_{job_id}.mp4")

        # Create job entry
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
                INSERT INTO jobs (job_id, user, input_video_name, input_floorplan_name, status, message)
                VALUES (?, ?, ?, ?, ?, ?)''',
                (job_id, current_user, video_filename, floorplan_filename, 'pending', 'Job submitted, awaiting processing.'))
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
    conn = get_db_connection()
    history_jobs_cursor = conn.execute('''
        SELECT job_id, input_video_name, input_floorplan_name, status, message, created_at, updated_at
        FROM jobs ORDER BY created_at DESC
    ''')
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
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    job['cancelled'] = True
    return jsonify({"success": True, "message": "Job cancelled."})

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

@app.route('/api/user/username', methods=['PUT'])
@jwt_required()
def update_username():
    username = get_jwt_identity()
    if not username:
        return jsonify({"error": "Not logged in"}), 401
    
    data = request.get_json()
    new_username = data.get('username')
    
    if not new_username:
        return jsonify({"error": "New username is required"}), 400
    
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Check if new username already exists
        cursor.execute("SELECT username FROM users WHERE username = ?", (new_username,))
        if cursor.fetchone():
            return jsonify({"error": "Username already exists"}), 400
        
        # Update username
        cursor.execute("UPDATE users SET username = ? WHERE username = ?", 
                      (new_username, username))
        conn.commit()
        
        return jsonify({
            "message": "Username updated successfully",
            "username": new_username
        })
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    finally:
        conn.close()

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

        # --- Load analysis data ---
        heatmap_path = job_row['output_heatmap_path']
        if not os.path.exists(heatmap_path):
            logger.error(f"Heatmap file not found at {heatmap_path}")
            return jsonify({"error": "Heatmap file not found"}), 404
            
        floorplan_filename = job_row['input_floorplan_name']
        floorplan_path = os.path.join(UPLOAD_FOLDER, job_id, floorplan_filename)
        if not os.path.exists(floorplan_path):
            logger.error(f"Floorplan file not found at {floorplan_path}")
            return jsonify({"error": "Floorplan file not found"}), 404

        heatmap = cv2.imread(heatmap_path, cv2.IMREAD_GRAYSCALE)
        if heatmap is None:
            logger.error(f"Could not load heatmap from {heatmap_path}")
            return jsonify({"error": "Could not load heatmap"}), 500
            
        floorplan = cv2.imread(floorplan_path)
        if floorplan is None:
            logger.error(f"Could not load floorplan from {floorplan_path}")
            return jsonify({"error": "Could not load floorplan"}), 500

        analysis = analyze_heatmap(heatmap, floorplan.shape[:2], detections=detections, fps=fps)

        output = io.StringIO()
        writer = csv.writer(output)

        # Write analysis summary at the top
        writer.writerow(['Heatmap Analysis'])
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
@jwt_required()
def export_heatmap_pdf(job_id):
    conn = get_db_connection()
    job_row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
    conn.close()
    if not job_row or job_row['status'] != 'completed':
        return jsonify({"error": "Job not found or not completed"}), 404

    heatmap_path = job_row['output_heatmap_path']
    if not os.path.exists(heatmap_path):
        return jsonify({"error": "Heatmap image not found"}), 404

    # --- Load analysis data ---
    floorplan_filename = job_row['input_floorplan_name']
    floorplan_path = os.path.join(UPLOAD_FOLDER, job_id, floorplan_filename)
    heatmap = cv2.imread(heatmap_path, cv2.IMREAD_GRAYSCALE)
    floorplan = cv2.imread(floorplan_path)
    # Load detections and fps if you use them in analyze_heatmap
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

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 750, f"Heatmap Report for Job {job_id}")

    # Draw heatmap image
    c.drawImage(heatmap_path, 50, 400, width=400, height=300)

    y = 370
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Traffic Distribution:")
    y -= 20
    c.setFont("Helvetica", 11)
    c.drawString(60, y, f"High Traffic: {analysis['areas']['high']['percentage']}%")
    y -= 15
    c.drawString(60, y, f"Medium Traffic: {analysis['areas']['medium']['percentage']}%")
    y -= 15
    c.drawString(60, y, f"Low Traffic: {analysis['areas']['low']['percentage']}%")
    y -= 25

    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Recommendations:")
    y -= 20
    c.setFont("Helvetica", 11)
    for rec in analysis['recommendations']:
        c.drawString(60, y, f"- {rec}")
        y -= 15
    if not analysis['recommendations']:
        c.drawString(60, y, "No recommendations available.")
        y -= 15
    y -= 10

    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Peak Hours:")
    y -= 20
    c.setFont("Helvetica", 11)
    if analysis['peak_hours']:
        for ph in analysis['peak_hours']:
            c.drawString(60, y, f"{ph['start_minute']} - {ph['end_minute']} min ({ph['count']} detections)")
            y -= 15
    else:
        c.drawString(60, y, "No peak hours detected.")
        y -= 15

    c.save()
    buffer.seek(0)
    return Response(
        buffer,
        mimetype='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=heatmap_{job_id}.pdf'}
    )

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
            job_row['output_video_path'],
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

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True) 