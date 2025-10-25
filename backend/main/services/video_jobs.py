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
    
    # Minimal logging: progress updates are silent to avoid log flooding
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('''
            UPDATE jobs 
            SET message = %s, updated_at = CURRENT_TIMESTAMP
            WHERE job_id = %s
        ''', (job['message'], job_id))
        conn.commit()
        # Minimal logging: suppress success spam for progress updates
    except Exception as e:
        logger.error(f"Error updating job {job_id} progress in database: {e}")
        conn.rollback()
    finally:
        cur.close()
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
        update_job_status_in_db(job_id, job)  # Update database with initial progress
        
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
        logger.info(f"DEBUG: Job {job_id} has {len(detections)} detections")
        logger.info(f"DEBUG: First few detections: {detections[:3] if detections else 'None'}")
        
        try:
            upload_json_to_supabase(
                detections_data,
                f"{job_id}/detections.json"
            )
            logger.info(f"Successfully uploaded detections.json to Supabase for job {job_id}")
        except Exception as e:
            logger.error(f"Error uploading detections.json to Supabase for job {job_id}: {e}")
            raise

        output_heatmap_image_path = job['output_files_expected']['image']
        
        # Log the expected output paths
        logger.info(f"Job {job_id} output paths:")
        logger.info(f"  - Expected heatmap path: {output_heatmap_image_path}")
        logger.info(f"  - Expected video path: {output_video_path}")
        
        # Load user points for homography transformation
        points_path = job['input_files']['points']
        with open(points_path, 'r') as f:
            points_data = json.load(f)
        
        # Convert points to the format expected by homography
        # points_data should be normalized coordinates (0-1), convert to pixel coordinates
        # Get video dimensions from the video file
        cap = cv2.VideoCapture(video_path)
        video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()
        
        # Convert normalized points to pixel coordinates
        homography_points = []
        for point in points_data:
            x = float(point['x']) * video_width
            y = float(point['y']) * video_height
            homography_points.append([x, y])
        
        logger.info(f"DEBUG: About to call blend_heatmap with {len(detections)} detections and {len(homography_points)} homography points")
        logger.info(f"DEBUG: Homography points: {homography_points}")
        
        blended_img = blend_heatmap(
            detections,
            floorplan_path,
            None,
            output_video_path,
            video_path,
            points=homography_points,
            return_image=True
        )
        
        if blended_img is None:
            logger.error(f"blend_heatmap returned None for job {job_id}")
            raise Exception("Failed to generate heatmap image")
        
        try:
            upload_image_to_supabase(
                blended_img,
                f"{job_id}/video_heatmap.jpg"
            )
            logger.info(f"Successfully uploaded heatmap image to Supabase for job {job_id}")
        except Exception as e:
            logger.error(f"Error uploading heatmap image to Supabase for job {job_id}: {e}")
            raise

        # Attempt to upload progressive heatmap video if it exists
        try:
            progressive_local_path = os.path.join(RESULTS_FOLDER, job_id, f"progressive_heatmap_{job_id}.mp4")
            if os.path.exists(progressive_local_path):
                from ..core.storage import upload_to_supabase_and_remove_local
                supabase_progressive_path = f"{job_id}/progressive_heatmap.mp4"
                upload_to_supabase_and_remove_local(
                    progressive_local_path,
                    supabase_progressive_path,
                    content_type="video/mp4"
                )
                logger.info(f"Uploaded progressive heatmap video to Supabase for job {job_id}")
            else:
                logger.info(f"Progressive video not found at {progressive_local_path}; skipping upload")
        except Exception as e:
            logger.warning(f"Failed uploading progressive video for job {job_id}: {e}")

        if job.get('cancelled'):
            job['status'] = 'cancelled'
            job['message'] = 'Job was cancelled by user.'
            update_job_status_in_db(job_id, job)
            return

        job['message'] = 'Processing completed successfully'
        job['status'] = 'completed'

        # Log the paths being saved to database
        logger.info(f"Job {job_id} completed. Saving paths to database:")
        logger.info(f"  - output_heatmap_path: {output_heatmap_image_path}")
        logger.info(f"  - output_video_path: {output_video_path}")

        conn = get_db_connection()
        cur = conn.cursor()
        try:
            # First, let's check if the job exists in the database
            cur.execute("SELECT job_id, status FROM jobs WHERE job_id = %s", (job_id,))
            existing_job = cur.fetchone()
            if existing_job:
                logger.info(f"Found existing job {job_id} with status: {existing_job[1]}")
            else:
                logger.error(f"Job {job_id} not found in database!")
                return
            
            cur.execute('''
                UPDATE jobs 
                SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP, output_heatmap_path = %s, output_video_path = %s
                WHERE job_id = %s
            ''', (job['status'], job['message'], output_heatmap_image_path, output_video_path, job_id))
            conn.commit()
            logger.info(f"Successfully updated job {job_id} in database with output paths")
            
            # Verify the update worked
            cur.execute("SELECT output_heatmap_path, output_video_path FROM jobs WHERE job_id = %s", (job_id,))
            updated_job = cur.fetchone()
            if updated_job:
                logger.info(f"Verified database update - heatmap_path: {updated_job[0]}, video_path: {updated_job[1]}")
            else:
                logger.error(f"Failed to verify database update for job {job_id}")
                
        except Exception as e:
            logger.error(f"Error updating job {job_id} in database: {e}")
            conn.rollback()
        finally:
            cur.close()
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

    from ..core.storage import download_json_from_supabase
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

    # Download floorplan from Supabase to local temp file
    from ..core.storage import download_image_from_supabase
    import cv2
    floorplan_filename = job_row[3]
    floorplan_supabase_path = f"{job_id}/{floorplan_filename}"
    
    logger.info(f"Downloading floorplan from Supabase: {floorplan_supabase_path}")
    floorplan_img = download_image_from_supabase(floorplan_supabase_path)
    if floorplan_img is None:
        logger.error(f"Failed to download floorplan from Supabase: {floorplan_supabase_path}")
        set_progress(1.0)
        return

    # Save floorplan to local temp file for blend_heatmap
    temp_dir = os.path.join(UPLOAD_FOLDER, job_id)
    os.makedirs(temp_dir, exist_ok=True)
    temp_floorplan_path = os.path.join(temp_dir, f"temp_{floorplan_filename}")

    try:
        write_success = cv2.imwrite(temp_floorplan_path, floorplan_img)
        if not write_success:
            # Fallback: try writing raw bytes from storage (safer if encoding mismatch)
            try:
                from ..core.storage import download_image_bytes_from_supabase
                raw_bytes = download_image_bytes_from_supabase(floorplan_supabase_path)
                if raw_bytes:
                    with open(temp_floorplan_path, 'wb') as bf:
                        bf.write(raw_bytes)
                    logger.info(f"Wrote floorplan temp file via raw bytes fallback: {temp_floorplan_path}")
                else:
                    logger.error(f"Fallback raw bytes download failed for: {floorplan_supabase_path}")
                    set_progress(1.0)
                    return
            except Exception as e:
                logger.error(f"Fallback write of floorplan failed: {e}")
                set_progress(1.0)
                return
        else:
            logger.info(f"Saved floorplan to temp file: {temp_floorplan_path}")
    except Exception as e:
        logger.error(f"Error saving floorplan to temp file: {e}")
        set_progress(1.0)
        return

    def progress_callback(progress: float):
        set_progress(progress)

    # Load points for homography transformation
    points_path = os.path.join(UPLOAD_FOLDER, job_id, f"points_{job_id}.json")
    if os.path.exists(points_path):
        with open(points_path, 'r') as f:
            points_data = json.load(f)
        
        # Get video dimensions from first detection bbox if available
        if filtered_detections and 'bbox' in filtered_detections[0]:
            bbox = filtered_detections[0]['bbox']
            # Assuming bbox coordinates are in video space
            video_width = max(bbox[0], bbox[2]) * 2  # Estimate from coordinates
            video_height = max(bbox[1], bbox[3]) * 2
        else:
            # Fallback to standard HD dimensions if no detections
            video_width = 1920
            video_height = 1080
            
        logger.info(f"Using dimensions for homography: {video_width}x{video_height}")
        
        homography_points = []
        for point in points_data:
            x = float(point['x']) * video_width
            y = float(point['y']) * video_height
            homography_points.append([x, y])
    else:
        homography_points = None

    from ..services.heatmap_processing import create_custom_heatmap
    
    # Get video dimensions from first detection or use HD default
    if filtered_detections and 'bbox' in filtered_detections[0]:
        bbox = filtered_detections[0]['bbox']
        dimensions = (max(bbox[0], bbox[2]) * 2, max(bbox[1], bbox[3]) * 2)
    else:
        dimensions = (1920, 1080)

    blended_img = create_custom_heatmap(
        filtered_detections,
        temp_floorplan_path,
        dimensions=dimensions,
        points=homography_points
    )
    upload_image_to_supabase(
        blended_img,
        f"{job_id}/custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}.jpg"
    )
    
    # Clean up temp floorplan file
    try:
        os.remove(temp_floorplan_path)
        logger.info(f"Cleaned up temp floorplan file: {temp_floorplan_path}")
    except Exception as e:
        logger.warning(f"Failed to clean up temp floorplan file: {e}")
    
    set_progress(1.0)
