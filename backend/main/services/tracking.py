"""
Tracking service: person detection (YOLOv8) and tracking (DeepSort).
"""

import os
import cv2
import numpy as np
from typing import Callable, Tuple, List, Dict, Any, Optional
from ..core.config import logger


class PersonTrackingService:
    """Provides YOLO-based person detection and DeepSort tracking."""

    def __init__(self) -> None:
        self._model = None
        self._tracker = None

    def get_model(self):
        if self._model is None:
            from ultralytics import YOLO
            import torch

            self._model = YOLO('yolov8n.pt')
            self._model.model.eval()
            torch.set_num_threads(1)
            logger.info("YOLO model loaded and optimized for CPU inference")
        return self._model

    def get_tracker(self):
        if self._tracker is None:
            from deep_sort_realtime.deepsort_tracker import DeepSort
            self._tracker = DeepSort(max_age=30)
        return self._tracker

    def detect_and_track(
        self,
        video_path: str,
        output_path: str,
        progress_callback: Optional[Callable[[float], None]] = None,
        preview_folder: Optional[str] = None,
        cancelled_flag: Optional[Callable[[], bool]] = None,
    ) -> Tuple[str, List[Dict[str, Any]], int]:
        """Run person detection and tracking on a video."""
        model = self.get_model()
        tracker = self.get_tracker()

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise Exception(f"Error opening video file: {video_path}")

        logger.info(f"Successfully opened video file: {video_path}")

        original_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        original_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

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
        processed_frames = 0
        frame_skip = 10

        total_processed_frames = (total_frames + frame_skip - 1) // frame_skip

        if progress_callback:
            progress_callback(0.0)
            logger.info(f"Starting video processing: {total_frames} total frames, will process {total_processed_frames} frames (every {frame_skip}th frame)")

        logger.info(f"Video properties: {original_width}x{original_height}, {fps} fps, {total_frames} total frames")

        warmup_done = False

        while cap.isOpened():
            if cancelled_flag is not None and cancelled_flag():
                logger.info("Processing cancelled by user")
                break

            ret, frame = cap.read()
            if not ret:
                break

            if frame is None:
                logger.error(f"Frame {frame_count} is None, skipping")
                frame_count += 1
                continue

            if scale_factor != 1.0:
                frame_resized = cv2.resize(frame, (width, height))
            else:
                frame_resized = frame.copy()
            out.write(frame_resized)

            should_process = (frame_count % frame_skip == 0)

            if should_process:
                processed_frames += 1

                if not warmup_done:
                    logger.info("Warming up YOLO model with first frame...")
                    try:
                        dummy_frame = cv2.resize(frame, (320, 320))
                        model(dummy_frame, verbose=False, imgsz=320, conf=0.4, device='cpu', half=False)
                        logger.info("Model warmup completed")
                        warmup_done = True
                    except Exception as e:
                        logger.warning(f"Model warmup failed: {e}")
                        warmup_done = True

                timestamp = frame_count / fps

                if processed_frames <= 3:
                    logger.info(f"Processing frame {frame_count + 1} (processed frame {processed_frames}), shape: {frame.shape}")

                import time
                start_time = time.time()

                try:
                    results = model(
                        frame,
                        classes=[0],
                        verbose=False,
                        imgsz=320,
                        conf=0.4,
                        iou=0.5,
                        max_det=5,
                        device='cpu',
                        half=False,
                    )
                except Exception as e:
                    logger.error(f"Error processing frame {frame_count} with YOLO: {e}")
                    frame_count += 1
                    continue

                yolo_time = time.time() - start_time
                if processed_frames <= 3:
                    logger.info(f"YOLO inference took {yolo_time:.2f} seconds for frame {frame_count + 1}")

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

                if processed_frames <= 3:
                    logger.info(f"YOLO found {total_detections} total detections, {len(detections)} above threshold in processed frame {processed_frames}")

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

                    cv2.rectangle(frame_resized, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    text = f"ID: {track_id}"
                    (text_width, text_height), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
                    cv2.rectangle(frame_resized, (x1, y1-text_height-10), (x1+text_width, y1), (0, 0, 0), -1)
                    cv2.putText(frame_resized, text, (x1, y1-5),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)

                    center_x = int((x1 + x2) / 2)
                    center_y = int((y1 + y2) / 2)
                    cv2.circle(frame_resized, (center_x, center_y), 4, (255, 255, 255), -1)

                out.write(frame_resized)

                if preview_folder and processed_frames % 2 == 0:
                    os.makedirs(preview_folder, exist_ok=True)
                    preview_path = os.path.join(preview_folder, 'preview_detections.jpg')
                    cv2.imwrite(preview_path, frame_resized)

            frame_count += 1

            if progress_callback:
                progress = frame_count / total_frames
                should_report_progress = (
                    frame_count <= 5 or
                    frame_count % 10 == 0 or
                    frame_count == total_frames or
                    should_process
                )

                if should_report_progress:
                    progress_callback(progress)

        cap.release()
        out.release()

        logger.info(f"Video processing completed: {frame_count} frames read, {processed_frames} processed")
        return output_path, detections_for_heatmap, fps


# Backward-compatible singleton and wrappers
_tracking_service_singleton = PersonTrackingService()


def _get_model():
    return _tracking_service_singleton.get_model()


def _get_tracker():
    return _tracking_service_singleton.get_tracker()


def detect_and_track(
    video_path: str,
    output_path: str,
    progress_callback: Optional[Callable[[float], None]] = None,
    preview_folder: Optional[str] = None,
    cancelled_flag: Optional[Callable[[], bool]] = None,
) -> Tuple[str, List[Dict[str, Any]], int]:
    return _tracking_service_singleton.detect_and_track(
        video_path,
        output_path,
        progress_callback=progress_callback,
        preview_folder=preview_folder,
        cancelled_flag=cancelled_flag,
    )