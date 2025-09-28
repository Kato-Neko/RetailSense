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
        # Load model with CPU optimizations
        _model = YOLO('yolov8n.pt')
        # Don't use half precision on CPU - it's not supported
        # Instead, use float32 but with other optimizations
        logger.info("YOLO model loaded for CPU inference")
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

    # Resize frames for faster processing (max 320px width for maximum speed)
    max_width = 320
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
    frame_skip = 5  # Process every 5th frame for much faster processing
    
    # Report initial progress
    if progress_callback:
        progress_callback(0.0)
        logger.info(f"Starting video processing: {total_frames} frames (processing every {frame_skip}th frame)")
    
    logger.info(f"Video properties: {original_width}x{original_height}, {fps} fps, {total_frames} total frames")
    
    while cap.isOpened():
        if cancelled_flag is not None and cancelled_flag():
            logger.info("Processing cancelled by user")
            break
        ret, frame = cap.read()
        if not ret:
            logger.info(f"End of video reached at frame {frame_count}")
            break
        
        if frame is None:
            logger.error(f"Frame {frame_count} is None, skipping")
            continue
            
        # Skip frames for faster processing
        if frame_count % frame_skip != 0:
            frame_count += 1
            # Still write the frame to output video
            if scale_factor != 1.0:
                frame = cv2.resize(frame, (width, height))
            out.write(frame)
            continue
            
        timestamp = frame_count / fps  # seconds

        # Resize frame for processing
        if scale_factor != 1.0:
            frame = cv2.resize(frame, (width, height))

        # Log first few frames to debug
        if frame_count < 3:
            logger.info(f"Processing frame {frame_count + 1}, frame shape: {frame.shape}")
        
        import time
        start_time = time.time()
        
        try:
            # Optimize YOLO inference for CPU with smaller input size
            results = model(frame, 
                          classes=[0], 
                          verbose=False,
                          imgsz=416,  # Even smaller input size for faster CPU processing
                          conf=0.6,   # Slightly higher confidence threshold
                          iou=0.7,    # NMS IoU threshold
                          max_det=5,  # Fewer max detections for faster processing
                          device='cpu')  # Explicitly use CPU
        except Exception as e:
            logger.error(f"Error processing frame {frame_count} with YOLO: {e}")
            continue
        
        yolo_time = time.time() - start_time
        if frame_count < 3:
            logger.info(f"YOLO inference took {yolo_time:.2f} seconds for frame {frame_count + 1}")

        detections = []
        for r in results:
            boxes = r.boxes
            for box in boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                conf = float(box.conf[0])
                if conf > 0.5:  # Confidence threshold
                    detections.append(([x1, y1, x2, y2], conf, 0))  # 0 is class_id for person

        try:
            tracks = tracker.update_tracks(detections, frame=frame)
        except Exception as e:
            logger.error(f"Error updating tracks for frame {frame_count}: {e}")
            tracks = []

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

            # Draw bounding box and ID with better contrast
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

            # Add black background for text (ID)
            text = f"ID: {track_id}"
            (text_width, text_height), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
            cv2.rectangle(frame, (x1, y1-text_height-10), (x1+text_width, y1), (0, 0, 0), -1)
            cv2.putText(frame, text, (x1, y1-5),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)

            # Draw a small white dot at the center of the box
            center_x = int((x1 + x2) / 2)
            center_y = int((y1 + y2) / 2)
            cv2.circle(frame, (center_x, center_y), 4, (255, 255, 255), -1)

        # Write frame
        out.write(frame)
        # Save preview every 10 frames
        if preview_folder and frame_count % 10 == 0:
            os.makedirs(preview_folder, exist_ok=True)
            preview_path = os.path.join(preview_folder, 'preview_detections.jpg')
            cv2.imwrite(preview_path, frame)

        # Update progress - report more frequently for better user experience
        frame_count += 1
        
        # Always report progress for first few frames to debug
        if progress_callback and (frame_count <= 3 or frame_count % 5 == 0 or frame_count == total_frames):
            progress = frame_count / total_frames
            progress_callback(progress)
            logger.info(f"Processing frame {frame_count}/{total_frames} ({progress*100:.1f}%)")

    cap.release()
    out.release()
    return output_path, detections_for_heatmap, fps