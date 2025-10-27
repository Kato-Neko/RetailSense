"""
Live stream processing service for RTSP camera feeds.
"""

import os
import cv2
import time
import threading
import json
from typing import Optional, Callable, Dict, Any, List
from datetime import datetime

from ..core.config import logger, UPLOAD_FOLDER, RESULTS_FOLDER
from ..core.db import get_db_connection
from ..core.storage import upload_json_to_supabase, upload_image_to_supabase
from .tracking import _get_model, _get_tracker
from .state import get_jobs_store


class LiveStreamProcessor:
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
        self.heatmap_update_interval = 30  # Update heatmap every 30 seconds
        
    def start(self, detection_callback: Optional[Callable] = None):
        """Start processing RTSP stream"""
        if self.is_running:
            logger.warning(f"Stream {self.job_id} is already running")
            return False
            
        self.is_running = True
        self.thread = threading.Thread(target=self._process_stream, args=(detection_callback,))
        self.thread.daemon = True
        self.thread.start()
        logger.info(f"Started live stream processing for job {self.job_id}")
        return True
        
    def stop(self):
        """Stop processing RTSP stream"""
        self.is_running = False
        if self.cap:
            self.cap.release()
            self.cap = None
        logger.info(f"Stopped live stream processing for job {self.job_id}")
        
    def _process_stream(self, detection_callback: Optional[Callable]):
        """Main stream processing loop"""
        try:
            # Initialize model and tracker
            self.model = _get_model()
            self.tracker = _get_tracker()
            
            # Open RTSP stream
            logger.info(f"Attempting to open RTSP stream: {self.rtsp_url}")
            
            # Set RTSP transport options for better compatibility
            try:
                self.cap = cv2.VideoCapture(self.rtsp_url, cv2.CAP_FFMPEG)
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Minimize latency
                # Set timeout for RTSP connection
                self.cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)  # 10 second timeout
            except Exception as e:
                logger.error(f"Error creating VideoCapture: {e}")
                self.cap = None
            
            if not self.cap:
                error_msg = f"Failed to create VideoCapture for {self.rtsp_url}"
                logger.error(error_msg)
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
                logger.error(error_msg)
                logger.warning("If using a local IP (192.168.x.x), Railway cloud cannot access it. Use a public IP or VPN tunnel.")
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
            
            logger.info(f"Stream opened successfully: {width}x{height} @ {self.fps}fps")
            self._update_status('live', f'Streaming from {self.camera_name}')
            
            # Read first frame immediately to populate latest_frame
            ret, first_frame = self.cap.read()
            if ret and first_frame is not None:
                with self.latest_frame_lock:
                    self.latest_frame = first_frame.copy()
                logger.info("First frame captured successfully")
                
                # Extract first frame for floorplan if needed
                if not self.floorplan_path:
                    self._save_first_frame(first_frame)
            else:
                logger.warning("Failed to read first frame from stream")
                # Store placeholder
                import numpy as np
                placeholder = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(placeholder, 'Reading frames...', (50, 200), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                with self.latest_frame_lock:
                    self.latest_frame = placeholder
            
            frame_skip = 5  # Process every 5th frame for performance
            last_detection_save = time.time()
            
            while self.is_running:
                ret, frame = self.cap.read()
                if not ret:
                    logger.warning("Failed to read frame from stream, retrying...")
                    time.sleep(0.1)
                    continue
                
                # Store latest frame for live feed
                with self.latest_frame_lock:
                    self.latest_frame = frame.copy()
                
                # Process every Nth frame
                if self.frame_count % frame_skip == 0:
                    detections = self._detect_and_track_frame(frame, self.frame_count)
                    
                    if detections:
                        # Add timestamp to detections
                        current_time = time.time()
                        for det in detections:
                            det['timestamp'] = current_time
                            det['stream_time'] = self.frame_count / self.fps
                        
                        self.detections_buffer.extend(detections)
                        
                        # Call callback if provided
                        if detection_callback:
                            try:
                                detection_callback(detections)
                            except Exception as e:
                                logger.error(f"Error in detection callback: {e}")
                        
                        # Save detections in batches
                        if len(self.detections_buffer) >= 100 or (time.time() - last_detection_save) > 10:
                            self._save_detections_batch()
                            last_detection_save = time.time()
                    
                    # Update heatmap periodically
                    if (time.time() - self.last_heatmap_update) > self.heatmap_update_interval:
                        self._update_heatmap()
                        self.last_heatmap_update = time.time()
                
                self.frame_count += 1
                
                # Small delay to prevent CPU overload
                time.sleep(0.01)
                
        except Exception as e:
            logger.error(f"Error in stream processing: {e}", exc_info=True)
            self._update_status('error', f'Stream processing error: {str(e)}')
        finally:
            if self.cap:
                self.cap.release()
            self.is_running = False
            
    def _detect_and_track_frame(self, frame, frame_number: int) -> List[Dict[str, Any]]:
        """Run detection and tracking on a single frame"""
        try:
            # Run YOLO detection
            results = self.model(frame, verbose=False)
            detections = []
            
            # Process detections (filter for persons only)
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    # Filter for person class (class 0 in COCO dataset)
                    if int(box.cls) == 0:  # Person class
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        conf = float(box.conf[0].cpu().numpy())
                        
                        if conf > 0.25:  # Confidence threshold
                            detections.append({
                                'bbox': [float(x1), float(y1), float(x2), float(y2)],
                                'confidence': conf,
                                'frame': frame_number
                            })
            
            # Update tracker
            if detections and self.tracker:
                # Convert to format expected by DeepSort: ([x1, y1, x2, y2], conf, class)
                tracker_detections = []
                for det in detections:
                    bbox = det['bbox']
                    # Convert to integers as expected by tracker
                    tracker_detections.append(([int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])], det['confidence'], 0))  # Class 0 = person
                
                # Update tracker
                tracks = self.tracker.update_tracks(tracker_detections, frame=frame)
                
                # Add track IDs to detections
                tracked_detections = []
                track_index = 0
                for track in tracks:
                    if track.is_confirmed() and track_index < len(detections):
                        ltrb = track.to_ltrb()
                        tracked_detections.append({
                            'bbox': [float(ltrb[0]), float(ltrb[1]), float(ltrb[2]), float(ltrb[3])],
                            'confidence': detections[track_index]['confidence'],
                            'frame': frame_number,
                            'track_id': track.track_id
                        })
                        track_index += 1
                
                return tracked_detections if tracked_detections else detections
            
            return detections
            
        except Exception as e:
            logger.error(f"Error in detection/tracking: {e}")
            return []
    
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
            logger.info(f"Saved first frame as floorplan: {floorplan_path}")
            
        except Exception as e:
            logger.error(f"Error saving first frame: {e}")
    
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
            logger.info(f"Saved {len(self.detections_buffer)} detections to Supabase")
            
            # Clear buffer
            self.detections_buffer = []
            
        except Exception as e:
            logger.error(f"Error saving detections batch: {e}")
    
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
                    logger.warning("No floorplan available for heatmap update")
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
                    logger.info(f"Updated live heatmap for job {self.job_id}")
                    
        except Exception as e:
            logger.error(f"Error updating heatmap: {e}")
    
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
            logger.error(f"Error updating status: {e}")


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
            logger.error(f"Error encoding frame: {e}")
            return None

