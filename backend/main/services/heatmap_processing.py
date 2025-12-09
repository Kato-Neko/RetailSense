import os
import cv2
import numpy as np
from scipy.ndimage import gaussian_filter
from ..core.config import logger


def create_custom_heatmap(detections, floorplan_path, dimensions=(1920, 1080), points=None):
    """
    Create a custom heatmap from filtered detections and floorplan.
    Simpler version that doesn't need video processing.
    
    Args:
        detections: List of filtered detections
        floorplan_path: Path to floorplan image
        dimensions: Tuple of (width, height) for coordinate space, defaults to HD
        points: Optional homography points
    Returns:
        numpy array of the blended heatmap image
    """
    logger.info("===== CREATE_CUSTOM_HEATMAP STARTED =====")
    logger.info(f"Creating custom heatmap with {len(detections)} detections")
    
    try:
        floorplan = cv2.imread(floorplan_path)
        logger.info("Floorplan loaded successfully")
    except Exception as e:
        logger.error(f"Error loading floorplan: {e}")
        raise
    if floorplan is None:
        raise ValueError(f"Could not load floorplan image: {floorplan_path}")

    video_width, video_height = dimensions
    floorplan_height, floorplan_width = floorplan.shape[:2]
    
    # Create base heatmap
    heatmap = np.zeros(floorplan.shape[:2], dtype=np.float32)
    
    # Plot detections
    for det in detections:
        bbox = det['bbox']
        center_x = (bbox[0] + bbox[2]) / 2
        center_y = (bbox[1] + bbox[3]) / 2
        
        # Map coordinates to floorplan space
        mx = int(center_x * floorplan_width / video_width)
        my = int(center_y * floorplan_height / video_height)
        mx = max(0, min(mx, floorplan_width - 1))
        my = max(0, min(my, floorplan_height - 1))
        
        cv2.circle(heatmap, (mx, my), 15, 1.0, -1)
    
    # Process heatmap
    heatmap = np.power(heatmap, 0.6)
    heatmap_norm = cv2.normalize(heatmap, None, 0, 1, cv2.NORM_MINMAX)
    heatmap_img = cv2.normalize(heatmap, None, 0, 255, cv2.NORM_MINMAX)
    heatmap_img = gaussian_filter(heatmap_img, sigma=10)
    heatmap_colored = cv2.applyColorMap(heatmap_img.astype(np.uint8), cv2.COLORMAP_TURBO)

    # Blend with floorplan
    alpha_mask = heatmap_norm[..., None] * 0.7
    blended = (floorplan * (1 - alpha_mask) + heatmap_colored * alpha_mask).astype(np.uint8)
    
    return blended


def blend_heatmap(detections, floorplan_path, output_heatmap_path, output_video_path, video_path, points=None, progress_callback=None, return_image=False):
    """
    Generate and blend heatmap from detections using homography transformation.
    Also creates annotated video output.
    
    Args:
        detections: List of detections from object tracking
        floorplan_path: Path to floorplan image
        output_heatmap_path: Path to save the heatmap image
        output_video_path: Path to save the processed video
        video_path: Path to the video
        points: List of 4 corner points for homography mapping [tl, tr, br, bl]
        progress_callback: Optional callback function(progress) to report progress
        return_image: Whether to return the blended image
    """
    logger.info("Starting heatmap blending process...")
    logger.info(f"Processing {len(detections)} detections for heatmap.")
    
    try:
        floorplan = cv2.imread(floorplan_path)
        if floorplan is None:
            raise ValueError(f"Could not load floorplan image: {floorplan_path}")
        logger.info("Floorplan loaded successfully.")
    except Exception as e:
        logger.error(f"Error loading floorplan in blend_heatmap: {e}")
        raise

    # Get video dimensions only if we need to process video
    if video_path:
        if not os.path.exists(video_path):
            logger.error(f"Video file does not exist at path: {video_path}")
            raise ValueError(f"Video file not found: {video_path}")
            
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.error(f"Could not open video file for verification: {video_path}")
            logger.error("This may be due to file permissions, corruption, or incorrect codec support")
            raise ValueError(f"Could not open video for verification: {video_path}")
        
        video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if video_width <= 0 or video_height <= 0:
            logger.error(f"Invalid video dimensions: {video_width}x{video_height}")
            raise ValueError(f"Invalid video dimensions from {video_path}")
        cap.release()
    else:
        # For heatmap-only processing, use dimensions from first detection or default HD
        if detections and 'bbox' in detections[0]:
            bbox = detections[0]['bbox']
            video_width = max(bbox[0], bbox[2]) * 2
            video_height = max(bbox[1], bbox[3]) * 2
        else:
            video_width = 1920
            video_height = 1080
        logger.info(f"Using dimensions for heatmap: {video_width}x{video_height}")
    
    floorplan_height, floorplan_width = floorplan.shape[:2]
    
    heatmap = np.zeros(floorplan.shape[:2], dtype=np.float32)
    total_detections = len(detections)
    
    for i, detection in enumerate(detections):
        bbox = detection['bbox']
        # Get bounding box center in video coordinates
        center_x = (bbox[0] + bbox[2]) / 2
        center_y = (bbox[1] + bbox[3]) / 2
        mx = int(center_x * floorplan_width / video_width)
        my = int(center_y * floorplan_height / video_height)
        mx = max(0, min(mx, floorplan_width - 1))
        my = max(0, min(my, floorplan_height - 1))
        
        cv2.circle(heatmap, (mx, my), 15, 1.0, -1)
        
        if progress_callback and total_detections > 0:
            progress = 0.5 * (i + 1) / total_detections
            progress_callback(progress)
    
    heatmap = np.power(heatmap, 0.6)
    heatmap_norm = cv2.normalize(heatmap, None, 0, 1, cv2.NORM_MINMAX)
    heatmap_img = cv2.normalize(heatmap, None, 0, 255, cv2.NORM_MINMAX)
    heatmap_img = gaussian_filter(heatmap_img, sigma=10)
    heatmap_colored = cv2.applyColorMap(heatmap_img.astype(np.uint8), cv2.COLORMAP_TURBO)

    alpha_mask = heatmap_norm[..., None]
    alpha_mask = alpha_mask * 0.7
    blended = (floorplan * (1 - alpha_mask) + heatmap_colored * alpha_mask).astype(np.uint8)
    
    # Check if we have any valid detections (non-zero heatmap)
    if total_detections == 0 or np.count_nonzero(heatmap) == 0:
        logger.warning("No valid detections found, returning original floorplan for heatmap image.")
        if return_image:
            return floorplan
        else:
            return None

    if output_heatmap_path:
        cv2.imwrite(output_heatmap_path, blended)

    # Create video with detections (Phase 2: 50%–100%)
    cap = cv2.VideoCapture(output_video_path) # Read from the already created video
    if not cap.isOpened():
        raise ValueError("Could not open video for processing")
    
    # Get video properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Create video writer
    annotated_video_path = output_video_path.replace('.mp4', '_annotated.mp4')
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(annotated_video_path, fourcc, fps, (width, height))
    
    # Process video frames
    frame_detections = {}
    for detection in detections:
        frame = detection['frame']
        if frame not in frame_detections:
            frame_detections[frame] = []
        frame_detections[frame].append(detection)
    
    frame_count = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        # Draw detections for current frame
        if frame_count in frame_detections:
            for detection in frame_detections[frame_count]:
                bbox = detection['bbox']
                track_id = detection['track_id']
                
                # Draw bounding box
                cv2.rectangle(frame, 
                            (int(bbox[0]), int(bbox[1])), 
                            (int(bbox[2]), int(bbox[3])), 
                            (0, 255, 0), 2)
                
                # Draw track ID
                cv2.putText(frame, 
                           f"ID: {track_id}", 
                           (int(bbox[0]), int(bbox[1] - 10)), 
                           cv2.FONT_HERSHEY_SIMPLEX, 
                           0.5, 
                           (0, 255, 0), 
                           2)
        
        # Write frame
        out.write(frame)
        frame_count += 1
        # Update progress (50%–100%)
        if progress_callback and total_frames > 0:
            progress = 0.5 + 0.5 * (frame_count / total_frames)
            progress_callback(progress)
    
    # Release resources
    cap.release()
    out.release()

    # Replace original video with annotated one
    os.replace(annotated_video_path, output_video_path)
    
    logger.info("Main heatmap processing and annotated video creation complete.")
    
    # Create progressive heatmap video (save locally, upload later through main pipeline)
    logger.info("Creating progressive heatmap video...")
    
    # Extract job ID from video path
    import re
    job_id_match = re.search(r'([a-f0-9-]{36})', video_path)
    job_id = job_id_match.group(1) if job_id_match else "unknown"
    if job_id != "unknown":
        logger.info(f"Extracted job_id: {job_id}")
    else:
        logger.warning("Could not extract job_id from video path for progressive heatmap.")
        return blended if return_image else None
    
    try:
        create_progressive_heatmap_video_local(detections, floorplan, job_id, video_path, points)
        logger.info("Progressive heatmap video creation completed.")
    except Exception as e:
        logger.error(f"Progressive video creation failed: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
    
    if return_image:
        return blended
    else:
        return None


def create_progressive_heatmap_video_local(detections, floorplan, job_id, video_path, points=None):
    """
    Create a progressive heatmap video and save locally.
    Follows same pattern as other files - save locally, upload through main pipeline.
    """
    logger.info(f"Starting progressive video creation for job {job_id}.")

    try:
        # Open original video for frame-by-frame overlay
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.warning(f"Could not open video at path for progressive heatmap: {video_path}")
            return

        video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        if not fps or fps <= 0:
            fps = 25.0

        output_dir = f"/project_results/{job_id}"
        os.makedirs(output_dir, exist_ok=True)
        progressive_video_path = os.path.join(output_dir, f"progressive_heatmap_{job_id}.mp4")
        logger.info(f"Progressive video will be saved to: {progressive_video_path}")

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(progressive_video_path, fourcc, fps, (video_width, video_height))

        # Build detections map per frame (video coordinates)
        detections_by_frame = {}
        for det in detections:
            fidx = int(det.get('frame', 0))
            bbox = det.get('bbox', [0, 0, 0, 0])
            if not isinstance(bbox, (list, tuple)) or len(bbox) < 4:
                continue
            x1, y1, x2, y2 = bbox[:4]
            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)
            if cx < 0 or cx >= video_width:
                cx = max(0, min(video_width - 1, cx % max(1, video_width)))
            if cy < 0 or cy >= video_height:
                cy = max(0, min(video_height - 1, cy % max(1, video_height)))
            detections_by_frame.setdefault(fidx, []).append((cx, cy))

        # Progressive accumulation - matching static heatmap parameters
        heat_accum = np.zeros((video_height, video_width), dtype=np.float32)
        circle_radius = 15  # Match static heatmap
        alpha = 0.7  # Match static heatmap
        frame_index = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # Add new detections for this frame using same circle approach as static
            for (cx, cy) in detections_by_frame.get(frame_index, []):
                cv2.circle(heat_accum, (cx, cy), circle_radius, 1.0, -1)

            # Apply same processing as static heatmap
            heatmap_processed = np.power(heat_accum, 0.6)  # Match static heatmap power
            heat_smoothed = gaussian_filter(heatmap_processed, sigma=10)  # Match static heatmap blur
            
            if heat_smoothed.max() > 0:
                heat_norm = (heat_smoothed / heat_smoothed.max() * 255.0).astype(np.uint8)
            else:
                heat_norm = heat_smoothed.astype(np.uint8)

            heat_color = cv2.applyColorMap(heat_norm, cv2.COLORMAP_TURBO)  # Match static heatmap colormap
            overlay = cv2.addWeighted(frame, 1.0, heat_color, alpha, 0)
            out.write(overlay)
            frame_index += 1

        cap.release()
        out.release()
        logger.info("Progressive heatmap video creation completed.")
    except Exception as e:
        logger.error(f"Progressive video creation failed: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")