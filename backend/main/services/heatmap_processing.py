import os
import cv2
import numpy as np
from scipy.ndimage import gaussian_filter
from ..core.config import logger


def validate_and_normalize_bbox(bbox, video_width, video_height):
    """
    Validate and normalize bounding box coordinates.
    Ensures proper xyxy format (x1 < x2, y1 < y2) and clamps to video bounds.
    
    Args:
        bbox: [x1, y1, x2, y2] bounding box coordinates
        video_width: Width of video frame
        video_height: Height of video frame
    
    Returns:
        Validated and normalized [x1, y1, x2, y2] bounding box
    """
    if len(bbox) < 4:
        raise ValueError(f"Invalid bbox format: {bbox}. Expected [x1, y1, x2, y2]")
    
    x1, y1, x2, y2 = float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])
    
    # Ensure x1 < x2 and y1 < y2 (swap if needed)
    if x1 > x2:
        x1, x2 = x2, x1
    if y1 > y2:
        y1, y2 = y2, y1
    
    # Clamp to video bounds
    x1 = max(0, min(x1, video_width - 1))
    y1 = max(0, min(y1, video_height - 1))
    x2 = max(0, min(x2, video_width - 1))
    y2 = max(0, min(y2, video_height - 1))
    
    # Ensure minimum size
    if x2 - x1 < 1:
        x2 = x1 + 1
    if y2 - y1 < 1:
        y2 = y1 + 1
    
    return [int(x1), int(y1), int(x2), int(y2)]


def get_floor_position_from_bbox(bbox, video_width, video_height, use_bottom_center=True):
    """
    Extract floor position from bounding box.
    For heatmaps, using bottom center (feet position) is more accurate than center.
    
    Args:
        bbox: [x1, y1, x2, y2] bounding box coordinates
        video_width: Width of video frame
        video_height: Height of video frame
        use_bottom_center: If True, use bottom center (feet), else use center
    
    Returns:
        (x, y) tuple of floor position in video coordinates
    """
    bbox = validate_and_normalize_bbox(bbox, video_width, video_height)
    x1, y1, x2, y2 = bbox
    
    if use_bottom_center:
        # Use bottom center (feet position) for more accurate floor mapping
        center_x = (x1 + x2) / 2
        center_y = y2  # Bottom of bounding box (feet position)
    else:
        # Use center of bounding box
        center_x = (x1 + x2) / 2
        center_y = (y1 + y2) / 2
    
    return center_x, center_y


def interpolate_path_between_points(pt1, pt2, num_points=None):
    """
    Interpolate points between two detection points to create a continuous path.
    
    Args:
        pt1: (x, y) tuple of first point
        pt2: (x, y) tuple of second point
        num_points: Number of interpolated points (auto-calculated if None)
    
    Returns:
        List of (x, y) tuples representing the interpolated path
    """
    x1, y1 = pt1
    x2, y2 = pt2
    
    # Calculate distance between points
    distance = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)
    
    # Auto-calculate number of points based on distance (1 point per 5 pixels)
    if num_points is None:
        num_points = max(2, int(distance / 5))
    
    # Generate interpolated points
    points = []
    for i in range(num_points + 1):
        alpha = i / num_points if num_points > 0 else 0
        x = int(x1 + alpha * (x2 - x1))
        y = int(y1 + alpha * (y2 - y1))
        points.append((x, y))
    
    return points


# def test_homography_transformation(points, video_path, floorplan_path):
#     """Test function to debug homography transformation"""
#     print("=== HOMOGRAPHY TRANSFORMATION TEST ===")
#     
#     # Load floorplan
#     floorplan = cv2.imread(floorplan_path)
#     if floorplan is None:
#         print(f"ERROR: Could not load floorplan: {floorplan_path}")
#         return
#     
#     # Get video dimensions
#     cap = cv2.VideoCapture(video_path)
#     if not cap.isOpened():
#         print(f"ERROR: Could not open video: {video_path}")
#         return
#     
#     video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
#     video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
#     cap.release()
#     
#     floorplan_height, floorplan_width = floorplan.shape[:2]
#     
#     print(f"Video dimensions: {video_width}x{video_height}")
#     print(f"Floorplan dimensions: {floorplan_width}x{floorplan_height}")
#     print(f"Input points: {points}")
#     
#     if points is not None and len(points) == 4:
#         # Calculate homography matrix
#         src_pts = np.array(points, dtype=np.float32)
#         dst_pts = np.array([[0, 0], [floorplan_width-1, 0], [floorplan_width-1, floorplan_height-1], [0, floorplan_height-1]], dtype=np.float32)
#         H, _ = cv2.findHomography(src_pts, dst_pts)
#         print(f"Homography matrix:\n{H}")
#         
#         # Test transformation of corner points
#         for i, (src_pt, dst_pt) in enumerate(zip(src_pts, dst_pts)):
#             print(f"Corner {i}: src=({src_pt[0]:.1f}, {src_pt[1]:.1f}) -> expected_dst=({dst_pt[0]:.1f}, {dst_pt[1]:.1f})")
#             
#             # Test actual transformation
#             pt = np.array([[src_pt[0], src_pt[1]]], dtype=np.float32)
#             pt = np.array([pt])
#             mapped_pt = cv2.perspectiveTransform(pt, H)[0][0]
#             print(f"  -> actual_dst=({mapped_pt[0]:.1f}, {mapped_pt[1]:.1f})")
#     else:
#         print("ERROR: Invalid points provided for homography test")
#     
#     print("=== END TEST ===")


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
    
    # Group detections by track_id for path interpolation
    detections_by_track = {}
    for det in detections:
        track_id = det.get('track_id', -1)
        if track_id not in detections_by_track:
            detections_by_track[track_id] = []
        detections_by_track[track_id].append(det)
    
    # Sort detections by frame number within each track
    for track_id in detections_by_track:
        detections_by_track[track_id].sort(key=lambda d: d.get('frame', 0))
    
    # Process detections with interpolation between consecutive points
    circle_radius = 20  # Increased from 15 for better overlap
    line_thickness = 3  # Thickness for connecting lines
    
    for track_id, track_detections in detections_by_track.items():
        prev_mapped_point = None
        
        for det in track_detections:
            bbox = det['bbox']
            
            # Validate and get floor position (bottom center for feet position)
            try:
                center_x, center_y = get_floor_position_from_bbox(
                    bbox, video_width, video_height, use_bottom_center=True
                )
            except ValueError as e:
                logger.warning(f"Invalid bbox in custom heatmap: {bbox}, error: {e}")
                continue
            
            # Map coordinates to floorplan space
            # Ensure coordinates are within bounds
            center_x = max(0, min(center_x, video_width - 1))
            center_y = max(0, min(center_y, video_height - 1))
            
            mx = int(center_x * floorplan_width / video_width)
            my = int(center_y * floorplan_height / video_height)
            mx = max(0, min(mx, floorplan_width - 1))
            my = max(0, min(my, floorplan_height - 1))
            
            current_mapped_point = (mx, my)
            
            # Draw circle at current detection point
            cv2.circle(heatmap, current_mapped_point, circle_radius, 1.0, -1)
            
            # Interpolate and draw path from previous point to current point
            if prev_mapped_point is not None:
                # Calculate distance to determine if interpolation is needed
                distance = np.sqrt((mx - prev_mapped_point[0])**2 + (my - prev_mapped_point[1])**2)
                
                if distance > circle_radius * 2:  # Only interpolate if points are far apart
                    # Draw line between points with thickness
                    cv2.line(heatmap, prev_mapped_point, current_mapped_point, 1.0, line_thickness)
                    
                    # Add interpolated points along the path for smoother heatmap
                    interpolated_points = interpolate_path_between_points(prev_mapped_point, current_mapped_point)
                    for interp_point in interpolated_points[1:-1]:  # Skip endpoints (already drawn)
                        # Clamp to floorplan bounds
                        interp_x = max(0, min(interp_point[0], floorplan_width - 1))
                        interp_y = max(0, min(interp_point[1], floorplan_height - 1))
                        cv2.circle(heatmap, (interp_x, interp_y), circle_radius // 2, 0.8, -1)
                else:
                    # Points are close, just draw a line
                    cv2.line(heatmap, prev_mapped_point, current_mapped_point, 1.0, line_thickness)
            
            prev_mapped_point = current_mapped_point
    
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
    logger.info("DEBUG: ===== BLEND_HEATMAP FUNCTION STARTED =====")
    logger.info(f"DEBUG: Parameters - detections: {len(detections)}, floorplan_path: {floorplan_path}")
    logger.info(f"DEBUG: Parameters - output_heatmap_path: {output_heatmap_path}, video_path: {video_path}")
    
    try:
        floorplan = cv2.imread(floorplan_path)
        logger.info("DEBUG: Floorplan loaded successfully")
    except Exception as e:
        logger.error(f"DEBUG: Error in blend_heatmap: {e}")
        raise
    if floorplan is None:
        raise ValueError(f"Could not load floorplan image: {floorplan_path}")

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
    
    # Debug: Log coordinate mapping info
    logger.info(f"DEBUG: Video dimensions: {video_width}x{video_height}")
    logger.info(f"DEBUG: Floorplan dimensions: {floorplan_width}x{floorplan_height}")
    if detections:
        first_bbox = detections[0]['bbox']
        try:
            center_x, center_y = get_floor_position_from_bbox(
                first_bbox, video_width, video_height, use_bottom_center=True
            )
            logger.info(f"DEBUG: First detection bbox: {first_bbox}, floor position: ({center_x:.1f}, {center_y:.1f})")
        except Exception as e:
            logger.warning(f"DEBUG: Error processing first detection: {e}")
    
    # --- Direct coordinate mapping ---
    # Use static points directly without homography transformation
    print(f"DEBUG: Using direct coordinate mapping (no homography)")
    
    # COMMENTED OUT: Homography transformation code (kept for future use)
    # static_points = [
    #     [768, 204],   # top_left
    #     [690, 200],   # top_right  
    #     [655, 305],   # bottom_right
    #     [793, 309]    # bottom_left
    # ]
    # src_pts = np.array(static_points, dtype=np.float32)
    # dst_pts = np.array([[0, 0], [floorplan_width-1, 0], [floorplan_width-1, floorplan_height-1], [0, floorplan_height-1]], dtype=np.float32)
    # H, _ = cv2.findHomography(src_pts, dst_pts)

    heatmap = np.zeros(floorplan.shape[:2], dtype=np.float32)
    total_detections = len(detections)
    print(f"DEBUG: Processing {total_detections} detections for heatmap")
    
    # Group detections by track_id for path interpolation
    detections_by_track = {}
    for detection in detections:
        track_id = detection.get('track_id', -1)
        if track_id not in detections_by_track:
            detections_by_track[track_id] = []
        detections_by_track[track_id].append(detection)
    
    # Sort detections by frame number within each track
    for track_id in detections_by_track:
        detections_by_track[track_id].sort(key=lambda d: d.get('frame', 0))
    
    # Process detections with interpolation between consecutive points
    circle_radius = 20  # Increased from 15 for better overlap
    line_thickness = 3  # Thickness for connecting lines
    
    processed_count = 0  # Track total processed detections for progress
    
    for track_id, track_detections in detections_by_track.items():
        prev_mapped_point = None
        
        for i, detection in enumerate(track_detections):
            bbox = detection['bbox']
            
            # Validate and get floor position (bottom center for feet position)
            try:
                center_x, center_y = get_floor_position_from_bbox(
                    bbox, video_width, video_height, use_bottom_center=True
                )
            except ValueError as e:
                logger.warning(f"Invalid bbox for detection {i}: {bbox}, error: {e}")
                continue
            
            # Map video coordinates to floorplan coordinates
            # Ensure coordinates are within bounds
            center_x = max(0, min(center_x, video_width - 1))
            center_y = max(0, min(center_y, video_height - 1))
            
            # Direct coordinate mapping (proportional scaling)
            mx = int(center_x * floorplan_width / video_width)
            my = int(center_y * floorplan_height / video_height)
            
            # Clamp to floorplan bounds
            mx = max(0, min(mx, floorplan_width - 1))
            my = max(0, min(my, floorplan_height - 1))
            
            current_mapped_point = (mx, my)
            
            # Draw circle at current detection point
            cv2.circle(heatmap, current_mapped_point, circle_radius, 1.0, -1)
            
            # Interpolate and draw path from previous point to current point
            if prev_mapped_point is not None:
                # Calculate distance to determine if interpolation is needed
                distance = np.sqrt((mx - prev_mapped_point[0])**2 + (my - prev_mapped_point[1])**2)
                
                if distance > circle_radius * 2:  # Only interpolate if points are far apart
                    # Draw line between points with thickness
                    cv2.line(heatmap, prev_mapped_point, current_mapped_point, 1.0, line_thickness)
                    
                    # Add interpolated points along the path for smoother heatmap
                    interpolated_points = interpolate_path_between_points(prev_mapped_point, current_mapped_point)
                    for interp_point in interpolated_points[1:-1]:  # Skip endpoints (already drawn)
                        # Clamp to floorplan bounds
                        interp_x = max(0, min(interp_point[0], floorplan_width - 1))
                        interp_y = max(0, min(interp_point[1], floorplan_height - 1))
                        cv2.circle(heatmap, (interp_x, interp_y), circle_radius // 2, 0.8, -1)
                else:
                    # Points are close, just draw a line
                    cv2.line(heatmap, prev_mapped_point, current_mapped_point, 1.0, line_thickness)
            
            prev_mapped_point = current_mapped_point
            
            # Update progress
            processed_count += 1
            if progress_callback and total_detections > 0:
                progress = 0.5 * processed_count / total_detections
                progress_callback(progress)
        
        # COMMENTED OUT: Homography transformation code (kept for future use)
        # pt = np.array([[center_x, center_y]], dtype=np.float32)
        # pt = np.array([pt])  # shape (1, 1, 2)
        # mapped_pt = cv2.perspectiveTransform(pt, H)[0][0]
        # mx, my = int(mapped_pt[0]), int(mapped_pt[1])
        # if 0 <= mx < floorplan_width and 0 <= my < floorplan_height:
        #     cv2.circle(heatmap, (mx, my), 20, 1.0, -1)
        #     print(f"DEBUG: Detection {i}: video=({center_x:.1f}, {center_y:.1f}) -> floorplan=({mx}, {my})")
        # else:
        #     print(f"DEBUG: Detection {i}: video=({center_x:.1f}, {center_y:.1f}) -> floorplan=({mx}, {my}) [OUT OF BOUNDS]")
    
    print(f"DEBUG: Heatmap max value before processing: {heatmap.max()}")
    print(f"DEBUG: Heatmap non-zero pixels: {np.count_nonzero(heatmap)}")

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
    print(f"DEBUG: Alpha mask non-zero pixels: {np.count_nonzero(alpha_mask)}")
    
    # Check if we have any valid detections (non-zero heatmap)
    if total_detections == 0 or np.count_nonzero(heatmap) == 0:
        print("WARNING: No valid detections found, returning original floorplan")
        print(f"DEBUG: total_detections={total_detections}, non_zero_heatmap_pixels={np.count_nonzero(heatmap)}")
        if return_image:
            return floorplan
        else:
            return None

    if output_heatmap_path:
        cv2.imwrite(output_heatmap_path, blended)

    # Create video with detections (Phase 2: 50%–100%)
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Could not open video for processing")
    
    # Get video properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Create video writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
    
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
    
    logger.info("DEBUG: ===== REACHED END OF MAIN HEATMAP PROCESSING =====")
    logger.info("DEBUG: About to start progressive video creation...")
    
    # Create progressive heatmap video (save locally, upload later through main pipeline)
    logger.info("DEBUG: ===== ENTERING PROGRESSIVE VIDEO SECTION =====")
    logger.info("DEBUG: Creating progressive heatmap video...")
    logger.info(f"DEBUG: detections count: {len(detections)}")
    logger.info(f"DEBUG: output_heatmap_path: {output_heatmap_path}")
    logger.info(f"DEBUG: video_path: {video_path}")
    
    # Extract job ID from video path
    import re
    job_id_match = re.search(r'([a-f0-9-]{36})', video_path)
    job_id = job_id_match.group(1) if job_id_match else "unknown"
    logger.info(f"DEBUG: Extracted job_id: {job_id}")
    
    try:
        create_progressive_heatmap_video_local(detections, floorplan, job_id, video_path, points)
        logger.info("DEBUG: Progressive heatmap video creation completed")
    except Exception as e:
        logger.error(f"DEBUG: Progressive video error: {e}")
        import traceback
        logger.error(f"DEBUG: Progressive video traceback: {traceback.format_exc()}")
    
    if return_image:
        return blended
    else:
        return None


def create_progressive_heatmap_video_local(detections, floorplan, job_id, video_path, points=None):
    """
    Create a progressive heatmap video and save locally.
    Follows same pattern as other files - save locally, upload through main pipeline.
    """
    logger.info("DEBUG: ===== PROGRESSIVE VIDEO FUNCTION CALLED =====")
    logger.info(f"DEBUG: Function parameters - detections: {len(detections)}, job_id: {job_id}")
    try:
        # Open original video for frame-by-frame overlay
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.warning(f"DEBUG: Could not open video at path: {video_path}")
            return

        video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        if not fps or fps <= 0:
            fps = 25.0

        output_dir = f"/project_results/{job_id}"
        os.makedirs(output_dir, exist_ok=True)
        progressive_video_path = os.path.join(output_dir, f"progressive_heatmap_{job_id}.mp4")
        logger.info(f"DEBUG: Progressive video will be saved to: {progressive_video_path}")

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
        circle_radius = 20  # Increased from 15 for better overlap and continuity
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
        logger.info("DEBUG: Progressive heatmap video creation completed")
    except Exception as e:
        logger.error(f"DEBUG: Progressive video creation failed: {e}")
        import traceback
        logger.error(f"DEBUG: Traceback: {traceback.format_exc()}")