import os
import json
import cv2
import time
import uuid
from typing import Callable, Dict, Any

from ..core.config import logger, UPLOAD_FOLDER, RESULTS_FOLDER
from ..core.db import get_db_connection_context
from ..core.storage import upload_json_to_supabase, upload_image_to_supabase, upload_to_supabase_and_remove_local, download_image_from_supabase, download_image_bytes_from_supabase
from ..helpers.files import validate_video_file
from .tracking import get_tracking_service
from .heatmap_processing import get_heatmap_processor
from .state import get_state_manager


class VideoJobProcessor:
    """Service for processing video jobs including detection, tracking, and heatmap generation."""
    
    def __init__(self, logger_instance=None):
        """Initialize the video job processor.
        
        Args:
            logger_instance: Optional logger instance (defaults to module logger)
        """
        self.logger = logger_instance or logger
        self.db_update_interval = 5  # seconds
        self._last_db_update_time: Dict[str, float] = {}
        self.tracking_service = get_tracking_service()
        self.heatmap_processor = get_heatmap_processor()
        self.state_manager = get_state_manager()
    
    def update_job_status_in_db(self, job_id: str, job: Dict[str, Any]):
        """Update job status in the database.
        
        Args:
            job_id: The job ID
            job: Dictionary containing job status and message
        """
        with get_db_connection_context() as conn:
            cur = conn.cursor()
            try:
                cur.execute('''
                    UPDATE jobs 
                    SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE job_id = %s
                ''', (job['status'], job['message'], job_id))
                conn.commit()  # Commit INSIDE the with block
            except Exception as e:
                self.logger.error(f"Error updating job {job_id} status: {e}")
                conn.rollback()
            finally:
                cur.close()
                # Connection is automatically returned to pool by context manager
    
    def update_job_progress(self, job_id: str, stage: str, progress: float):
        """Update job progress with throttling to prevent database spam.
        
        Args:
            job_id: The job ID
            stage: Current processing stage description
            progress: Progress value between 0.0 and 1.0
        """
        jobs = self.state_manager.get_jobs_store()
        job = jobs[job_id]
        job['message'] = f'{stage} ({int(progress * 100)}%)'
        
        # Time-based throttling to prevent database spam
        now = time.time()
        last_update = self._last_db_update_time.get(job_id, 0)
        
        # Do not update if the interval has not passed
        if now - last_update < self.db_update_interval:
            return

        with get_db_connection_context() as conn:
            cur = conn.cursor()
            try:
                cur.execute('''
                    UPDATE jobs 
                    SET message = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE job_id = %s
                ''', (job['message'], job_id))
                conn.commit()
                self._last_db_update_time[job_id] = now
            except Exception as e:
                self.logger.error(f"Error updating job {job_id} progress in database: {e}")
                conn.rollback()
            finally:
                cur.close()
    
    def process_video_job(self, job_id: str):
        """Process a video job: detection, tracking, and heatmap generation.
        
        Args:
            job_id: The job ID to process
        """
        jobs = self.state_manager.get_jobs_store()
        try:
            job = jobs[job_id]
            job['status'] = 'processing'
            job['message'] = 'Starting video processing...'
            job['cancelled'] = job.get('cancelled', False)

            video_path = job['input_files']['video']
            floorplan_path = job['input_files']['floorplan']
            
            # Validate video file and get its properties
            cap = validate_video_file(video_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = int(cap.get(cv2.CAP_PROP_FPS))
            duration = total_frames / fps if fps > 0 else 0
            video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()

            # Check video duration from environment variable, with a default
            max_duration_minutes = int(os.getenv('MAX_VIDEO_DURATION_MINUTES', 10))
            if duration > max_duration_minutes * 60:
                raise Exception(f"Video too long ({duration/60:.1f} minutes). Maximum allowed: {max_duration_minutes} minutes.")
            
            self.logger.info(f"Processing video: {total_frames} frames, {duration:.1f}s, {fps} fps")

            if job.get('cancelled'):
                job['status'] = 'cancelled'
                job['message'] = 'Job was cancelled by user.'
                self.update_job_status_in_db(job_id, job)
                return

            
            output_video_path, detections, fps = self.tracking_service.detect_and_track(
                video_path,
                job['output_files_expected']['video'],
                progress_callback=lambda p: self.update_job_progress(job_id, 'YOLO detection', p),
                preview_folder=job['output_files_expected']['image'] and os.path.dirname(job['output_files_expected']['image']),
                cancelled_flag=lambda: job.get('cancelled', False)
            )

            if job.get('cancelled'):
                job['status'] = 'cancelled'
                job['message'] = 'Job was cancelled by user.'
                self.update_job_status_in_db(job_id, job)
                return

            detections_data = {"fps": fps, "detections": detections}
            upload_json_to_supabase(detections_data, f"{job_id}/detections.json")

            output_heatmap_image_path = job['output_files_expected']['image']
            
            # Load user points for homography transformation
            points_path = job['input_files']['points']
            with open(points_path, 'r') as f:
                points_data = json.load(f)
            
            homography_points = [[p['x'], p['y']] for p in points_data]
            
            blended_img = self.heatmap_processor.blend_heatmap(
                detections,
                floorplan_path,
                None,
                output_video_path,
                video_path,
                points=homography_points,
                return_image=True
            )
            
            if blended_img is None:
                self.logger.error(f"blend_heatmap returned None for job {job_id}")
                raise Exception("Failed to generate heatmap image")
            
            try:
                upload_image_to_supabase(
                    blended_img,
                    f"{job_id}/video_heatmap.jpg"
                )
                self.logger.info(f"Successfully uploaded heatmap image to Supabase for job {job_id}")
            except Exception as e:
                self.logger.error(f"Error uploading heatmap image to Supabase for job {job_id}: {e}")
                raise

            # Attempt to upload progressive heatmap video if it exists
            try:
                progressive_local_path = os.path.join(RESULTS_FOLDER, job_id, f"progressive_heatmap_{job_id}.mp4")
                if os.path.exists(progressive_local_path):
                    supabase_progressive_path = f"{job_id}/progressive_heatmap.mp4"
                    upload_to_supabase_and_remove_local(
                        progressive_local_path,
                        supabase_progressive_path,
                        content_type="video/mp4"
                    )
                    self.logger.info(f"Uploaded progressive heatmap video to Supabase for job {job_id}")
                else:
                    self.logger.info(f"Progressive video not found at {progressive_local_path}; skipping upload")
            except Exception as e:
                self.logger.warning(f"Failed uploading progressive video for job {job_id}: {e}")

            if job.get('cancelled'):
                job['status'] = 'cancelled'
                job['message'] = 'Job was cancelled by user.'
                self.update_job_status_in_db(job_id, job)
                return

            job['message'] = 'Processing completed successfully'
            job['status'] = 'completed'

            # Log the paths being saved to database
            self.logger.info(f"Job {job_id} completed. Saving paths to database:")
            self.logger.info(f"  - output_heatmap_path: {output_heatmap_image_path}")
            self.logger.info(f"  - output_video_path: {output_video_path}")

            with get_db_connection_context() as conn:
                cur = conn.cursor()
                try:
                    # First, let's check if the job exists in the database
                    cur.execute("SELECT job_id, status FROM jobs WHERE job_id = %s", (job_id,))
                    existing_job = cur.fetchone()
                    if existing_job:
                        self.logger.info(f"Found existing job {job_id} with status: {existing_job[1]}")
                    else:
                        self.logger.error(f"Job {job_id} not found in database!")
                        return
                    
                    cur.execute('''
                        UPDATE jobs 
                        SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP, output_heatmap_path = %s, output_video_path = %s
                        WHERE job_id = %s
                    ''', (job['status'], job['message'], output_heatmap_image_path, output_video_path, job_id))
                    conn.commit()
                    self.logger.info(f"Successfully updated job {job_id} in database with output paths")
                    
                    # Verify the update worked
                    cur.execute("SELECT output_heatmap_path, output_video_path FROM jobs WHERE job_id = %s", (job_id,))
                    updated_job = cur.fetchone()
                    if updated_job:
                        self.logger.info(f"Verified database update - heatmap_path: {updated_job[0]}, video_path: {updated_job[1]}")
                    else:
                        self.logger.error(f"Failed to verify database update for job {job_id}")
                        
                except Exception as e:
                    self.logger.error(f"Error updating job {job_id} in database: {e}")
                    conn.rollback()
                finally:
                    cur.close()

        except Exception as e:
            job = jobs.get(job_id, {})
            job['status'] = 'error'
            job['message'] = f'Error during processing: {str(e)}'
            self._update_db_error(job_id, job)
            self.logger.error(f"Error processing job {job_id}: {str(e)}", exc_info=True)
    
    def _update_db_error(self, job_id: str, job: Dict[str, Any]):
        """Update database with error status for a job.
        
        Args:
            job_id: The job ID
            job: Dictionary containing job status and message
        """
        with get_db_connection_context() as conn:
            cur = conn.cursor()
            cur.execute('''
                UPDATE jobs 
                SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP
                WHERE job_id = %s
            ''', (job['status'], job['message'], job_id))
            conn.commit()
            cur.close()
    
    def run_custom_heatmap_job(self, job_id: str, start_time: float, end_time: float, set_progress: Callable[[float], None]):
        """Run a custom heatmap generation job for a specific time range.
        
        Args:
            job_id: The job ID
            start_time: Start time in seconds
            end_time: End time in seconds
            set_progress: Callback function to set progress (0.0 to 1.0)
        """
        try:
            self.logger.info(f"Starting custom heatmap generation for job {job_id}, time range: {start_time}-{end_time}")
            with get_db_connection_context() as conn:
                cur = conn.cursor()
                cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
                job_row = cur.fetchone()
                cur.close()
            if not job_row or job_row[6] != 'completed':
                self.logger.error(f"Job {job_id} not found or not completed")
                set_progress(1.0)
                return
        except Exception as e:
            self.logger.error(f"Error initializing custom heatmap job: {e}")
            import traceback
            self.logger.error(f"Traceback: {traceback.format_exc()}")
            set_progress(1.0)
            return

        try:
            from ..helpers.detections import get_detections_loader
            detections_loader = get_detections_loader()
            detections, fps = detections_loader.load_detections(job_id)

            if not detections or not fps:
                raise Exception(f"Could not load valid detections data for job {job_id}. The original job may have failed.")

            self.logger.info(f"Downloaded {len(detections)} total detections")

            filtered_detections = [
                det for det in detections
                if 'timestamp' in det and start_time <= det['timestamp'] <= end_time
            ]
        except Exception as e:
            self.logger.error(f"Error processing detections: {e}")
            import traceback
            self.logger.error(f"Traceback: {traceback.format_exc()}")
            set_progress(1.0)
            return

        self.logger.info(f"Filtered to {len(filtered_detections)} detections in range {start_time}-{end_time}")
        if not filtered_detections:
            self.logger.warning(f"No detections found in time range {start_time}-{end_time}. Cannot generate custom heatmap.")
            # No need to return, the process will just create a blank heatmap which is acceptable.

        # Download floorplan from Supabase to local temp file
        floorplan_filename = job_row[3]
        floorplan_supabase_path = f"{job_id}/{floorplan_filename}"
        
        self.logger.info(f"Downloading floorplan from Supabase: {floorplan_supabase_path}")
        floorplan_img = download_image_from_supabase(floorplan_supabase_path)
        if floorplan_img is None:
            self.logger.error(f"Failed to download floorplan from Supabase: {floorplan_supabase_path}")
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
                    raw_bytes = download_image_bytes_from_supabase(floorplan_supabase_path)
                    if raw_bytes:
                        with open(temp_floorplan_path, 'wb') as bf:
                            bf.write(raw_bytes)
                        self.logger.info(f"Wrote floorplan temp file via raw bytes fallback: {temp_floorplan_path}")
                    else:
                        self.logger.error(f"Fallback raw bytes download failed for: {floorplan_supabase_path}")
                        set_progress(1.0)
                        return
                except Exception as e:
                    self.logger.error(f"Fallback write of floorplan failed: {e}")
                    set_progress(1.0)
                    return
            else:
                self.logger.info(f"Saved floorplan to temp file: {temp_floorplan_path}")
        except Exception as e:
            self.logger.error(f"Error saving floorplan to temp file: {e}")
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
                
            self.logger.info(f"Using dimensions for homography: {video_width}x{video_height}")
            
            homography_points = []
            for point in points_data:
                x = float(point['x']) * video_width
                y = float(point['y']) * video_height
                homography_points.append([x, y])
        else:
            homography_points = None
        
        # Get video dimensions from first detection or use HD default
        if filtered_detections and 'bbox' in filtered_detections[0]:
            bbox = filtered_detections[0]['bbox']
            dimensions = (max(bbox[0], bbox[2]) * 2, max(bbox[1], bbox[3]) * 2)
        else:
            dimensions = (1920, 1080)

        try:
            self.logger.info(f"Creating custom heatmap with {len(filtered_detections)} detections")
            blended_img = self.heatmap_processor.create_custom_heatmap(
                filtered_detections,
                temp_floorplan_path,
                dimensions=dimensions,
                points=homography_points
            )
            self.logger.info(f"Custom heatmap generated successfully")
            
            # Generate unique identifiers for the filename
            timestamp = int(time.time())
            unique_id = str(uuid.uuid4())[:8]
            
            filename = f"{job_id}/custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}_{timestamp}_{unique_id}.jpg"
            self.logger.info(f"Uploading custom heatmap to Supabase: {filename}")
            upload_image_to_supabase(blended_img, filename)
            self.logger.info(f"Successfully uploaded custom heatmap to Supabase")
            
            # Store the identifiers AND construct the image URL in metadata
            from ..core.config_manager import get_config_manager
            config = get_config_manager()
            supabase_url = config.supabase_url
            project_id = supabase_url.split('https://')[-1].split('.supabase.co')[0]
            
            # Direct public URL to the custom heatmap
            image_url = f"https://{project_id}.supabase.co/storage/v1/object/public/projectresults/{filename}"
            
            jobs = self.state_manager.get_jobs_store()
            if job_id not in jobs:
                jobs[job_id] = {}
            jobs[job_id]['custom_heatmap_meta'] = {
                'timestamp': timestamp,
                'uuid': unique_id,
                'image_url': image_url,
                'filename': filename
            }
            self.logger.info(f"Stored metadata: timestamp={timestamp}, uuid={unique_id}, image_url={image_url}")
        except Exception as e:
            self.logger.error(f"Error creating/uploading custom heatmap: {e}")
            import traceback
            self.logger.error(f"Traceback: {traceback.format_exc()}")
        
        # Clean up temp floorplan file
        try:
            os.remove(temp_floorplan_path)
            self.logger.info(f"Cleaned up temp floorplan file: {temp_floorplan_path}")
        except Exception as e:
            self.logger.warning(f"Failed to clean up temp floorplan file: {e}")
        
        set_progress(1.0)


# Global instance
_video_job_processor = None


def get_video_job_processor() -> VideoJobProcessor:
    """Get the global video job processor instance."""
    global _video_job_processor
    if _video_job_processor is None:
        _video_job_processor = VideoJobProcessor()
    return _video_job_processor


# Legacy functions for backward compatibility
def update_job_status_in_db(job_id: str, job: Dict[str, Any]):
    """Legacy function for backward compatibility."""
    return get_video_job_processor().update_job_status_in_db(job_id, job)


def update_job_progress(job_id: str, stage: str, progress: float):
    """Legacy function for backward compatibility."""
    return get_video_job_processor().update_job_progress(job_id, stage, progress)


def process_video_job(job_id: str):
    """Legacy function for backward compatibility."""
    return get_video_job_processor().process_video_job(job_id)


def run_custom_heatmap_job(job_id: str, start_time: float, end_time: float, set_progress: Callable[[float], None]):
    """Legacy function for backward compatibility."""
    return get_video_job_processor().run_custom_heatmap_job(job_id, start_time, end_time, set_progress)
