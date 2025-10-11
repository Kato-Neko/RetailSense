from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import uuid
import datetime
import threading

from ..core.config import to_manila_iso
from ..core.database_manager import db_manager
from ..services.job_manager import job_manager
from ..services.file_manager import file_manager
from ..services.video_jobs import process_video_job
from werkzeug.utils import secure_filename

jobs_bp = Blueprint('jobs', __name__)


@jobs_bp.route('/api/heatmap_jobs', methods=['POST'])
@jwt_required()
def create_heatmap_job():
    try:
        current_user = get_jwt_identity()
        reuse_file = request.form.get('reuseFile', 'false').lower() == 'true'
        
        # Handle video file
        if reuse_file:
            video_filename = request.form.get('videoFilename')
            if not video_filename:
                return jsonify({"error": "Missing videoFilename for reuse"}), 400
            
            # Get previous job data
            user_jobs = db_manager.get_jobs_by_user(current_user)
            prev_job = next((job for job in user_jobs if job['input_video_name'] == video_filename), None)
            if not prev_job:
                return jsonify({"error": "No previous upload found to reuse."}), 400
            
            job_id = str(uuid.uuid4())
            job_upload_folder, job_results_folder = file_manager.create_job_directories(job_id)
            
            # Copy previous video file
            prev_video_path = os.path.join(file_manager.upload_folder, prev_job['job_id'], video_filename)
            if not file_manager.file_exists(prev_video_path):
                return jsonify({"error": "Previous video file not found on server."}), 400
            
            input_video_path = file_manager.copy_file(prev_video_path, os.path.join(job_upload_folder, video_filename))
        else:
            if 'videoFile' not in request.files:
                return jsonify({"error": "Missing videoFile"}), 400
            
            video_file = request.files['videoFile']
            video_filename = secure_filename(video_file.filename)
            job_id = str(uuid.uuid4())
            job_upload_folder, job_results_folder = file_manager.create_job_directories(job_id)
            
            input_video_path = file_manager.save_uploaded_file(video_file, job_upload_folder, video_filename)
        
        # Validate video file
        if not file_manager.is_video_file(video_filename):
            return jsonify({"error": "Invalid video file type"}), 400
        
        # Handle points data
        points_data_str = request.form.get('pointsData')
        if not points_data_str:
            return jsonify({"error": "Missing pointsData"}), 400
        
        import json
        try:
            points_data = json.loads(points_data_str)
            is_valid, error_msg = file_manager.validate_points_data(points_data)
            if not is_valid:
                return jsonify({"error": f"Invalid pointsData: {error_msg}"}), 400
        except Exception as e:
            return jsonify({"error": f"Invalid pointsData: {e}"}), 400
        
        # Extract first frame as floorplan
        floorplan_filename = f"floorplan_{job_id}.jpg"
        floorplan_path = os.path.join(job_upload_folder, floorplan_filename)
        if not file_manager.extract_first_frame(input_video_path, floorplan_path):
            return jsonify({"error": "Failed to extract first frame from video"}), 500
        
        # Handle time range
        start_date = request.form.get('start_date')
        end_date = request.form.get('end_date')
        start_time = request.form.get('start_time')
        end_time = request.form.get('end_time')
        if not (start_date and end_date and start_time and end_time):
            return jsonify({"error": "Missing date or time inputs"}), 400
        
        start_datetime = datetime.datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %H:%M:%S")
        end_datetime = datetime.datetime.strptime(f"{end_date} {end_time}", "%Y-%m-%d %H:%M:%S")
        
        # Validate time range
        video_duration = file_manager.get_video_duration(input_video_path)
        if (end_datetime - start_datetime).total_seconds() > video_duration:
            return jsonify({"error": "Time range exceeds video duration"}), 400
        if (end_datetime - start_datetime).total_seconds() <= 0:
            return jsonify({"error": "Time range must be greater than zero."}), 400
        
        # Save points data
        input_points_path = file_manager.save_points_data(points_data, job_upload_folder, job_id)
        
        # Get output paths
        output_heatmap_image_path, output_processed_video_path = file_manager.get_job_output_paths(job_id)
        
        # Create job in memory
        job_data = {
            'status': 'pending',
            'message': 'Job submitted, awaiting processing.',
            'input_files': {
                'video': input_video_path,
                'floorplan': floorplan_path,
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
        job_manager.add_job(job_id, job_data)
        
        # Create job in database
        db_job_data = {
            'job_id': job_id,
            'user': current_user,
            'input_video_name': video_filename,
            'input_floorplan_name': floorplan_filename,
            'status': 'pending',
            'message': 'Job submitted, awaiting processing.',
            'start_datetime': start_datetime,
            'end_datetime': end_datetime,
            'created_at': datetime.datetime.now(),
            'updated_at': datetime.datetime.now()
        }
        db_manager.insert_job(db_job_data)
        
        # Start processing
        processing_thread = threading.Thread(target=process_video_job, args=(job_id,))
        processing_thread.daemon = True
        processing_thread.start()
        
        return jsonify({"job_id": job_id, "status": "pending", "message": "Job submitted for processing."}), 202
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500


@jobs_bp.route('/api/heatmap_jobs/<job_id>/status', methods=['GET'])
def get_job_status(job_id):
    job_status = job_manager.get_job_status(job_id)
    if job_status:
        return jsonify(job_status)
    else:
        return jsonify({"error": "Job not found or not authorized"}), 404


@jobs_bp.route('/api/heatmap_jobs/<job_id>/result/video', methods=['GET'])
def get_processed_video(job_id):
    job_data = db_manager.get_job_by_id(job_id)
    if not job_data or job_data['status'] != 'completed':
        return jsonify({"error": "Job not found or not completed"}), 404
    
    output_video_path = job_data.get('output_video_path')
    if not output_video_path or not file_manager.file_exists(output_video_path):
        return jsonify({"error": "Result video file not found on server"}), 404
    
    return send_from_directory(os.path.dirname(output_video_path), os.path.basename(output_video_path), as_attachment=True)


@jobs_bp.route('/api/heatmap_jobs/history', methods=['GET'])
@jwt_required()
def get_job_history():
    current_user = get_jwt_identity()
    user_jobs = db_manager.get_jobs_by_user(current_user)
    
    history_jobs = [
        {
            "job_id": job['job_id'],
            "input_video_name": job['input_video_name'],
            "input_floorplan_name": job['input_floorplan_name'],
            "status": job['status'],
            "message": job['message'],
            "start_datetime": to_manila_iso(job['start_datetime']),
            "end_datetime": to_manila_iso(job['end_datetime']),
            "created_at": to_manila_iso(job['created_at']),
            "updated_at": to_manila_iso(job['updated_at']),
        }
        for job in user_jobs
    ]
    
    return jsonify(history_jobs)


@jobs_bp.route('/api/heatmap_jobs/<job_id>', methods=['DELETE'])
@jwt_required()
def delete_heatmap_job(job_id):
    current_user = get_jwt_identity()
    from core.config import logger
    logger.info(f"User {current_user} attempting to delete job {job_id}")
    
    try:
        # Delete from database
        if not db_manager.delete_job(job_id, current_user):
            return jsonify({"error": "Job not found or not authorized"}), 404
        
        # Delete files
        file_manager.delete_job_files(job_id)
        
        # Remove from Supabase storage
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


@jobs_bp.route('/api/heatmap_jobs/<job_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_heatmap_job(job_id):
    # Try to cancel job in memory first
    if job_manager.cancel_job(job_id):
        return jsonify({"success": True, "message": "Job cancelled."})
    
    # Fallback to database
    job_data = db_manager.get_job_by_id(job_id)
    if not job_data:
        return jsonify({"error": "Job not found"}), 404
    
    if job_data['status'] in ('completed', 'cancelled', 'error'):
        return jsonify({"success": True, "message": f"Job already {job_data['status']}."})
    
    db_manager.update_job_status(job_id, 'cancelled', 'Job was cancelled by user.')
    return jsonify({"success": True, "message": "Job cancelled in DB."})


@jobs_bp.route('/api/heatmap_jobs/<job_id>/points', methods=['GET'])
@jwt_required()
def get_job_points(job_id):
    points_data = file_manager.load_points_data(job_id)
    if points_data is None:
        return jsonify({"error": "Points file not found for this job."}), 404
    
    return jsonify({"pointsData": points_data})


@jobs_bp.route('/api/heatmap_jobs/<job_id>/time_range', methods=['GET'])
@jwt_required()
def get_job_time_range(job_id):
    job_data = db_manager.get_job_by_id(job_id)
    if not job_data:
        return jsonify({"error": "Job not found"}), 404
    
    start_dt = to_manila_iso(job_data['start_datetime'])
    end_dt = to_manila_iso(job_data['end_datetime'])
    
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
