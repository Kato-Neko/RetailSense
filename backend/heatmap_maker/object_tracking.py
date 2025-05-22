"""
object_tracking.py
Handles object/person detection and tracking logic for the backend.
"""

import cv2
import numpy as np
from ultralytics import YOLO
from deep_sort_realtime.deepsort_tracker import DeepSort
import os
import logging
from collections import Counter

logger = logging.getLogger(__name__)

def detect_and_track(video_path, output_path, progress_callback=None, preview_folder=None, cancelled_flag=None):
    """
    Run person detection and tracking on a video.
    
    Args:
        video_path: Path to input video file
        output_path: Path to save the processed video
        progress_callback: Optional callback function(progress) to report progress
        preview_folder: Optional folder to save preview images
        cancelled_flag: Optional callable that returns True if the job should be cancelled
        
    Returns:
        Tuple of (output_video_path, detections, fps)
    """
    # Load YOLO model
    model = YOLO('yolov8n.pt')
    
    # Initialize DeepSORT tracker
    tracker = DeepSort(max_age=30)
    
    # Open video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception("Error opening video file")
    
    # Get video properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Initialize video writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    # Initialize heatmap
    heatmap = np.zeros((height, width), dtype=np.float32)
    
    detections_for_heatmap = []
    frame_count = 0
    while cap.isOpened():
        # Check for cancellation before processing each frame
        if cancelled_flag is not None and cancelled_flag():
            logger.info("Job cancelled during object tracking loop.")
            break
        ret, frame = cap.read()
        if not ret:
            break
        timestamp = frame_count / fps  # seconds
            
        # Run YOLO detection
        results = model(frame, classes=[0])  # class 0 is person
        
        # Process detections
        detections = []
        for r in results:
            boxes = r.boxes
            for box in boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                conf = float(box.conf[0])
                if conf > 0.5:  # Confidence threshold
                    detections.append(([x1, y1, x2, y2], conf, 0))  # 0 is class_id for person
        
        # Update tracker
        tracks = tracker.update_tracks(detections, frame=frame)
        
        # Update heatmap and draw tracks
        for track in tracks:
            if not track.is_confirmed():
                continue
                
            track_id = track.track_id
            ltrb = track.to_ltrb()
            
            # Update heatmap
            x1, y1, x2, y2 = map(int, ltrb)
            heatmap[y1:y2, x1:x2] += 1
            
            # Add detection for blend_heatmap
            detections_for_heatmap.append({
                'frame': frame_count,
                'bbox': [x1, y1, x2, y2],
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
            preview_path = os.path.join(preview_folder, 'preview_detections.jpg')
            cv2.imwrite(preview_path, frame)
        
        # Update progress
        frame_count += 1
        if progress_callback and frame_count % 10 == 0:
            progress = frame_count / total_frames
            progress_callback(progress)
            logger.debug(f"Processing frame {frame_count}/{total_frames} ({progress*100:.1f}%)")
    
    # Release resources
    cap.release()
    out.release()
    
    return output_path, detections_for_heatmap, fps

def analyze_peak_hours(detections, fps, bin_minutes=5):
    """
    Analyze detections to find peak time frames.
    - detections: list of dicts, each with a 'timestamp' (in seconds)
    - fps: frames per second of the video
    - bin_minutes: size of each time bin in minutes
    Returns: list of (start_time, end_time, count) for the busiest bins
    """
    # Gather all timestamps
    timestamps = [det['timestamp'] for det in detections if 'timestamp' in det]
    if not timestamps:
        return []

    # Bin timestamps into intervals
    bin_seconds = bin_minutes * 60
    max_time = max(timestamps)
    num_bins = int(np.ceil(max_time / bin_seconds))
    bins = [0] * (num_bins + 1)

    for t in timestamps:
        bin_idx = int(t // bin_seconds)
        bins[bin_idx] += 1

    # Find the bin(s) with the most detections
    peak_count = max(bins)
    peak_bins = [i for i, count in enumerate(bins) if count == peak_count]

    # Format results as readable time ranges
    results = []
    for bin_idx in peak_bins:
        start = bin_idx * bin_minutes
        end = (bin_idx + 1) * bin_minutes
        results.append({
            "start_minute": start,
            "end_minute": end,
            "count": peak_count
        })
    return results

# Add more tracking-related utilities as needed 