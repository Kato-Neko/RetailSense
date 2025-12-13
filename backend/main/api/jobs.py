from flask import Blueprint, request, jsonify, send_from_directory, Response
from flask_cors import cross_origin
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask.helpers import stream_with_context
import os
import uuid
import datetime
import shutil
import cv2
import json
import numpy as np

from ..core.config import UPLOAD_FOLDER, RESULTS_FOLDER, ALLOWED_EXTENSIONS_VIDEO, to_manila_iso, logger, supabase
from ..core.db import get_db_connection_context
from ..services.video_jobs import process_video_job
from ..services.state import get_jobs_store
from ..helpers.files import allowed_file, get_video_duration
from ..helpers.analysis import analyze_heatmap
from ..helpers.ai_analysis import generate_ai_recommendations_stream
from ..core.storage import download_json_from_supabase, upload_image_to_supabase
from ..services.job_queue import get_job_queue
from werkzeug.utils import secure_filename

jobs_bp = Blueprint('jobs', __name__)


class JobsHandler:
    """Handler class for job-related API endpoints."""
    
    def __init__(self, logger_instance=None):
        """Initialize the jobs handler.
        
        Args:
            logger_instance: Optional logger instance (defaults to module logger)
        """
        self.logger = logger_instance or logger
    
    def _parse_final_recommendations(self, content: str) -> list:
        """Parse AI response content into list of recommendations.
        
        Args:
            content: The full response content from AI
            
        Returns:
            List of recommendation strings
        """
        try:
            content = content.strip()
            # Remove markdown code blocks if present
            if content.startswith('```'):
                lines = content.split('\n')
                content = '\n'.join(lines[1:-1]) if len(lines) > 2 else content
            result = json.loads(content)
            if isinstance(result, dict):
                # Accept {'recommendations': [...]} or {'items': [...]} etc.
                for v in result.values():
                    if isinstance(v, list):
                        if all(isinstance(x, str) for x in v):
                            return v[:3]
                return []
            if isinstance(result, list) and all(isinstance(r, str) for r in result):
                return result[:3]
            return []
        except Exception as e:
            self.logger.warning(f"Failed to parse AI response: {e}")
            return []
    
    def create_heatmap_job(self):
        """Create a new heatmap processing job."""
        try:
            reuse_file = request.form.get('reuseFile', 'false').lower() == 'true'
            video_filename = None
            input_video_path = None
            if reuse_file:
                video_filename = request.form.get('videoFilename')
                current_user = get_jwt_identity()
                with get_db_connection_context() as conn:
                    cur = conn.cursor()
                    cur.execute('''SELECT job_id FROM jobs WHERE "user" = %s AND input_video_name = %s ORDER BY created_at DESC LIMIT 1''', (current_user, video_filename))
                    job_row = cur.fetchone()
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
                upload_image_to_supabase(frame, f"{job_id}/{floorplan_filename}")
                self.logger.info(f"Successfully uploaded floorplan to Supabase: {job_id}/{floorplan_filename}")
            except Exception as e:
                self.logger.error(f"Failed to upload floorplan to Supabase: {e}")
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
            with get_db_connection_context() as conn:
                cur = conn.cursor()
                cur.execute('''
                    INSERT INTO jobs (job_id, "user", input_video_name, input_floorplan_name, status, message, start_datetime, end_datetime, created_at, updated_at, output_heatmap_path, output_video_path)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
                    (job_id, current_user, video_filename, floorplan_filename, 'pending', 'Job submitted, awaiting processing.', start_datetime, end_datetime, datetime.datetime.now(), datetime.datetime.now(), None, None))
                conn.commit()

            # Use job queue instead of direct threading
            job_queue = get_job_queue()
            job_queue.add_job(job_id, process_video_job, job_id)
            self.logger.info(f"Job {job_id} submitted to queue (queue size: {job_queue.get_queue_size()})")

            return jsonify({"job_id": job_id, "status": "pending", "message": "Job submitted for processing."}), 202
        except Exception as e:
            self.logger.error(f"Error creating heatmap job: {e}", exc_info=True)
            return jsonify({"error": f"Failed to start video processing. Please try again."}), 500
    
    def get_job_status(self, job_id):
        """Get status of a job."""
        jobs = get_jobs_store()
        job = jobs.get(job_id)
        if job:
            return jsonify({"job_id": job_id, "status": job['status'], "message": job.get('message', '')})
        else:
            with get_db_connection_context() as conn:
                cur = conn.cursor()
                cur.execute("SELECT job_id, status, message FROM jobs WHERE job_id = %s", (job_id,))
                db_job = cur.fetchone()
                cur.close()
            if db_job:
                return jsonify({"job_id": db_job['job_id'] if isinstance(db_job, dict) else db_job[0], "status": db_job['status'] if isinstance(db_job, dict) else db_job[1], "message": db_job['message'] if isinstance(db_job, dict) else db_job[2]})
            else:
                return jsonify({"error": "Job not found or not authorized"}), 404
    
    def get_processed_video(self, job_id):
        """Get processed video result for a job."""
        with get_db_connection_context() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
            job_row = cur.fetchone()
        if not job_row or job_row['status' if isinstance(job_row, dict) else 6] != 'completed':
            return jsonify({"error": "Job not found or not completed"}), 404

        output_video_path = job_row['output_video_path'] if isinstance(job_row, dict) and 'output_video_path' in job_row else None
        if not output_video_path or not os.path.exists(output_video_path):
            return jsonify({"error": "Result video file not found on server"}), 404
        return send_from_directory(os.path.dirname(output_video_path), os.path.basename(output_video_path), as_attachment=True)
    
    def get_job_history(self):
        """Return job history for the current user."""
        current_user = get_jwt_identity()

        try:
            with get_db_connection_context() as conn:
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
                cur.close()

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
            return jsonify(history_jobs)
        except Exception as e:
            self.logger.error(f"Error fetching job history for user {current_user}: {e}")
            return jsonify({"error": "Failed to fetch job history"}), 500
    
    def delete_heatmap_job(self, job_id):
        """Delete a heatmap job."""
        current_user = get_jwt_identity()
        self.logger.info(f"User {current_user} attempting to delete job {job_id}")
        try:
            with get_db_connection_context() as conn:
                cur = conn.cursor()
                cur.execute("SELECT * FROM jobs WHERE job_id = %s AND \"user\" = %s", (job_id, current_user))
                job_row = cur.fetchone()
                if not job_row:
                    return jsonify({"error": "Job not found or not authorized"}), 404
                cur.execute("DELETE FROM jobs WHERE job_id = %s", (job_id,))
                conn.commit()
            results_folder = os.path.join(RESULTS_FOLDER, job_id)
            uploads_folder = os.path.join(UPLOAD_FOLDER, job_id)
            for folder in [results_folder, uploads_folder]:
                if os.path.exists(folder):
                    shutil.rmtree(folder)
            bucket = "projectresults"
            try:
                files = supabase.storage.from_(bucket).list(path=job_id)
                if files and isinstance(files, list):
                    for file in files:
                        file_path = f"{job_id}/{file['name']}"
                        supabase.storage.from_(bucket).remove(file_path)
            except Exception:
                pass
            self.logger.info(f"Successfully deleted job {job_id} for user {current_user}")
            return jsonify({"success": True, "message": "Heatmap job deleted."})
        except Exception as e:
            self.logger.error(f"Failed to delete job {job_id} for user {current_user}: {str(e)}")
            return jsonify({"error": f"Server error: {str(e)}"}), 500
    
    def cancel_heatmap_job(self, job_id):
        """Cancel a heatmap job."""
        current_user = get_jwt_identity()
        jobs = get_jobs_store()
        job = jobs.get(job_id)
        
        with get_db_connection_context() as conn:
            cur = conn.cursor()
            if job:
                job['cancelled'] = True
                cur.execute("UPDATE jobs SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP WHERE job_id = %s", ('cancelled', 'Job was cancelled by user.', job_id))
                conn.commit()
                return jsonify({"success": True, "message": "Job cancelled."})
            
            cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
            job_row = cur.fetchone()
            if not job_row:
                return jsonify({"error": "Job not found"}), 404
            
            status_index = 6 if not isinstance(job_row, dict) else 'status'
            if job_row[status_index] in ('completed', 'cancelled', 'error'):
                return jsonify({"success": True, "message": f"Job already {job_row[status_index]}."})
                
            cur.execute("UPDATE jobs SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP WHERE job_id = %s", ('cancelled', 'Job was cancelled by user.', job_id))
            conn.commit()

        return jsonify({"success": True, "message": "Job cancelled in DB."})
    
    def get_job_points(self, job_id):
        """Get points data for a job."""
        job_upload_folder = os.path.join(UPLOAD_FOLDER, job_id)
        points_filename = f"points_{job_id}.json"
        points_path = os.path.join(job_upload_folder, points_filename)
        if not os.path.exists(points_path):
            return jsonify({"error": "Points file not found for this job."}), 404
        try:
            with open(points_path, 'r') as f:
                points_data = json.load(f)
            return jsonify({"pointsData": points_data})
        except Exception as e:
            return jsonify({"error": f"Failed to read points file: {str(e)}"}), 500
    
    def get_job_time_range(self, job_id):
        """Get time range for a job."""
        with get_db_connection_context() as conn:
            cur = conn.cursor()
            cur.execute("SELECT start_datetime, end_datetime FROM jobs WHERE job_id = %s", (job_id,))
            job_row = cur.fetchone()
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
    
    def stream_ai_recommendations(self, job_id):
        """Stream AI-generated recommendations for a job."""
        current_user = get_jwt_identity()
        
        try:
            with get_db_connection_context() as conn:
                cur = conn.cursor()
                cur.execute("SELECT * FROM jobs WHERE job_id = %s AND \"user\" = %s", (job_id, current_user))
                job_row = cur.fetchone()
                cur.close()

            if not job_row:
                return jsonify({"error": "Job not found or not authorized"}), 404
            
            # Extract status - handle both dict and tuple formats
            status = job_row['status'] if isinstance(job_row, dict) else job_row[6]
            if status != 'completed':
                return jsonify({"error": "Job must be completed to generate recommendations"}), 400

            # Load detections and fps
            detections_data = download_json_from_supabase(f"{job_id}/detections.json")
            if not detections_data:
                return jsonify({"error": "Detections data not found for this job"}), 404
            
            detections = detections_data.get("detections", [])
            fps = detections_data.get("fps", 25)  # Default fps if not found

            # Get video dimensions for analysis
            try:
                # Try to get video dimensions from output_video_path
                output_video_path = job_row['output_video_path'] if isinstance(job_row, dict) else job_row[10] if len(job_row) > 10 else None
                if output_video_path and os.path.exists(output_video_path):
                    cap = cv2.VideoCapture(output_video_path)
                    if cap.isOpened():
                        video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                        cap.release()
                        floorplan_shape = (video_height, video_width)  # (height, width)
                    else:
                        floorplan_shape = (720, 1280)  # Default if video not accessible
                else:
                    floorplan_shape = (720, 1280)  # Default if video not accessible
            except Exception as e:
                self.logger.warning(f"Could not determine video dimensions for job {job_id}: {e}. Using default.")
                floorplan_shape = (720, 1280)  # Default to 720p

            # A dummy heatmap data for analyze_heatmap. We only care about areas, total_visitors, peak_hours
            # which are derived from detections
            dummy_heatmap = np.zeros(floorplan_shape, dtype=np.uint8)
            
            analysis_results = analyze_heatmap(dummy_heatmap, floorplan_shape, detections=detections, fps=fps)
            areas = analysis_results['areas']
            total_visitors = analysis_results['total_visitors']
            peak_hours = analysis_results['peak_hours']

            def generate():
                yield 'event: start\n'
                yield 'data: {"status": "started"}\n\n'
                
                full_response_content = ""
                try:
                    for chunk in generate_ai_recommendations_stream(areas, total_visitors, peak_hours):
                        full_response_content += chunk
                        # Send each chunk as a separate data event
                        yield f"data: {json.dumps({'chunk': chunk})}\n\n"

                    # After all chunks are received, parse the full response as JSON array
                    # and send final recommendations
                    parsed_recommendations = self._parse_final_recommendations(full_response_content)
                    for rec in parsed_recommendations:
                        yield f"data: {json.dumps({'recommendation': rec})}\n\n"
                    
                    yield 'event: end\n'
                    yield 'data: {"status": "completed"}\n\n'
                except Exception as e:
                    self.logger.error(f"Streaming AI recommendations failed for job {job_id}: {e}")
                    yield 'event: error\n'
                    yield f'data: {json.dumps({"error": str(e)})}\n\n'
                    yield 'event: end\n'
                    yield 'data: {"status": "completed"}\n\n'

            return Response(stream_with_context(generate()), mimetype='text/event-stream')

        except Exception as e:
            self.logger.error(f"Error in stream_ai_recommendations endpoint for job {job_id}: {e}")
            return jsonify({"error": f"Server error: {str(e)}"}), 500


# Create handler instance
jobs_handler = JobsHandler()

# Register routes
@jobs_bp.route('/heatmap_jobs', methods=['POST', 'OPTIONS'])
@cross_origin()
@jwt_required()
def create_heatmap_job():
    return jobs_handler.create_heatmap_job()

@jobs_bp.route('/heatmap_jobs/<job_id>/status', methods=['GET'])
def get_job_status(job_id):
    return jobs_handler.get_job_status(job_id)

@jobs_bp.route('/heatmap_jobs/<job_id>/result/video', methods=['GET'])
def get_processed_video(job_id):
    return jobs_handler.get_processed_video(job_id)

@jobs_bp.route('/heatmap_jobs/history', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def get_job_history():
    return jobs_handler.get_job_history()

@jobs_bp.route('/heatmap_jobs/<job_id>', methods=['DELETE'])
@jwt_required()
def delete_heatmap_job(job_id):
    return jobs_handler.delete_heatmap_job(job_id)

@jobs_bp.route('/heatmap_jobs/<job_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_heatmap_job(job_id):
    return jobs_handler.cancel_heatmap_job(job_id)

@jobs_bp.route('/heatmap_jobs/<job_id>/points', methods=['GET'])
@jwt_required()
def get_job_points(job_id):
    return jobs_handler.get_job_points(job_id)

@jobs_bp.route('/heatmap_jobs/<job_id>/time_range', methods=['GET'])
@jwt_required()
def get_job_time_range(job_id):
    return jobs_handler.get_job_time_range(job_id)

@jobs_bp.route('/heatmap_jobs/<job_id>/recommendations/stream', methods=['GET'])
@cross_origin()
@jwt_required()
def stream_ai_recommendations(job_id):
    return jobs_handler.stream_ai_recommendations(job_id)
