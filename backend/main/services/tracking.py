"""
Tracking service: person detection (YOLOv8) and tracking (DeepSort).
"""

import os
import cv2
import numpy as np
from typing import Callable, Tuple, List, Dict, Any, Optional
from ..core.config import logger
from ..helpers.memory import MemoryMonitor, cleanup_memory_if_needed, log_memory_usage

# Lazy singletons for heavy models
_model = None
_tracker = None


def _get_model():
    global _model
    if _model is None:
        from ultralytics import YOLO
        _model = YOLO('yolov8n.pt')
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
    with MemoryMonitor("video_processing"):
        model = _get_model()
        tracker = _get_tracker()

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise Exception("Error opening video file")

        # Get video properties
        original_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        original_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        # Optimize: Resize frames for faster processing (max 480px width - even more aggressive)
        max_width = 480
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
        
        while cap.isOpened():
            if cancelled_flag is not None and cancelled_flag():
                break
            ret, frame = cap.read()
            if not ret:
                break
                
            # Skip frames for much faster processing
            if frame_count % frame_skip != 0:
                frame_count += 1
                continue
                
            timestamp = frame_count / fps

            # Resize frame for faster processing (even more aggressive)
            if scale_factor != 1.0:
                frame = cv2.resize(frame, (width, height))

            # Aggressive memory management - check every 10 frames
            if frame_count % 10 == 0:
                cleanup_memory_if_needed(60.0)  # Clean up at 60% memory usage
                log_memory_usage(f"frame {frame_count}")
                
                # Pause if memory is still too high
                import psutil
                if psutil.virtual_memory().percent > 80:
                    import time
                    logger.warning(f"Memory usage high ({psutil.virtual_memory().percent:.1f}%), pausing for cleanup...")
                    time.sleep(0.5)  # Pause for half a second

            results = model(frame, classes=[0], verbose=False)  # class 0 is person, disable verbose

            detections = []
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = float(box.conf[0])
                    if conf > 0.5:
                        detections.append(([x1, y1, x2, y2], conf, 0))

            tracks = tracker.update_tracks(detections, frame=frame)

            for track in tracks:
                if not track.is_confirmed():
                    continue
                track_id = track.track_id
                ltrb = track.to_ltrb()
                x1, y1, x2, y2 = map(int, ltrb)

                # Scale coordinates back to original size for heatmap
                if scale_factor != 1.0:
                    x1 = int(x1 / scale_factor)
                    y1 = int(y1 / scale_factor)
                    x2 = int(x2 / scale_factor)
                    y2 = int(y2 / scale_factor)

                detections_for_heatmap.append({
                    'frame': frame_count,
                    'bbox': [x1, y1, x2, y2],
                    'track_id': track_id,
                    'timestamp': timestamp
                })

                # Scale back for display
                if scale_factor != 1.0:
                    x1, y1, x2, y2 = map(int, [x1 * scale_factor, y1 * scale_factor, x2 * scale_factor, y2 * scale_factor])

                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                text = f"ID: {track_id}"
                (text_width, text_height), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
                cv2.rectangle(frame, (x1, y1 - text_height - 10), (x1 + text_width, y1), (0, 0, 0), -1)
                cv2.putText(frame, text, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
                center_x = int((x1 + x2) / 2)
                center_y = int((y1 + y2) / 2)
                cv2.circle(frame, (center_x, center_y), 4, (255, 255, 255), -1)

            # Force cleanup after each processed frame
            del frame
            import gc
            gc.collect()

            out.write(frame)
            if preview_folder and frame_count % 10 == 0:
                os.makedirs(preview_folder, exist_ok=True)
                preview_path = os.path.join(preview_folder, 'preview_detections.jpg')
                cv2.imwrite(preview_path, frame)

            frame_count += 1
            if progress_callback and frame_count % 10 == 0:
                progress = frame_count / total_frames
                progress_callback(progress)

    cap.release()
    out.release()
    return output_path, detections_for_heatmap, fps
