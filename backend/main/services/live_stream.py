"""
Live stream processing service for RTSP camera feeds.
"""

import os
import cv2
import logging
import time
import threading
import json
from typing import Optional, Callable, Dict, Any, List
from datetime import datetime

from ..core.config import UPLOAD_FOLDER, RESULTS_FOLDER
from ..core.db import get_db_connection
from ..core.storage import upload_json_to_supabase, upload_image_to_supabase, upload_video_to_supabase
from .tracking import _get_model, _get_tracker
from .state import get_jobs_store


class LiveStreamProcessor:
    logger = logging.getLogger(__name__)

    """Processes RTSP stream and performs real-time detection/tracking"""
    
    def __init__(self, rtsp_url: str, job_id: str, camera_name: str, floorplan_path: Optional[str] = None, points_path: Optional[str] = None):
        self.rtsp_url = rtsp_url
        self.job_id = job_id
        self.camera_name = camera_name
        self.floorplan_path = floorplan_path
        self.points_path = points_path
        self.is_running = False
        self.detections_buffer = []
        self.frame_count = 0
        self.fps = 25  # Default FPS
        self.cap = None
        self.thread = None
        self.model = None
        self.tracker = None
        self.latest_frame = None
        self.latest_frame_lock = threading.Lock()
        self.last_heatmap_update = time.time()
        self.last_frame_time = None # To be exposed in status
        self.heatmap_update_interval = 60  # seconds

        # --- Event-based recording attributes ---
        self.is_recording = False
        self.video_writer = None
        self.last_detection_time = None
        self.inactivity_timeout = 15  # seconds to wait after last detection before stopping recording
        self.current_clip_path = None
        
    def start(self, detection_callback: Optional[Callable] = None):
        """Start processing RTSP stream"""
        if self.is_running:
            self.logger.warning(f"Stream {self.job_id} is already running")
            return False
            
        self.is_running = True
        self.thread = threading.Thread(target=self._process_stream, args=(detection_callback,))
        self.thread.daemon = True
        self.thread.start()
        self.logger.info(f"Started live stream processing for job {self.job_id}")
        return True
        
    def stop(self):
        """Stop processing RTSP stream"""
        self.is_running = False
        if self.cap:
            self.cap.release()
            self.cap = None
        
        # --- MODIFICATION: Trigger a single final update on stop ---
        self.logger.info(f"Executing final save and heatmap update for job {self.job_id}...")
        self._save_detections_batch()  # Save any remaining detections
        
        if self.is_recording:
            self._stop_recording() # Finalize and upload any active recording

        self._update_heatmap()         # Generate and save the final heatmap
        self.logger.info(f"Stopped live stream processing for job {self.job_id}")
        
    def _process_stream(self, detection_callback: Optional[Callable]):
        """Main stream processing loop"""
        try:
            # Initialize model and tracker
            self.model = _get_model()
            self.tracker = _get_tracker()
            
            # Open RTSP stream
            self.logger.info(f"Attempting to open RTSP stream: {self.rtsp_url}")
            
            # Set RTSP transport options for better compatibility
            try:
                self.cap = cv2.VideoCapture(self.rtsp_url, cv2.CAP_FFMPEG)
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Minimize latency
                # Set timeout for RTSP connection
                self.cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)  # 10 second timeout
            except Exception as e:
                self.logger.error(f"Error creating VideoCapture: {e}")
                self.cap = None
            
            if not self.cap:
                error_msg = f"Failed to create VideoCapture for {self.rtsp_url}"
                self.logger.error(error_msg)
                self._update_status('error', error_msg)
                # Store error placeholder
                import numpy as np
                placeholder = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(placeholder, 'Failed to create capture', (50, 180), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                cv2.putText(placeholder, 'Check RTSP URL', (50, 220), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                with self.latest_frame_lock:
                    self.latest_frame = placeholder
                return
            
            # Give it a moment to connect
            time.sleep(1.0)  # Increased wait time
            
            if not self.cap.isOpened():
                error_msg = f"Failed to open RTSP stream: {self.rtsp_url}. This may be because Railway cannot access local network IPs."
                self.logger.error(error_msg)
                self.logger.warning("If using a local IP (192.168.x.x), Railway cloud cannot access it. Use a public IP or VPN tunnel.")
                self._update_status('error', 'Failed to connect to camera stream')
                # Store a placeholder frame with helpful message
                import numpy as np
                placeholder = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(placeholder, 'Connection Failed', (50, 180), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                cv2.putText(placeholder, 'RTSP URL not accessible', (50, 220), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                cv2.putText(placeholder, 'from cloud server', (50, 250), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                with self.latest_frame_lock:
                    self.latest_frame = placeholder
                return
                
            # Get stream properties
            self.fps = int(self.cap.get(cv2.CAP_PROP_FPS)) or 25
            width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            
            self.logger.info(f"Stream opened successfully: {width}x{height} @ {self.fps}fps")
            self._update_status('live', f'Streaming from {self.camera_name}')
            
            # Read first frame immediately to populate latest_frame
            ret, first_frame = self.cap.read()
            if ret and first_frame is not None:
                with self.latest_frame_lock:
                    self.latest_frame = first_frame.copy()
                self.logger.info("First frame captured successfully")
                
                # Extract first frame for floorplan if needed
                if not self.floorplan_path:
                    self._save_first_frame(first_frame)
            else:
                self.logger.warning("Failed to read first frame from stream")
                # Store placeholder
                import numpy as np
                placeholder = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(placeholder, 'Reading frames...', (50, 200), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                with self.latest_frame_lock:
                    self.latest_frame = placeholder
            
            frame_skip = 5  # Process every 5th frame for performance
            last_detection_save = time.time()
            self.last_frame_time = time.time() # Track time of the last successful frame read
            self.last_heatmap_update = time.time() # Reset heatmap timer on start
            
            while self.is_running:
                ret, frame = self.cap.read()
                if not ret:
                    # If no frame received for 10 seconds, assume stream is stalled
                    if time.time() - self.last_frame_time > 10:
                        self.logger.error("RTSP stream stalled. No frames received for 10 seconds. Stopping.")
                        self._update_status('error', 'Camera stream stalled or disconnected.')
                        break # Exit the processing loop
                    self.logger.warning("Failed to read frame from stream, retrying...")
                    time.sleep(0.1)
                    continue
                
                # Store latest frame for live feed
                with self.latest_frame_lock:
                    self.latest_frame = frame.copy()
                self.last_frame_time = time.time() # Update time of last successful frame read
                
                # Ensure floorplan exists: if missing, save current frame as floorplan
                if not self.floorplan_path or not os.path.exists(self.floorplan_path):
                    try:
                        self._save_first_frame(frame)
                    except Exception as e:
                        self.logger.warning(f"Deferred floorplan save failed: {e}")

                # Process every Nth frame
                # Note: We pass the original `frame` to the recording logic, not the resized one.
                # This ensures the saved clips are full quality.
                has_detections = False

                if self.frame_count % frame_skip == 0:
                    detections = self._detect_and_track_frame(frame, self.frame_count)
                    
                    if detections:
                        # Add timestamp to detections
                        current_time = time.time()
                        for det in detections:
                            det['timestamp'] = current_time
                            det['stream_time'] = self.frame_count / self.fps
                        
                        self.detections_buffer.extend(detections)
                        has_detections = True
                        
                        # Call callback if provided
                        if detection_callback:
                            try:
                                detection_callback(detections)
                            except Exception as e:
                                self.logger.error(f"Error in detection callback: {e}")
                        
                        # Save detections in batches
                        if len(self.detections_buffer) >= 100 or (time.time() - last_detection_save) > 10:
                            self._save_detections_batch()
                            last_detection_save = time.time()

                        # Periodically update the live heatmap
                        if time.time() - self.last_heatmap_update > self.heatmap_update_interval:
                            self._update_heatmap()
                            self.last_heatmap_update = time.time()
                
                # --- Event-based recording logic ---
                self._handle_recording(frame, has_detections)
                
                # If recording, write the frame. This happens for every frame, not just skipped ones.
                if self.is_recording and self.video_writer is not None:
                    try:
                        self.video_writer.write(frame)
                    except Exception as e:
                        self.logger.error(f"Error writing frame to video clip: {e}")
                
                self.frame_count += 1
                
                # Small delay to prevent CPU overload
                time.sleep(0.02) # Increased sleep time to improve stability and reduce memory pressure
                
        except Exception as e:
            self.logger.error(f"Error in stream processing: {e}", exc_info=True)
            self._update_status('error', f'Stream processing error: {str(e)}')
        finally:
            if self.cap:
                self.cap.release()
            if self.is_recording:
                self._stop_recording() # Ensure final clip is saved on unexpected exit
            self.is_running = False
            
    def _detect_and_track_frame(self, frame, frame_number: int) -> List[Dict[str, Any]]:
        """Run detection and tracking on a single frame"""
        try:
            # --- Add explicit check to prevent resize error on None frames ---
            if frame is None:
                self.logger.warning(f"Attempted to process a None frame at frame number {frame_number}. Skipping.")
                return []

            # --- FIX: Resize frame for performance and stability ---
            # High-resolution frames can cause crashes on resource-constrained environments.
            # We resize to a smaller width, maintaining aspect ratio, similar to video_jobs.
            max_width = 480  # A reasonable size for live processing
            original_height, original_width = frame.shape[:2]
            scale_factor = max_width / original_width
            resized_frame = cv2.resize(frame, (max_width, int(original_height * scale_factor)))
            # Run YOLO detection
            results = self.model(resized_frame, verbose=False, imgsz=max_width, conf=0.4)
            detections = []
            
            # Process detections (filter for persons only)
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    # Filter for person class (class 0 in COCO dataset)
                    if int(box.cls) == 0:  # Person class
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        # Scale bounding box back to original frame size
                        x1_orig, y1_orig, x2_orig, y2_orig = x1 / scale_factor, y1 / scale_factor, x2 / scale_factor, y2 / scale_factor

                        conf = float(box.conf[0].cpu().numpy())
                        
                        if conf > 0.25:  # Confidence threshold
                            detections.append({
                                'bbox': [float(x1_orig), float(y1_orig), float(x2_orig), float(y2_orig)],
                                'confidence': conf,
                                'frame': frame_number,
                            })
            
            # Update tracker
            if detections and self.tracker:
                # Convert to format expected by DeepSort: ([x1, y1, x2, y2], conf, class)
                tracker_detections = []
                for det in detections:
                    # Bbox for tracker should be on the RESIZED frame
                    x1, y1, x2, y2 = det['bbox']
                    tracker_detections.append(([int(x1 * scale_factor), int(y1 * scale_factor), int(x2 * scale_factor), int(y2 * scale_factor)], det['confidence'], 0))
                
                # Update tracker
                tracks = self.tracker.update_tracks(tracker_detections, frame=resized_frame)
                
                # Add track IDs to detections
                tracked_detections = []
                
                # Create a mapping from the tracker's output bbox to the original detection
                # The tracker's bbox is on the resized frame.
                detection_map = {
                    tuple(map(int, (d['bbox'][0]*scale_factor, d['bbox'][1]*scale_factor, d['bbox'][2]*scale_factor, d['bbox'][3]*scale_factor))): d 
                    for d in detections
                }

                for track in tracks:
                    if not track.is_confirmed():
                        continue
                    
                    # Find the original detection that corresponds to this track
                    # The tracker's to_ltrb() gives the bbox on the resized frame
                    track_bbox_resized = tuple(map(int, track.to_ltrb()))
                    
                    # Find the closest matching detection (simple approach)
                    # A more robust method would be to calculate IoU (Intersection over Union)
                    # but this direct lookup is often sufficient if bboxes are stable.
                    original_detection = detection_map.get(track_bbox_resized)
                    if original_detection:
                        original_detection['track_id'] = track.track_id
                        tracked_detections.append(original_detection)
                
                return tracked_detections if tracked_detections else detections # Return only tracked detections if any
            
            return detections
            
        except Exception as e:
            self.logger.error(f"Error in detection/tracking: {e}")
            return []

    def _handle_recording(self, frame, has_detections: bool):
        """Manages starting and stopping of event-based recording."""
        current_time = time.time()

        if has_detections:
            self.last_detection_time = current_time
            if not self.is_recording:
                # Detections found and we are not recording, so start.
                self._start_recording(frame.shape[1], frame.shape[0])
        
        elif self.is_recording:
            # No detections in this frame, check if timeout has been reached.
            if self.last_detection_time is None or (current_time - self.last_detection_time > self.inactivity_timeout):
                self._stop_recording()

    def _start_recording(self, width: int, height: int):
        """Initializes a new video clip recording."""
        if self.is_recording:
            return

        self.is_recording = True
        
        # Create a unique filename for the clip
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        clip_filename = f"clip_{timestamp}.mp4"
        
        # Define local path to save the clip
        job_results_folder = os.path.join(RESULTS_FOLDER, self.job_id)
        os.makedirs(job_results_folder, exist_ok=True)
        self.current_clip_path = os.path.join(job_results_folder, clip_filename)

        # Initialize VideoWriter
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        # Use a lower recording FPS to save space, as we only detect every N frames.
        # The effective FPS of the *content* is self.fps / frame_skip.
        record_fps = self.fps # Record at original stream FPS for smooth playback
        
        try:
            self.video_writer = cv2.VideoWriter(self.current_clip_path, fourcc, record_fps, (width, height))
            if not self.video_writer.isOpened():
                raise IOError("Could not open VideoWriter.")
            self.logger.info(f"Started recording new clip: {self.current_clip_path}")
        except Exception as e:
            self.logger.error(f"Failed to start recording: {e}")
            self.is_recording = False
            self.video_writer = None
            self.current_clip_path = None

    def _stop_recording(self):
        """Finalizes the current video clip and triggers upload."""
        if not self.is_recording:
            return

        self.is_recording = False
        if self.video_writer:
            self.video_writer.release()
            self.logger.info(f"Stopped recording clip: {self.current_clip_path}")

            # Upload the finished clip to Supabase in a background thread
            if self.current_clip_path and os.path.exists(self.current_clip_path):
                upload_thread = threading.Thread(target=upload_video_to_supabase, args=(self.current_clip_path, f"{self.job_id}/{os.path.basename(self.current_clip_path)}"))
                upload_thread.daemon = True
                upload_thread.start()
        
        self.video_writer = None
        self.current_clip_path = None
    
    def _save_first_frame(self, frame):
        """Save first frame as floorplan"""
        try:
            job_upload_folder = os.path.join(UPLOAD_FOLDER, self.job_id)
            os.makedirs(job_upload_folder, exist_ok=True)
            
            floorplan_filename = f"floorplan_{self.job_id}.jpg"
            floorplan_path = os.path.join(job_upload_folder, floorplan_filename)
            cv2.imwrite(floorplan_path, frame)
            
            # Upload to Supabase
            upload_image_to_supabase(frame, f"{self.job_id}/{floorplan_filename}")
            
            self.floorplan_path = floorplan_path
            self.logger.info(f"Saved first frame as floorplan: {floorplan_path}")
            
        except Exception as e:
            self.logger.error(f"Error saving first frame: {e}")
    
    def _save_detections_batch(self):
        """Save accumulated detections to Supabase"""
        if not self.detections_buffer:
            return
            
        try:
            # Get existing detections or create new
            from ..core.storage import download_json_from_supabase
            
            existing_path = f"{self.job_id}/live_detections.json"
            existing_data = download_json_from_supabase(existing_path)
            
            if existing_data:
                existing_detections = existing_data.get('detections', [])
                existing_detections.extend(self.detections_buffer)
                detections_data = {
                    'detections': existing_detections,
                    'fps': self.fps,
                    'last_updated': datetime.now().isoformat()
                }
            else:
                detections_data = {
                    'detections': self.detections_buffer,
                    'fps': self.fps,
                    'last_updated': datetime.now().isoformat()
                }
            
            upload_json_to_supabase(detections_data, existing_path)
            self.logger.info(f"Saved {len(self.detections_buffer)} detections to Supabase")
            
            # Clear buffer
            self.detections_buffer = []
            
        except Exception as e:
            self.logger.error(f"Error saving detections batch: {e}")
    
    def _update_heatmap(self):
        """Update heatmap from accumulated detections"""
        try:
            from ..core.storage import download_json_from_supabase, download_image_from_supabase
            from .heatmap_processing import create_custom_heatmap
            
            # Get all detections
            detections_path = f"{self.job_id}/live_detections.json"
            detections_data = download_json_from_supabase(detections_path)
            
            if not detections_data or not detections_data.get('detections'):
                return
            
            detections = detections_data['detections']
            
            # Get floorplan
            if not self.floorplan_path:
                floorplan_path = os.path.join(UPLOAD_FOLDER, self.job_id, f"floorplan_{self.job_id}.jpg")
            else:
                floorplan_path = self.floorplan_path
            
            if not os.path.exists(floorplan_path):
                # Try downloading from Supabase
                floorplan_img = download_image_from_supabase(f"{self.job_id}/floorplan_{self.job_id}.jpg")
                if floorplan_img is not None:
                    os.makedirs(os.path.dirname(floorplan_path), exist_ok=True)
                    cv2.imwrite(floorplan_path, floorplan_img)
                else:
                    self.logger.warning("No floorplan available for heatmap update")
                    return
            
            # Create heatmap
            if detections:
                blended_img = create_custom_heatmap(
                    detections,
                    floorplan_path,
                    dimensions=(1920, 1080)  # Default dimensions
                )
                
                if blended_img is not None:
                    # Upload to Supabase
                    upload_image_to_supabase(blended_img, f"{self.job_id}/live_heatmap.jpg")
                    self.logger.info(f"Generated and uploaded final live heatmap for job {self.job_id}")

                    # Mirror uploaded-job artifact behavior: persist a local image and update DB path
                    try:
                        results_dir = os.path.join(RESULTS_FOLDER, self.job_id)
                        os.makedirs(results_dir, exist_ok=True)
                        output_heatmap_image_path = os.path.join(results_dir, f"live_{self.job_id}_heatmap.jpg")
                        cv2.imwrite(output_heatmap_image_path, blended_img)

                        # Update DB output_heatmap_path to a stable, upload-style path
                        try:
                            conn = get_db_connection()
                            with conn.cursor() as cur:
                                # Use the absolute local path, consistent with video_jobs.py, and set video path to None
                                self.logger.info(f"Updating database for job {self.job_id} with heatmap path: {output_heatmap_image_path}")
                                cur.execute('''
                                    UPDATE jobs 
                                    SET output_heatmap_path = %s, output_video_path = NULL, updated_at = CURRENT_TIMESTAMP
                                    WHERE job_id = %s
                                ''', (output_heatmap_image_path, self.job_id))
                                conn.commit()
                                self.logger.info(f"Successfully updated output_heatmap_path for live job {self.job_id}")
                        except Exception as e_db:
                            self.logger.warning(f"Failed to update output_heatmap_path for live job {self.job_id}: {e_db}")
                    except Exception as e_local:
                        self.logger.warning(f"Failed to persist live heatmap locally for job {self.job_id}: {e_local}")
                    
        except Exception as e:
            self.logger.error(f"Error updating heatmap: {e}")
    
    def _update_status(self, status: str, message: str):
        """Update job status in database"""
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute('''
                UPDATE jobs 
                SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP
                WHERE job_id = %s
            ''', (status, message, self.job_id))
            conn.commit()
            cur.close()
            conn.close()
            
            # Also update in-memory store
            jobs = get_jobs_store()
            if self.job_id in jobs:
                jobs[self.job_id]['status'] = status
                jobs[self.job_id]['message'] = message
                
        except Exception as e:
            self.logger.error(f"Error updating status: {e}")


def get_live_job_processor(job_id: str) -> Optional[LiveStreamProcessor]:
    """Get the processor for a live job"""
    jobs = get_jobs_store()
    job = jobs.get(job_id)
    if job and 'processor' in job:
        return job['processor']
    return None


def get_latest_frame(job_id: str) -> Optional[bytes]:
    """Get the latest frame from a live stream as JPEG bytes"""
    processor = get_live_job_processor(job_id)
    if not processor:
        return None
    
    with processor.latest_frame_lock:
        if processor.latest_frame is None:
            return None
        
        # Encode frame as JPEG
        try:
            import cv2
            _, buffer = cv2.imencode('.jpg', processor.latest_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            return buffer.tobytes()
        except Exception as e:
            logging.getLogger(__name__).error(f"Error encoding frame: {e}")
            return None
