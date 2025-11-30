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
        
        # Load model with CPU optimizations
        # The model will be pre-downloaded during Docker build
        _model = YOLO('yolov8n.pt')
        
        # Optimize model for CPU inference
        _model.model.eval()  # Set to evaluation mode
        torch.set_num_threads(1)  # Use single thread for better performance on small instances
        
        logger.info("YOLO model loaded and optimized for CPU inference")
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
        # Ensure height is even (some codecs require this)
        if height % 2 != 0:
            height += 1
    else:
        width = original_width
        height = original_height
        scale_factor = 1.0

    logger.info(f"Processing video: {original_width}x{original_height} -> {width}x{height} (scale: {scale_factor:.4f})")
    logger.info(f"Coordinate scaling: multiply by {1.0/scale_factor:.4f} to get original coordinates")
    logger.info(f"Output video will be at ORIGINAL resolution: {original_width}x{original_height} for better bounding box visibility")

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    # Write output at ORIGINAL resolution so bounding boxes are clearly visible
    out = cv2.VideoWriter(output_path, fourcc, fps, (original_width, original_height))

    detections_for_heatmap: List[Dict[str, Any]] = []
    frame_count = 0
    processed_frames = 0  # Track actually processed frames
    frame_skip = 1  # Process EVERY frame for accurate bounding box detection
    
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
        
        # Determine if we should process this frame for detection
        should_process = (frame_count % frame_skip == 0)
        
        # Prepare frame for output (use original resolution for better visibility)
        if scale_factor != 1.0:
            frame_resized = cv2.resize(frame, (width, height))
            frame_for_output = frame.copy()  # Keep original for drawing boxes
        else:
            frame_resized = frame.copy()
            frame_for_output = frame.copy()
        
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
                # YOLO inference - run on RESIZED frame for consistency
                # YOLO will automatically resize internally, but we use resized frame for coordinate consistency
                results = model(frame_resized, 
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

            # Process detections - these are in RESIZED frame coordinates
            detections = []
            total_detections = 0
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = float(box.conf[0])
                    total_detections += 1
                    if conf > 0.3:
                        # Clamp to resized frame bounds
                        x1 = max(0, min(x1, width - 1))
                        y1 = max(0, min(y1, height - 1))
                        x2 = max(0, min(x2, width - 1))
                        y2 = max(0, min(y2, height - 1))
                        # Ensure valid box
                        if x2 > x1 and y2 > y1:
                            detections.append(([x1, y1, x2, y2], conf, 0))

            # Debug logging for first few processed frames
            if processed_frames <= 3:
                logger.info(f"YOLO found {total_detections} total detections, {len(detections)} above threshold in processed frame {processed_frames}")
                if detections:
                    logger.info(f"Sample detection bbox (resized): {detections[0][0]}, conf: {detections[0][1]:.3f}")
                else:
                    logger.warning(f"No detections above threshold (0.3) in frame {processed_frames}")

            # Update tracks - use resized frame for consistency
            try:
                tracks = tracker.update_tracks(detections, frame=frame_resized)
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
                
                # Ensure valid bounding box (x1 < x2, y1 < y2) in resized coordinates
                if x1 > x2:
                    x1, x2 = x2, x1
                if y1 > y2:
                    y1, y2 = y2, y1
                
                # Clamp to resized frame bounds first
                x1 = max(0, min(x1, width - 1))
                y1 = max(0, min(y1, height - 1))
                x2 = max(0, min(x2, width - 1))
                y2 = max(0, min(y2, height - 1))
                
                # Ensure minimum size in resized space
                if x2 <= x1:
                    x2 = x1 + 1
                if y2 <= y1:
                    y2 = y1 + 1

                # Scale coordinates back to original size for drawing on original frame
                # Use separate scale factors for X and Y to handle aspect ratio correctly
                if scale_factor != 1.0:
                    # Calculate scale factors for both dimensions
                    # This handles cases where width and height scale differently
                    scale_x = original_width / width
                    scale_y = original_height / height
                    
                    # Scale coordinates using the correct scale factors
                    x1_orig = int(round(x1 * scale_x))
                    y1_orig = int(round(y1 * scale_y))
                    x2_orig = int(round(x2 * scale_x))
                    y2_orig = int(round(y2 * scale_y))
                    
                    # Debug logging for first few detections
                    if processed_frames <= 3 and len(detections_for_heatmap) <= 3:
                        logger.info(f"Scaling: resized ({x1}, {y1}, {x2}, {y2}) -> "
                                  f"original ({x1_orig}, {y1_orig}, {x2_orig}, {y2_orig}) "
                                  f"using scale_x={scale_x:.3f}, scale_y={scale_y:.3f}")
                else:
                    x1_orig, y1_orig, x2_orig, y2_orig = x1, y1, x2, y2
                
                # Clamp to original video dimensions (critical for preventing out-of-frame boxes)
                x1_orig = max(0, min(x1_orig, original_width - 1))
                y1_orig = max(0, min(y1_orig, original_height - 1))
                x2_orig = max(0, min(x2_orig, original_width - 1))
                y2_orig = max(0, min(y2_orig, original_height - 1))
                
                # Ensure minimum size and valid box in original space
                if x2_orig <= x1_orig:
                    x2_orig = min(x1_orig + 1, original_width - 1)
                if y2_orig <= y1_orig:
                    y2_orig = min(y1_orig + 1, original_height - 1)
                
                # Final validation - ensure box is within frame bounds
                if (x1_orig >= original_width or y1_orig >= original_height or 
                    x2_orig < 0 or y2_orig < 0 or 
                    x1_orig >= x2_orig or y1_orig >= y2_orig):
                    if processed_frames <= 5:
                        logger.warning(f"Frame {frame_count}: Skipping invalid box for track {track_id}: "
                                     f"({x1_orig}, {y1_orig}) to ({x2_orig}, {y2_orig}) on {original_width}x{original_height}")
                    continue  # Skip this detection if coordinates are invalid

                detections_for_heatmap.append({
                    'frame': frame_count,
                    'bbox': [x1_orig, y1_orig, x2_orig, y2_orig],
                    'track_id': track_id,
                    'timestamp': timestamp
                })
                
                # Enhanced debug logging for first few detections
                if processed_frames <= 3 and len(detections_for_heatmap) <= 5:
                    logger.info(f"Track {track_id}: bbox (original) [{x1_orig}, {y1_orig}, {x2_orig}, {y2_orig}], "
                              f"center=({(x1_orig+x2_orig)/2:.1f}, {(y1_orig+y2_orig)/2:.1f}), "
                              f"bottom=({(x1_orig+x2_orig)/2:.1f}, {y2_orig})")

                # Draw bounding box and ID on ORIGINAL resolution frame
                # Use original coordinates (x1_orig, y1_orig, x2_orig, y2_orig)
                box_color = (0, 255, 0)  # Green
                box_thickness = 3
                
                cv2.rectangle(frame_for_output, 
                             (x1_orig, y1_orig), 
                             (x2_orig, y2_orig), 
                             box_color, 
                             box_thickness)
                
                # Draw track ID with background
                text = f"ID: {track_id}"
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.7
                text_thickness = 2
                (text_width, text_height), baseline = cv2.getTextSize(text, font, font_scale, text_thickness)
                
                # Background rectangle for text
                cv2.rectangle(frame_for_output, 
                             (x1_orig, y1_orig - text_height - baseline - 5), 
                             (x1_orig + text_width, y1_orig), 
                             (0, 0, 0), 
                             -1)
                
                # Text
                cv2.putText(frame_for_output, 
                           text, 
                           (x1_orig, y1_orig - baseline - 2),
                           font, 
                           font_scale, 
                           (255, 255, 255), 
                           text_thickness)

                # Draw center dot (feet position for heatmap)
                center_x_orig = int((x1_orig + x2_orig) / 2)
                center_y_orig = y2_orig  # Bottom center (feet)
                cv2.circle(frame_for_output, (center_x_orig, center_y_orig), 5, (0, 0, 255), -1)
                
                # Enhanced debug logging
                if processed_frames <= 5:
                    logger.info(f"Frame {frame_count}: Drawing box for Track {track_id} at "
                              f"({x1_orig}, {y1_orig}) to ({x2_orig}, {y2_orig}) "
                              f"on frame size {frame_for_output.shape}")

            # Write the annotated frame to output video at ORIGINAL resolution
            out.write(frame_for_output)

            # Save preview
            if preview_folder and processed_frames % 2 == 0:  # Every 2nd processed frame
                os.makedirs(preview_folder, exist_ok=True)
                preview_path = os.path.join(preview_folder, 'preview_detections.jpg')
                cv2.imwrite(preview_path, frame_resized)

        # For frames that weren't processed, still write them to output at original resolution
        if not should_process:
            out.write(frame)
        
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

    cap.release()
    out.release()
    
    logger.info(f"Video processing completed: {frame_count} frames read, {processed_frames} processed")
    return output_path, detections_for_heatmap, fps