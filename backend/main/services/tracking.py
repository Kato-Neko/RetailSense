"""
Tracking service: person detection (YOLOv8) and tracking (DeepSort).
"""

import os
import cv2
import numpy as np
from typing import Callable, Tuple, List, Dict, Any, Optional

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
    model = _get_model()
    tracker = _get_tracker()

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception("Error opening video file")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    detections_for_heatmap: List[Dict[str, Any]] = []
    frame_count = 0
    while cap.isOpened():
        if cancelled_flag is not None and cancelled_flag():
            break
        ret, frame = cap.read()
        if not ret:
            break
        timestamp = frame_count / fps

        results = model(frame, classes=[0])  # class 0 is person

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

            detections_for_heatmap.append({
                'frame': frame_count,
                'bbox': [x1, y1, x2, y2],
                'track_id': track_id,
                'timestamp': timestamp
            })

            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            text = f"ID: {track_id}"
            (text_width, text_height), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
            cv2.rectangle(frame, (x1, y1 - text_height - 10), (x1 + text_width, y1), (0, 0, 0), -1)
            cv2.putText(frame, text, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
            center_x = int((x1 + x2) / 2)
            center_y = int((y1 + y2) / 2)
            cv2.circle(frame, (center_x, center_y), 4, (255, 255, 255), -1)

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
