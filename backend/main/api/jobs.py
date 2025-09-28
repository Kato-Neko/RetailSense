from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import uuid
import datetime
import shutil
import cv2

from ..core.config import UPLOAD_FOLDER, RESULTS_FOLDER, ALLOWED_EXTENSIONS_VIDEO, to_manila_iso, logger
from ..core.db import get_db_connection
from ..services.video_jobs import process_video_job
from ..services.state import get_jobs_store
from ..helpers.files import allowed_file
from werkzeug.utils import secure_filename

jobs_bp = Blueprint('jobs', __name__)


@jobs_bp.route('/heatmap_jobs', methods=['POST'])
@jwt_required()
def create_heatmap_job():
    try:
        reuse_file = request.form.get('reuseFile', 'false').lower() == 'true'
        video_filename = None
        input_video_path = None
        if reuse_file:
            video_filename = request.form.get('videoFilename')
            current_user = get_jwt_identity()
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute('''SELECT job_id FROM jobs WHERE "user" = %s AND input_video_name = %s ORDER BY created_at DESC LIMIT 1''', (current_user, video_filename))
            job_row = cur.fetchone()
            cur.close()
            conn.close()
            if not job_row:
                return jsonify({"error": "No previous upload found to reuse."}), 400
            prev_job_id = job_row['job_id'] if isinstance(job_row, dict) else job_row[0]
            prev_upload_folder = os.path.join(UPLOAD_FOLDER, prev_job_id)
            prev_video_path = os.path.join(prev_upload_folder, video_filename)
            if not os.path.exists(prev_video_path):
                return jsonify({"error": "Previous video file not found on server."}), 400
            job_id = str(uuid.uuid4())
            job_upload_folder = os.path.join(UPLOAD_FOLDER, job_id)
            os.makedirs(job_upload_folder, exist_ok=True)
            input_video_path = os.path.join(job_upload_folder, video_filename)
            shutil.copy(prev_video_path, input_video_path)
        else:
            if 'videoFile' not in request.files:
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
            return jsonify({"error": "Missing pointsData"}), 400
        import json
        try:
            points_data = json.loads(points_data_str)
            if not (isinstance(points_data, list) and len(points_data) == 4):
                raise ValueError("pointsData must be a list of 4 points")
        except Exception as e:
            return jsonify({"error": f"Invalid pointsData: {e}"}), 400

        if not (video_filename and allowed_file(video_filename, ALLOWED_EXTENSIONS_VIDEO)):
            return jsonify({"error": "Invalid video file type"}), 400

        job_results_folder = os.path.join(RESULTS_FOLDER, job_id)
        os.makedirs(job_results_folder, exist_ok=True)

        cap = cv2.VideoCapture(input_video_path)
        ret, frame = cap.read()
        cap.release()
        if not ret:
            return jsonify({"error": "Failed to extract first frame from video"}), 500
        floorplan_filename = f"floorplan_{job_id}.jpg"
        input_floorplan_path = os.path.join(job_upload_folder, floorplan_filename)
        cv2.imwrite(input_floorplan_path, frame)
        
        # Upload floorplan to Supabase for analysis
        try:
            from ..core.storage import upload_image_to_supabase
            upload_image_to_supabase(frame, f"{job_id}/{floorplan_filename}")
            logger.info(f"Successfully uploaded floorplan to Supabase: {job_id}/{floorplan_filename}")
        except Exception as e:
            logger.error(f"Failed to upload floorplan to Supabase: {e}")
            # Continue without failing the job

        output_heatmap_image_path = os.path.join(job_results_folder, f"video_{job_id}_heatmap.jpg")
        output_processed_video_path = os.path.join(job_results_folder, f"video_{job_id}.mp4")

        start_date = request.form.get('start_date')
        end_date = request.form.get('end_date')
        start_time = request.form.get('start_time')
        end_time = request.form.get('end_time')
        if not (start_date and end_date and start_time and end_time):
            return jsonify({"error": "Missing date or time inputs"}), 400

        start_datetime = datetime.datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %H:%M:%S")
        end_datetime = datetime.datetime.strptime(f"{end_date} {end_time}", "%Y-%m-%d %H:%M:%S")
        from ..helpers.files import get_video_duration
        video_duration = get_video_duration(input_video_path)
        if (end_datetime - start_datetime).total_seconds() > video_duration:
            return jsonify({"error": "Time range exceeds video duration"}), 400
        if (end_datetime - start_datetime).total_seconds() <= 0:
            return jsonify({"error": "Time range must be greater than zero."}), 400

        points_filename = f"points_{job_id}.json"
        input_points_path = os.path.join(job_upload_folder, points_filename)
        with open(input_points_path, 'w') as f:
            f.write(points_data_str)

        jobs = get_jobs_store()
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

        current_user = get_jwt_identity()
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            cur.execute('''
                INSERT INTO jobs (job_id, "user", input_video_name, input_floorplan_name, status, message, start_datetime, end_datetime, created_at, updated_at, output_heatmap_path, output_video_path)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
                (job_id, current_user, video_filename, floorplan_filename, 'pending', 'Job submitted, awaiting processing.', start_datetime, end_datetime, datetime.datetime.now(), datetime.datetime.now(), None, None))
            conn.commit()
            cur.close()
        except Exception:
            raise
        finally:
            conn.close()

        import threading
        processing_thread = threading.Thread(target=process_video_job, args=(job_id,))
        processing_thread.daemon = True
        processing_thread.start()
        logger.info(f"Started processing thread for job {job_id}")

        return jsonify({"job_id": job_id, "status": "pending", "message": "Job submitted for processing."}), 202
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


@jobs_bp.route('/heatmap_jobs/<job_id>/status', methods=['GET'])
def get_job_status(job_id):
    jobs = get_jobs_store()
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
            return jsonify({"job_id": db_job['job_id'] if isinstance(db_job, dict) else db_job[0], "status": db_job['status'] if isinstance(db_job, dict) else db_job[1], "message": db_job['message'] if isinstance(db_job, dict) else db_job[2]})
        else:
            return jsonify({"error": "Job not found or not authorized"}), 404


@jobs_bp.route('/heatmap_jobs/<job_id>/result/video', methods=['GET'])
def get_processed_video(job_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
    job_row = cur.fetchone()
    cur.close()
    conn.close()
    if not job_row or job_row['status' if isinstance(job_row, dict) else 6] != 'completed':
        return jsonify({"error": "Job not found or not completed"}), 404

    output_video_path = job_row['output_video_path'] if isinstance(job_row, dict) and 'output_video_path' in job_row else None
    if not output_video_path or not os.path.exists(output_video_path):
        return jsonify({"error": "Result video file not found on server"}), 404
    return send_from_directory(os.path.dirname(output_video_path), os.path.basename(output_video_path), as_attachment=True)


@jobs_bp.route('/heatmap_jobs/history', methods=['GET'])
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


@jobs_bp.route('/heatmap_jobs/<job_id>', methods=['DELETE'])
@jwt_required()
def delete_heatmap_job(job_id):
    current_user = get_jwt_identity()
    from core.config import logger
    logger.info(f"User {current_user} attempting to delete job {job_id}")
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM jobs WHERE job_id = %s AND \"user\" = %s", (job_id, current_user))
        job_row = cur.fetchone()
        if not job_row:
            cur.close()
            conn.close()
            return jsonify({"error": "Job not found or not authorized"}), 404
        cur.execute("DELETE FROM jobs WHERE job_id = %s", (job_id,))
        cur.close()
        conn.commit()
        conn.close()
        results_folder = os.path.join(RESULTS_FOLDER, job_id)
        uploads_folder = os.path.join(UPLOAD_FOLDER, job_id)
        for folder in [results_folder, uploads_folder]:
            if os.path.exists(folder):
                shutil.rmtree(folder)
        from core.config import supabase
        bucket = "projectresults"
        try:
            files = supabase.storage.from_(bucket).list(path=job_id)
            if files and isinstance(files, list):
                for file in files:
                    file_path = f"{job_id}/{file['name']}"
                    supabase.storage.from_(bucket).remove(file_path)
        except Exception:
            pass
        logger.info(f"Successfully deleted job {job_id} for user {current_user}")
        return jsonify({"success": True, "message": "Heatmap job deleted."})
    except Exception as e:
        logger.error(f"Failed to delete job {job_id} for user {current_user}: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500


@jobs_bp.route('/heatmap_jobs/<job_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_heatmap_job(job_id):
    current_user = get_jwt_identity()
    jobs = get_jobs_store()
    job = jobs.get(job_id)
    if job:
        job['cancelled'] = True
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE jobs SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP WHERE job_id = %s", ('cancelled', 'Job was cancelled by user.', job_id))
        cur.close()
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Job cancelled."})
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
    job_row = cur.fetchone()
    if not job_row:
        cur.close()
        conn.close()
        return jsonify({"error": "Job not found"}), 404
    if job_row['status' if isinstance(job_row, dict) else 6] in ('completed', 'cancelled', 'error'):
        cur.close()
        conn.close()
        return jsonify({"success": True, "message": f"Job already {job_row['status' if isinstance(job_row, dict) else 6]}."})
    cur.execute("UPDATE jobs SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP WHERE job_id = %s", ('cancelled', 'Job was cancelled by user.', job_id))
    cur.close()
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Job cancelled in DB."})


@jobs_bp.route('/heatmap_jobs/<job_id>/points', methods=['GET'])
@jwt_required()
def get_job_points(job_id):
    job_upload_folder = os.path.join(UPLOAD_FOLDER, job_id)
    points_filename = f"points_{job_id}.json"
    points_path = os.path.join(job_upload_folder, points_filename)
    if not os.path.exists(points_path):
        return jsonify({"error": "Points file not found for this job."}), 404
    try:
        import json
        with open(points_path, 'r') as f:
            points_data = json.load(f)
        return jsonify({"pointsData": points_data})
    except Exception as e:
        return jsonify({"error": f"Failed to read points file: {str(e)}"}), 500


@jobs_bp.route('/heatmap_jobs/<job_id>/time_range', methods=['GET'])
@jwt_required()
def get_job_time_range(job_id):
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
    start_date, start_time = ('', '')
    end_date, end_time = ('', '')
    if 'T' in start_dt:
        start_date, start_time = start_dt.split('T')
    if 'T' in end_dt:
        end_date, end_time = end_dt.split('T')
    start_time = start_time[:8]
    end_time = end_time[:8]
    return jsonify({
        "start_date": start_date,
        "end_date": end_date,
        "start_time": start_time,
        "end_time": end_time
    })
