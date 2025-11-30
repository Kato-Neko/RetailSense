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
    Improved person detection + tracking pipeline:
      - Filters detections by confidence, area and aspect ratio
      - Uses a slightly larger detection size for better box accuracy
      - Tighter tracker params (shorter max_age) to avoid stale boxes
      - Simple exponential smoothing of bbox centers to reduce jitter
    Returns: (output_video_path, detections_for_heatmap, fps)
    """
    model = _get_model()

    # Create tracker with safer/tighter defaults (fall back if signature differs)
    global _tracker
    if _tracker is None:
        try:
            # common args: max_age, n_init, max_cosine_distance
            _tracker = _get_tracker()  # attempt existing factory
            # attempt to set attributes if available
            try:
                _tracker.max_age = 10  # fewer frames kept when unseen
            except Exception:
                pass
        except Exception:
            # fallback to constructing here (best-effort)
            try:
                from deep_sort_realtime.deepsort_tracker import DeepSort
                _tracker = DeepSort(max_age=10, n_init=3)
            except Exception as e:
                logger.warning(f"Failed to init DeepSort with tighter params: {e}")
                # Best-effort init
                from deep_sort_realtime.deepsort_tracker import DeepSort
                _tracker = DeepSort(max_age=30)

    tracker = _tracker

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception(f"Error opening video file: {video_path}")
    logger.info(f"Successfully opened video: {video_path}")

    original_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    original_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 25
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0

    # Resize settings: keep reasonable detection resolution for better boxes
    max_width = 480  # increased from 320 to improve bbox accuracy
    if original_width > max_width:
        scale_factor = max_width / float(original_width)
        width = int(max_width)
        height = int(round(original_height * scale_factor))
        if height % 2 != 0:
            height += 1
    else:
        width = original_width
        height = original_height
        scale_factor = 1.0

    logger.info(f"Processing: {original_width}x{original_height} -> {width}x{height} (scale={scale_factor:.4f})")

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (original_width, original_height))

    detections_for_heatmap: List[Dict[str, Any]] = []
    frame_count = 0
    processed_frames = 0
    frame_skip = 1
    total_processed_frames = (total_frames + frame_skip - 1) // frame_skip if total_frames > 0 else 0

    if progress_callback:
        progress_callback(0.0)

    warmup_done = False

    # smoothing state: track_id -> (last_center_x, last_center_y)
    smoothing_state: Dict[int, Tuple[float, float]] = {}
    SMOOTHING_ALPHA = 0.6  # higher = more responsive, lower = smoother

    # detection filters (tune these)
    CONF_THRESH = 0.35
    MIN_BOX_AREA = (width * height) * 0.0008  # small fraction of resized frame (tunable)
    # human aspect ratio constraints (w/h). Humans usually taller than wide:
    MIN_ASPECT = 0.20
    MAX_ASPECT = 0.95

    while cap.isOpened():
        if cancelled_flag and cancelled_flag():
            logger.info("Processing cancelled by user")
            break

        ret, frame = cap.read()
        if not ret:
            break
        if frame is None:
            logger.error(f"Frame {frame_count} is None, skipping")
            frame_count += 1
            continue

        should_process = (frame_count % frame_skip == 0)

        # prepare resized copy for detection/tracking consistency
        if scale_factor != 1.0:
            frame_resized = cv2.resize(frame, (width, height))
            frame_for_output = frame.copy()
        else:
            frame_resized = frame.copy()
            frame_for_output = frame.copy()

        if should_process:
            processed_frames += 1

            # model warmup
            if not warmup_done:
                try:
                    logger.info("Warming up model...")
                    dummy = cv2.resize(frame_resized, (320, 320))
                    model(dummy, verbose=False, imgsz=320, conf=0.4, device='cpu', half=False)
                    warmup_done = True
                except Exception as e:
                    logger.warning(f"Model warmup failed: {e}")
                    warmup_done = True

            timestamp = frame_count / float(fps)

            import time
            start_time = time.time()
            try:
                # Use higher imgsz than before for better box tightness. Change to 640 if you have CPU.
                results = model(frame_resized,
                                classes=[0],
                                verbose=False,
                                imgsz=480,
                                conf=CONF_THRESH,
                                iou=0.5,
                                max_det=30,
                                device='cpu',
                                half=False)
            except Exception as e:
                logger.error(f"YOLO error at frame {frame_count}: {e}")
                frame_count += 1
                continue
            yolo_time = time.time() - start_time
            if processed_frames <= 3:
                logger.info(f"Frame {frame_count}: YOLO took {yolo_time:.2f}s")

            # convert predictions into filtered detections in RESIZED coordinates
            detections = []
            total_detections = 0
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    # box.xyxy are floats in resized image coords
                    x1_f, y1_f, x2_f, y2_f = map(float, box.xyxy[0])
                    conf = float(box.conf[0])
                    total_detections += 1
                    if conf < CONF_THRESH:
                        continue

                    # clamp to resized bounds
                    x1 = max(0.0, min(x1_f, width - 1.0))
                    y1 = max(0.0, min(y1_f, height - 1.0))
                    x2 = max(0.0, min(x2_f, width - 1.0))
                    y2 = max(0.0, min(y2_f, height - 1.0))

                    w = x2 - x1
                    h = y2 - y1
                    if w <= 0 or h <= 0:
                        continue

                    area = w * h
                    aspect = (w / h) if h > 0 else 0.0

                    # Filters: remove very small boxes and unrealistic aspect ratios
                    if area < MIN_BOX_AREA:
                        continue
                    if aspect < MIN_ASPECT or aspect > MAX_ASPECT:
                        continue

                    # Add detection in format expected by deep_sort_realtime
                    detections.append(([int(round(x1)), int(round(y1)), int(round(x2)), int(round(y2))], float(conf), 0))

            if processed_frames <= 3:
                logger.info(f"Frame {frame_count}: YOLO total {total_detections}, kept {len(detections)} after filtering")

            # Update tracker
            try:
                tracks = tracker.update_tracks(detections, frame=frame_resized)
            except Exception as e:
                logger.error(f"Tracker update failed at frame {frame_count}: {e}")
                tracks = []

            # iterate tracks and draw using ORIGINAL resolution coordinates
            for track in tracks:
                if not track.is_confirmed():
                    continue

                track_id = track.track_id
                # to_ltrb() returns left, top, right, bottom in the same coordinate space we passed to the tracker (resized)
                ltrb = track.to_ltrb()
                x1_r, y1_r, x2_r, y2_r = map(float, ltrb)

                # clamp and fix ordering
                x1_r = max(0.0, min(x1_r, width - 1.0))
                y1_r = max(0.0, min(y1_r, height - 1.0))
                x2_r = max(0.0, min(x2_r, width - 1.0))
                y2_r = max(0.0, min(y2_r, height - 1.0))
                if x2_r <= x1_r:
                    x2_r = x1_r + 1.0
                if y2_r <= y1_r:
                    y2_r = y1_r + 1.0

                # scale back to original size carefully (use float math then int(round()))
                if scale_factor != 1.0:
                    scale_x = original_width / float(width)
                    scale_y = original_height / float(height)
                    x1_o = int(round(x1_r * scale_x))
                    y1_o = int(round(y1_r * scale_y))
                    x2_o = int(round(x2_r * scale_x))
                    y2_o = int(round(y2_r * scale_y))
                else:
                    x1_o, y1_o, x2_o, y2_o = int(round(x1_r)), int(round(y1_r)), int(round(x2_r)), int(round(y2_r))

                # clamp to original bounds
                x1_o = max(0, min(x1_o, original_width - 1))
                y1_o = max(0, min(y1_o, original_height - 1))
                x2_o = max(0, min(x2_o, original_width - 1))
                y2_o = max(0, min(y2_o, original_height - 1))
                if x2_o <= x1_o:
                    x2_o = min(x1_o + 1, original_width - 1)
                if y2_o <= y1_o:
                    y2_o = min(y1_o + 1, original_height - 1)

                # final sanity check (skip if still invalid)
                if x1_o >= x2_o or y1_o >= y2_o:
                    if processed_frames <= 5:
                        logger.warning(f"Frame {frame_count}: invalid scaled box for track {track_id}, skipping")
                    continue

                # Smoothing of center (simple EMA) to reduce jitter and sudden jumps
                center_x = (x1_o + x2_o) / 2.0
                center_y = y2_o  # bottom center (feet)
                if track_id in smoothing_state:
                    last_x, last_y = smoothing_state[track_id]
                    sm_x = SMOOTHING_ALPHA * center_x + (1 - SMOOTHING_ALPHA) * last_x
                    sm_y = SMOOTHING_ALPHA * center_y + (1 - SMOOTHING_ALPHA) * last_y
                else:
                    sm_x, sm_y = center_x, center_y
                smoothing_state[track_id] = (sm_x, sm_y)

                # Update heatmap list with original bbox (use unsmoothed bbox for size, smoothed center optionally)
                detections_for_heatmap.append({
                    'frame': frame_count,
                    'bbox': [x1_o, y1_o, x2_o, y2_o],
                    'track_id': track_id,
                    'timestamp': timestamp
                })

                # Draw box and ID on OUTPUT frame
                box_color = (0, 255, 0)
                box_thickness = 2
                cv2.rectangle(frame_for_output, (x1_o, y1_o), (x2_o, y2_o), box_color, box_thickness)

                text = f"ID: {track_id}"
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.6
                text_thickness = 2
                (text_width, text_height), baseline = cv2.getTextSize(text, font, font_scale, text_thickness)

                # background for text
                tx1 = max(0, x1_o)
                ty1 = max(0, y1_o - text_height - baseline - 4)
                cv2.rectangle(frame_for_output, (tx1, ty1), (tx1 + text_width, ty1 + text_height + baseline), (0, 0, 0), -1)
                cv2.putText(frame_for_output, text, (tx1, ty1 + text_height), font, font_scale, (255, 255, 255), text_thickness)

                # Draw smoothed center (feet)
                cv2.circle(frame_for_output, (int(round(sm_x)), int(round(sm_y))), 4, (0, 0, 255), -1)

            # write annotated frame (original resolution)
            out.write(frame_for_output)

            # save preview occasionally
            if preview_folder and processed_frames % 5 == 0:
                os.makedirs(preview_folder, exist_ok=True)
                preview_path = os.path.join(preview_folder, f'preview_{frame_count:06d}.jpg')
                cv2.imwrite(preview_path, frame_for_output)

        else:
            out.write(frame)

        frame_count += 1

        # Progress callback
        if progress_callback:
            progress = frame_count / float(total_frames) if total_frames > 0 else 0.0
            should_report = (
                frame_count <= 5 or
                frame_count % 10 == 0 or
                frame_count == total_frames or
                should_process
            )
            if should_report:
                progress_callback(progress)

    cap.release()
    out.release()
    logger.info(f"Completed: {frame_count} frames read, {processed_frames} processed")
    return output_path, detections_for_heatmap, fps
