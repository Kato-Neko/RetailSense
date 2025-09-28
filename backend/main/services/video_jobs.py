import os
import json
import cv2
import signal
import time
from typing import Callable, Dict, Any

from ..core.config import logger, UPLOAD_FOLDER, RESULTS_FOLDER
from ..core.db import get_db_connection
from ..core.storage import upload_json_to_supabase, upload_image_to_supabase
from ..helpers.files import validate_video_file
from .tracking import detect_and_track
from .heatmap_processing import blend_heatmap
from .state import get_jobs_store


def update_job_status_in_db(job_id: str, job: Dict[str, Any]):
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


def update_job_progress(job_id: str, stage: str, progress: float):
    jobs = get_jobs_store()
    job = jobs[job_id]
    job['message'] = f'{stage} ({int(progress * 100)}%)'
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


def process_video_job(job_id: str):
    jobs = get_jobs_store()
    try:
        job = jobs[job_id]
        job['status'] = 'processing'
        job['message'] = 'Starting video processing...'
        job['cancelled'] = job.get('cancelled', False)

        video_path = job['input_files']['video']
        floorplan_path = job['input_files']['floorplan']
        points_path = job['input_files']['points']
        with open(points_path, 'r') as f:
            _ = json.load(f)
        cap = validate_video_file(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        duration = total_frames / fps if fps > 0 else 0
        cap.release()

        # Check video duration and reject if too long
        max_duration_minutes = 10  # 10 minutes max for Railway hobby plan
        if duration > max_duration_minutes * 60:
            raise Exception(f"Video too long ({duration/60:.1f} minutes). Maximum allowed: {max_duration_minutes} minutes.")
        
        logger.info(f"Processing video: {total_frames} frames, {duration:.1f}s, {fps} fps")

        if job.get('cancelled'):
            job['status'] = 'cancelled'
            job['message'] = 'Job was cancelled by user.'
            update_job_status_in_db(job_id, job)
            return

        job['message'] = 'Running YOLO detection (0%)'
        output_video_path, detections, fps = detect_and_track(
            video_path,
            job['output_files_expected']['video'],
            progress_callback=lambda p: update_job_progress(job_id, 'YOLO detection', p),
            preview_folder=job['output_files_expected']['image'] and os.path.dirname(job['output_files_expected']['image']),
            cancelled_flag=lambda: job.get('cancelled', False)
        )

        if job.get('cancelled'):
            job['status'] = 'cancelled'
            job['message'] = 'Job was cancelled by user.'
            update_job_status_in_db(job_id, job)
            return

        detections_data = {"fps": fps, "detections": detections}
        upload_json_to_supabase(
            detections_data,
            f"{job_id}/detections.json"
        )

        output_heatmap_image_path = job['output_files_expected']['image']
        blended_img = blend_heatmap(
            detections,
            floorplan_path,
            None,
            output_video_path,
            video_path,
            return_image=True
        )
        upload_image_to_supabase(
            blended_img,
            f"{job_id}/video_heatmap.jpg"
        )

        if job.get('cancelled'):
            job['status'] = 'cancelled'
            job['message'] = 'Job was cancelled by user.'
            update_job_status_in_db(job_id, job)
            return

        job['message'] = 'Processing completed successfully'
        job['status'] = 'completed'

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            UPDATE jobs 
            SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP, output_heatmap_path = %s, output_video_path = %s
            WHERE job_id = %s
        ''', (job['status'], job['message'], output_heatmap_image_path, output_video_path, job_id))
        cur.close()
        conn.commit()
        conn.close()

    except Exception as e:
        job = jobs.get(job_id, {})
        job['status'] = 'error'
        job['message'] = f'Error during processing: {str(e)}'
        _update_db_error(job_id, job)
        logger.error(f"Error processing job {job_id}: {str(e)}", exc_info=True)


def _update_db_error(job_id: str, job: Dict[str, Any]):
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


def run_custom_heatmap_job(job_id: str, start_time: float, end_time: float, set_progress: Callable[[float], None]):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
    job_row = cur.fetchone()
    cur.close()
    conn.close()
    if not job_row or job_row[6] != 'completed':
        set_progress(1.0)
        return

    from core.storage import download_json_from_supabase
    det_data = download_json_from_supabase(f"{job_id}/detections.json")
    if det_data is None:
        set_progress(1.0)
        return
    detections = det_data.get("detections", [])
    fps = det_data.get("fps")

    filtered_detections = [
        det for det in detections
        if 'timestamp' in det and start_time <= det['timestamp'] <= end_time
    ]

    floorplan_path = os.path.join(UPLOAD_FOLDER, job_id, job_row[3])

    def progress_callback(progress: float):
        set_progress(progress)

    blended_img = blend_heatmap(
        filtered_detections,
        floorplan_path,
        None,
        os.path.join(RESULTS_FOLDER, job_id, f"video_{job_id}.mp4"),
        os.path.join(UPLOAD_FOLDER, job_id, job_row[2]),
        progress_callback=progress_callback,
        return_image=True
    )
    upload_image_to_supabase(
        blended_img,
        f"{job_id}/custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}.jpg"
    )
    set_progress(1.0)
