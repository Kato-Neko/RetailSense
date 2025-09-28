import os
import cv2
import numpy as np
from scipy.ndimage import gaussian_filter


def blend_heatmap(detections, floorplan_path, output_heatmap_path, output_video_path, video_path, progress_callback=None, return_image=False):
    print(f"DEBUG: blend_heatmap called with {len(detections)} detections")
    print(f"DEBUG: First few detections: {detections[:3] if detections else 'None'}")
    
    floorplan = cv2.imread(floorplan_path)
    if floorplan is None:
        raise ValueError(f"Could not load floorplan image: {floorplan_path}")

    heatmap = np.zeros(floorplan.shape[:2], dtype=np.float32)
    total_detections = len(detections)
    print(f"DEBUG: Processing {total_detections} detections for heatmap")
    
    for i, detection in enumerate(detections):
        bbox = detection['bbox']
        center_x = int((bbox[0] + bbox[2]) / 2)
        center_y = int((bbox[1] + bbox[3]) / 2)
        cv2.circle(heatmap, (center_x, center_y), 20, 1.0, -1)
        if progress_callback and total_detections > 0:
            progress = 0.5 * (i + 1) / total_detections
            progress_callback(progress)
    
    print(f"DEBUG: Heatmap max value before processing: {heatmap.max()}")

    heatmap = np.power(heatmap, 0.6)
    heatmap_norm = cv2.normalize(heatmap, None, 0, 1, cv2.NORM_MINMAX)
    heatmap_img = cv2.normalize(heatmap, None, 0, 255, cv2.NORM_MINMAX)
    heatmap_img = gaussian_filter(heatmap_img, sigma=10)
    heatmap_colored = cv2.applyColorMap(heatmap_img.astype(np.uint8), cv2.COLORMAP_TURBO)

    print(f"DEBUG: Heatmap norm max: {heatmap_norm.max()}")
    print(f"DEBUG: Heatmap colored shape: {heatmap_colored.shape}")

    alpha_mask = heatmap_norm[..., None]
    alpha_mask = alpha_mask * 0.7
    blended = (floorplan * (1 - alpha_mask) + heatmap_colored * alpha_mask).astype(np.uint8)
    
    print(f"DEBUG: Blended image shape: {blended.shape}")
    print(f"DEBUG: Alpha mask max: {alpha_mask.max()}")
    
    # If no detections, return the original floorplan with a warning
    if total_detections == 0:
        print("WARNING: No detections found, returning original floorplan")
        if return_image:
            return floorplan
        else:
            return None

    if output_heatmap_path:
        cv2.imwrite(output_heatmap_path, blended)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Could not open video for processing")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))

    frame_detections = {}
    for detection in detections:
        frame = detection['frame']
        frame_detections.setdefault(frame, []).append(detection)

    frame_count = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if frame_count in frame_detections:
            for detection in frame_detections[frame_count]:
                bbox = detection['bbox']
                track_id = detection['track_id']
                cv2.rectangle(frame, (int(bbox[0]), int(bbox[1])), (int(bbox[2]), int(bbox[3])), (0, 255, 0), 2)
                cv2.putText(frame, f"ID: {track_id}", (int(bbox[0]), int(bbox[1] - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        out.write(frame)
        frame_count += 1
        if progress_callback and total_frames > 0:
            progress = 0.5 + 0.5 * (frame_count / total_frames)
            progress_callback(progress)
    cap.release()
    out.release()
    if return_image:
        return blended
    else:
        return None
