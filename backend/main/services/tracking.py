"""
Tracking service: person detection (YOLOv8) and tracking (DeepSort).
"""

import os
import cv2
import numpy as np
from typing import Callable, Tuple, List, Dict, Any, Optional
from ..core.config import logger

# Lazy singletons for heavy models
_model = None
_tracker = None


def _get_model():
    global _model
    if _model is None:
        from ultralytics import YOLO
        import torch
        import os
        
        # Load model with CPU optimizations
        # The model will be pre-downloaded during Docker build
        _model = YOLO('yolov8n.pt')
        
        # Optimize model for CPU inference
        _model.model.eval()  # Set to evaluation mode
        
        # Use more threads if available (but cap at 4 to avoid overhead)
        # For Railway hobby plan (1 vCPU), this will typically be 1-2 threads
        cpu_count = os.cpu_count() or 1
        num_threads = min(cpu_count, 4)  # Cap at 4 to avoid thread overhead
        torch.set_num_threads(num_threads)
        
        logger.info(f"YOLO model loaded and optimized for CPU inference ({num_threads} threads)")
    return _model


def _get_tracker():
    global _tracker
    if _tracker is None:
        from deep_sort_realtime.deepsort_tracker import DeepSort
        _tracker = DeepSort(max_age=30)
    return _tracker


def detect_and_track(
    video_path: str,
    output_path: str,
    progress_callback: Optional[Callable[[float], None]] = None,
    preview_folder: Optional[str] = None,
    cancelled_flag: Optional[Callable[[], bool]] = None,
) -> Tuple[str, List[Dict[str, Any]], int]:
    """
    Run person detection and tracking on a video.

    Returns: (output_video_path, detections_for_heatmap, fps)
    """
    model = _get_model()
    tracker = _get_tracker()

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception(f"Error opening video file: {video_path}")
    
    logger.info(f"Successfully opened video file: {video_path}")

    # Get video properties
    original_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    original_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Resize frames for faster processing - more aggressive resizing
    max_width = 320  # Increased from 224 for better detection quality
    if original_width > max_width:
        scale_factor = max_width / original_width
        width = max_width
        height = int(original_height * scale_factor)
    else:
        width = original_width
        height = original_height
        scale_factor = 1.0

    logger.info(f"Processing video: {original_width}x{original_height} -> {width}x{height} (scale: {scale_factor:.2f})")

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    detections_for_heatmap: List[Dict[str, Any]] = []
    frame_count = 0
    processed_frames = 0  # Track actually processed frames
    frame_skip = 10  # Process every 10th frame (2x faster)
    
    # Calculate total frames that will be processed
    total_processed_frames = (total_frames + frame_skip - 1) // frame_skip
    
    # Report initial progress
    if progress_callback:
        progress_callback(0.0)
        logger.info(f"Starting video processing: {total_frames} total frames, will process {total_processed_frames} frames (every {frame_skip}th frame)")
    
    logger.info(f"Video properties: {original_width}x{original_height}, {fps} fps, {total_frames} total frames")
    
    # Warmup flag
    warmup_done = False
    
    while cap.isOpened():
        if cancelled_flag is not None and cancelled_flag():
            logger.info("Processing cancelled by user")
            break
            
        ret, frame = cap.read()
        if not ret:
            # Minimal logging: suppress per-run end-of-video frame log
            break
        
        if frame is None:
            logger.error(f"Frame {frame_count} is None, skipping")
            frame_count += 1
            continue
        
        # Always write frame to output video (resized)
        if scale_factor != 1.0:
            frame_resized = cv2.resize(frame, (width, height))
        else:
            frame_resized = frame.copy()
        out.write(frame_resized)
        
        # Determine if we should process this frame for detection
        should_process = (frame_count % frame_skip == 0)
        
        if should_process:
            processed_frames += 1
            
            # Warm up the model on the first processed frame
            if not warmup_done:
                logger.info("Warming up YOLO model with first frame...")
                try:
                    # Use smaller warmup frame for faster initialization
                    dummy_frame = cv2.resize(frame, (320, 320))
                    model(dummy_frame, verbose=False, imgsz=320, conf=0.4, device='cpu', half=False)
                    logger.info("Model warmup completed")
                    warmup_done = True
                except Exception as e:
                    logger.warning(f"Model warmup failed: {e}")
                    warmup_done = True
            
            timestamp = frame_count / fps  # seconds

            # Log first few processed frames
            if processed_frames <= 3:
                logger.info(f"Processing frame {frame_count + 1} (processed frame {processed_frames}), shape: {frame.shape}")
            
            import time
            start_time = time.time()
            
            try:
                # YOLO inference - optimized for speed
                results = model(frame, 
                              classes=[0], 
                              verbose=False,
                              imgsz=320,  # Smaller input size for faster inference
                              conf=0.4,   # Slightly lower confidence for better detection
                              iou=0.5,    # Lower IoU for faster NMS
                              max_det=5,  # Fewer max detections
                              device='cpu',
                              half=False) # Disable half precision on CPU
            except Exception as e:
                logger.error(f"Error processing frame {frame_count} with YOLO: {e}")
                frame_count += 1
                continue
            
            yolo_time = time.time() - start_time
            if processed_frames <= 3:
                logger.info(f"YOLO inference took {yolo_time:.2f} seconds for frame {frame_count + 1}")

            # Process detections
            detections = []
            total_detections = 0
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = float(box.conf[0])
                    total_detections += 1
                    if conf > 0.3:
                        detections.append(([x1, y1, x2, y2], conf, 0))

            # Debug logging for first few processed frames
            if processed_frames <= 3:
                logger.info(f"YOLO found {total_detections} total detections, {len(detections)} above threshold in processed frame {processed_frames}")

            # Update tracks
            try:
                tracks = tracker.update_tracks(detections, frame=frame)
            except Exception as e:
                logger.error(f"Error updating tracks for frame {frame_count}: {e}")
                tracks = []

            # Process tracks and draw
            for track in tracks:
                if not track.is_confirmed():
                    continue
                    
                track_id = track.track_id
                ltrb = track.to_ltrb()
                x1, y1, x2, y2 = map(int, ltrb)

                # Scale coordinates back to original size for heatmap
                if scale_factor != 1.0:
                    x1_orig = int(x1 / scale_factor)
                    y1_orig = int(y1 / scale_factor)
                    x2_orig = int(x2 / scale_factor)
                    y2_orig = int(y2 / scale_factor)
                else:
                    x1_orig, y1_orig, x2_orig, y2_orig = x1, y1, x2, y2

                detections_for_heatmap.append({
                    'frame': frame_count,
                    'bbox': [x1_orig, y1_orig, x2_orig, y2_orig],
                    'track_id': track_id,
                    'timestamp': timestamp
                })

                # Draw bounding box and ID
                cv2.rectangle(frame_resized, (x1, y1), (x2, y2), (0, 255, 0), 2)
                text = f"ID: {track_id}"
                (text_width, text_height), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
                cv2.rectangle(frame_resized, (x1, y1-text_height-10), (x1+text_width, y1), (0, 0, 0), -1)
                cv2.putText(frame_resized, text, (x1, y1-5),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)

                # Draw center dot
                center_x = int((x1 + x2) / 2)
                center_y = int((y1 + y2) / 2)
                cv2.circle(frame_resized, (center_x, center_y), 4, (255, 255, 255), -1)

            # Update the output video with the annotated frame
            out.write(frame_resized)

            # Save preview
            if preview_folder and processed_frames % 2 == 0:  # Every 2nd processed frame
                os.makedirs(preview_folder, exist_ok=True)
                preview_path = os.path.join(preview_folder, 'preview_detections.jpg')
                cv2.imwrite(preview_path, frame_resized)

        # Increment frame counter
        frame_count += 1
        
        # Update progress based on total frames processed (not just detection frames)
        if progress_callback:
            # Progress based on total frames read, not just processed
            progress = frame_count / total_frames
            
            # Report progress more frequently at the beginning
            should_report_progress = (
                frame_count <= 5 or  # First 5 frames
                frame_count % 10 == 0 or  # Every 10 frames
                frame_count == total_frames or  # Last frame
                should_process  # When we actually process a frame
            )
            
            if should_report_progress:
                progress_callback(progress)
                # Minimal logging: suppress frequent progress logs
            
            # Periodic memory cleanup for long videos
            if frame_count % 100 == 0:
                import gc
                gc.collect()

    # Explicitly release resources
    cap.release()
    out.release()
    cv2.destroyAllWindows()
    
    # Memory cleanup
    import gc
    del frame
    gc.collect()
    
    logger.info(f"Video processing completed: {frame_count} frames read, {processed_frames} processed")
    return output_path, detections_for_heatmap, fps