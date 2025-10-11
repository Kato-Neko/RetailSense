import os
import json
import cv2
from typing import Callable, Dict, Any

from ..core.config import logger
from ..core.database_manager import db_manager
from ..core.storage import upload_json_to_supabase, upload_image_to_supabase
from ..services.file_manager import file_manager
from ..services.job_manager import job_manager
from .tracking import detect_and_track
from .heatmap_processing import blend_heatmap


def update_job_status_in_db(job_id: str, job: Dict[str, Any]):
    """Update job status in database - legacy function."""
    db_manager.update_job_status(job_id, job['status'], job['message'])


def update_job_progress(job_id: str, stage: str, progress: float):
    """Update job progress - legacy function."""
    job_manager.update_job_progress(job_id, stage, progress)


def process_video_job(job_id: str):
    """Process a video job using the new service classes."""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            logger.error(f"Job {job_id} not found in memory")
            return
        
        job_manager.update_job(job_id, {
            'status': 'processing',
            'message': 'Starting video processing...',
            'cancelled': job.get('cancelled', False)
        })

        video_path = job['input_files']['video']
        floorplan_path = job['input_files']['floorplan']
        points_path = job['input_files']['points']
        
        # Validate files
        with open(points_path, 'r') as f:
            _ = json.load(f)
        cap = file_manager.validate_video_file(video_path)
        _ = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.release()

        if job_manager.is_job_cancelled(job_id):
            job_manager.update_job(job_id, {
                'status': 'cancelled',
                'message': 'Job was cancelled by user.'
            })
            db_manager.update_job_status(job_id, 'cancelled', 'Job was cancelled by user.')
            return

        job_manager.update_job(job_id, {'message': 'Running YOLO detection (0%)'})
        
        output_video_path, detections, fps = detect_and_track(
            video_path,
            job['output_files_expected']['video'],
            progress_callback=lambda p: job_manager.update_job_progress(job_id, 'YOLO detection', p),
            preview_folder=job['output_files_expected']['image'] and os.path.dirname(job['output_files_expected']['image']),
            cancelled_flag=lambda: job_manager.is_job_cancelled(job_id)
        )

        if job_manager.is_job_cancelled(job_id):
            job_manager.update_job(job_id, {
                'status': 'cancelled',
                'message': 'Job was cancelled by user.'
            })
            db_manager.update_job_status(job_id, 'cancelled', 'Job was cancelled by user.')
            return

        # Upload detections to Supabase
        detections_data = {"fps": fps, "detections": detections}
        upload_json_to_supabase(detections_data, f"{job_id}/detections.json")

        # Generate heatmap
        output_heatmap_image_path = job['output_files_expected']['image']
        blended_img = blend_heatmap(
            detections,
            floorplan_path,
            None,
            output_video_path,
            video_path,
            return_image=True
        )
        upload_image_to_supabase(blended_img, f"{job_id}/video_heatmap.jpg")

        if job_manager.is_job_cancelled(job_id):
            job_manager.update_job(job_id, {
                'status': 'cancelled',
                'message': 'Job was cancelled by user.'
            })
            db_manager.update_job_status(job_id, 'cancelled', 'Job was cancelled by user.')
            return

        # Complete job
        job_manager.complete_job(job_id, output_heatmap_image_path, output_video_path)

    except Exception as e:
        error_message = f'Error during processing: {str(e)}'
        job_manager.error_job(job_id, error_message)
        logger.error(f"Error processing job {job_id}: {str(e)}", exc_info=True)


def _update_db_error(job_id: str, job: Dict[str, Any]):
    """Legacy function for updating error status."""
    db_manager.update_job_status(job_id, job['status'], job['message'])


def run_custom_heatmap_job(job_id: str, start_time: float, end_time: float, set_progress: Callable[[float], None]):
    """Run custom heatmap generation for a specific time range."""
    job_data = db_manager.get_job_by_id(job_id)
    if not job_data or job_data['status'] != 'completed':
        set_progress(1.0)
        return

    from core.storage import download_json_from_supabase
    det_data = download_json_from_supabase(f"{job_id}/detections.json")
    if det_data is None:
        set_progress(1.0)
        return
    
    detections = det_data.get("detections", [])
    fps = det_data.get("fps")

    # Filter detections by time range
    filtered_detections = [
        det for det in detections
        if 'timestamp' in det and start_time <= det['timestamp'] <= end_time
    ]

    # Get file paths using file manager
    floorplan_filename = job_data['input_floorplan_name']
    video_filename = job_data['input_video_name']
    floorplan_path = os.path.join(file_manager.upload_folder, job_id, floorplan_filename)
    video_path = os.path.join(file_manager.upload_folder, job_id, video_filename)
    output_video_path = os.path.join(file_manager.results_folder, job_id, f"video_{job_id}.mp4")

    def progress_callback(progress: float):
        set_progress(progress)

    blended_img = blend_heatmap(
        filtered_detections,
        floorplan_path,
        None,
        output_video_path,
        video_path,
        progress_callback=progress_callback,
        return_image=True
    )
    
    upload_image_to_supabase(
        blended_img,
        f"{job_id}/custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}.jpg"
    )
    set_progress(1.0)
