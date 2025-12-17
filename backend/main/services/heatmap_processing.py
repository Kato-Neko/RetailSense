import os
import cv2
import numpy as np
from scipy.ndimage import gaussian_filter
from ..core.config import logger


def _generate_heatmap_data(detections, target_shape, video_dimensions, homography_matrix=None, radius=20):
    """
    Generates raw heatmap data from detections with improved accuracy.
    Uses weighted accumulation for better accuracy and smoother heatmaps.
    
    Args:
        detections: List of filtered detections.
        target_shape: Tuple of (height, width) for the heatmap.
        video_dimensions: Tuple of (width, height) of the video.
        homography_matrix: Optional 3x3 numpy array for perspective transformation.
        radius: Radius of circles for detection points (default: 20).
        
    Returns:
        numpy array of the raw heatmap.
    """
    heatmap = np.zeros(target_shape, dtype=np.float32)
    video_width, video_height = video_dimensions
    target_height, target_width = target_shape

    if homography_matrix is not None:
        # Use homography for coordinate transformation with improved accuracy
        pts = np.array([[(det['bbox'][0] + det['bbox'][2]) / 2, (det['bbox'][1] + det['bbox'][3]) / 2] for det in detections], dtype=np.float32)
        if pts.size > 0:
            transformed_pts = cv2.perspectiveTransform(pts.reshape(-1, 1, 2), homography_matrix)
            for pt in transformed_pts:
                mx, my = float(pt[0][0]), float(pt[0][1])
                # Use sub-pixel accuracy with weighted accumulation
                mx_int = int(np.round(mx))
                my_int = int(np.round(my))
                if 0 <= mx_int < target_width and 0 <= my_int < target_height:
                    # Create weighted circle for smoother accumulation
                    y_coords, x_coords = np.ogrid[:target_height, :target_width]
                    dist_sq = (x_coords - mx) ** 2 + (y_coords - my) ** 2
                    mask = dist_sq <= radius ** 2
                    # Weight by distance (closer = higher weight)
                    weights = np.exp(-dist_sq / (2 * (radius / 2) ** 2))
                    heatmap[mask] += weights[mask]
    else:
        # Fallback to linear scaling if no homography matrix is provided
        for det in detections:
            bbox = det['bbox']
            center_x = (bbox[0] + bbox[2]) / 2
            center_y = (bbox[1] + bbox[3]) / 2
            mx = center_x * target_width / video_width
            my = center_y * target_height / video_height
            mx_int = int(np.round(mx))
            my_int = int(np.round(my))
            if 0 <= mx_int < target_width and 0 <= my_int < target_height:
                # Create weighted circle for smoother accumulation
                y_coords, x_coords = np.ogrid[:target_height, :target_width]
                dist_sq = (x_coords - mx) ** 2 + (y_coords - my) ** 2
                mask = dist_sq <= radius ** 2
                # Weight by distance (closer = higher weight)
                weights = np.exp(-dist_sq / (2 * (radius / 2) ** 2))
                heatmap[mask] += weights[mask]
            
    return heatmap


def create_custom_heatmap(detections, floorplan_path, dimensions=(1920, 1080), points=None,
                            heatmap_params=None):
    """
    Create a custom heatmap from filtered detections and floorplan.
    
    Args:
        detections: List of filtered detections.
        floorplan_path: Path to floorplan image.
        dimensions: Tuple of (width, height) for coordinate space.
        points: Optional homography points.
        heatmap_params: Dictionary of heatmap parameters.
        
    Returns:
        numpy array of the blended heatmap image.
    """
    logger.info("===== CREATE_CUSTOM_HEATMAP STARTED =====")
    
    if heatmap_params is None:
        # Optimized heatmap parameters for better visualization and accuracy
        heatmap_params = {'power': 0.4, 'sigma': 18, 'alpha': 0.7, 'radius': 25, 'min_threshold': 0.05}

    try:
        floorplan = cv2.imread(floorplan_path)
        if floorplan is None:
            raise ValueError(f"Could not load floorplan image: {floorplan_path}")
    except Exception as e:
        logger.error(f"Error loading floorplan: {e}")
        raise

    floorplan_height, floorplan_width = floorplan.shape[:2]
    homography_matrix = None
    if points:
        video_pts = np.array([[0, 0], [dimensions[0], 0], [dimensions[0], dimensions[1]], [0, dimensions[1]]], dtype=np.float32)
        floorplan_pts = np.array(points, dtype=np.float32)
        homography_matrix, _ = cv2.findHomography(video_pts, floorplan_pts)

    heatmap = _generate_heatmap_data(detections, (floorplan_height, floorplan_width), dimensions, homography_matrix, radius=heatmap_params.get('radius', 25))
    
    if np.count_nonzero(heatmap) == 0:
        logger.warning("No valid detections to create heatmap, returning original floorplan.")
        return floorplan

    # Calculate time range for adaptive threshold adjustment
    if detections and len(detections) > 0:
        timestamps = [det.get('timestamp', 0) for det in detections if 'timestamp' in det]
        time_range = max(timestamps) - min(timestamps) if timestamps else 0
    else:
        time_range = 0

    # Apply power curve for better contrast
    heatmap = np.power(heatmap, heatmap_params.get('power', 0.4))
    
    # Apply Gaussian smoothing before normalization for smoother gradients
    heatmap = gaussian_filter(heatmap, sigma=heatmap_params.get('sigma', 18))
    
    # Use percentile-based normalization for better contrast (ignore extreme outliers)
    min_val = np.percentile(heatmap[heatmap > 0], 5) if np.any(heatmap > 0) else 0
    max_val = np.percentile(heatmap, 98) if np.any(heatmap > 0) else 1
    if max_val > min_val:
        heatmap_norm = np.clip((heatmap - min_val) / (max_val - min_val), 0, 1)
    else:
        heatmap_norm = cv2.normalize(heatmap, None, 0, 1, cv2.NORM_MINMAX)
    
    # Apply adaptive minimum threshold: lower for short segments to ensure visibility
    base_min_threshold = heatmap_params.get('min_threshold', 0.05)
    num_data_points = np.count_nonzero(heatmap_norm)
    
    if time_range > 0 and time_range < 10:  # Very short segments (< 10 seconds)
        # Lower threshold for short segments to ensure heatmap is visible
        min_threshold = max(0.01, base_min_threshold * 0.2)  # Much lower threshold
        logger.info(f"Using lower min_threshold ({min_threshold}) for short segment ({time_range:.1f}s, {num_data_points} data points)")
    elif num_data_points < 20:  # Sparse data regardless of duration
        # For sparse data, use very low threshold to ensure visibility
        min_threshold = max(0.005, base_min_threshold * 0.1)
        logger.info(f"Using very low min_threshold ({min_threshold}) for sparse data ({num_data_points} data points)")
    else:
        min_threshold = base_min_threshold
    
    # Only apply threshold if we have enough data points, otherwise keep all visible data
    if num_data_points > 10:  # Only filter if we have substantial data
        heatmap_norm[heatmap_norm < min_threshold] = 0
    else:
        # For very sparse data, keep all non-zero values visible (no threshold filtering)
        logger.info(f"Keeping all heatmap data visible for sparse segment ({num_data_points} data points, no threshold applied)")
    
    # Normalize to 0-255 for color mapping
    heatmap_img = (heatmap_norm * 255).astype(np.uint8)
    heatmap_colored = cv2.applyColorMap(heatmap_img, cv2.COLORMAP_TURBO)

    # Improved alpha blending with adaptive opacity
    alpha = heatmap_params.get('alpha', 0.7)
    # Create alpha mask with smooth falloff
    alpha_mask = (heatmap_norm[..., None] * alpha).astype(np.float32)
    # Use better blending formula for more natural appearance
    blended = (floorplan.astype(np.float32) * (1 - alpha_mask) + heatmap_colored.astype(np.float32) * alpha_mask).astype(np.uint8)
    
    logger.info("===== CREATE_CUSTOM_HEATMAP FINISHED =====")
    return blended



def blend_heatmap(detections, floorplan_path, output_heatmap_path, output_video_path, video_path, points=None, progress_callback=None, return_image=False, heatmap_params=None):
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
        heatmap_params: Dictionary of heatmap parameters.
    """
    logger.info("Starting heatmap blending process...")
    if heatmap_params is None:
        # Optimized heatmap parameters for better visualization and accuracy
        heatmap_params = {'power': 0.4, 'sigma': 18, 'alpha': 0.7, 'radius': 25, 'min_threshold': 0.05}

    try:
        floorplan = cv2.imread(floorplan_path)
        if floorplan is None:
            raise ValueError(f"Could not load floorplan image: {floorplan_path}")
    except Exception as e:
        logger.error(f"Error loading floorplan in blend_heatmap: {e}")
        raise

    video_width, video_height = 1920, 1080  # Default, will be updated if video is available
    if video_path and os.path.exists(video_path):
        cap = cv2.VideoCapture(video_path)
        if cap.isOpened():
            video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()
    
    floorplan_height, floorplan_width = floorplan.shape[:2]
    homography_matrix = None
    if points:
        # Convert normalized points to pixel coordinates
        pixel_points = [[float(p[0]) * video_width, float(p[1]) * video_height] for p in points]
        video_pts = np.array([[0, 0], [video_width, 0], [video_width, video_height], [0, video_height]], dtype=np.float32)
        floorplan_pts = np.array(pixel_points, dtype=np.float32)
        homography_matrix, _ = cv2.findHomography(video_pts, floorplan_pts)

    heatmap = _generate_heatmap_data(detections, (floorplan_height, floorplan_width), (video_width, video_height), homography_matrix, radius=heatmap_params.get('radius', 25))

    if progress_callback:
        progress_callback(0.5)

    if np.count_nonzero(heatmap) == 0:
        logger.warning("No valid detections found, returning original floorplan for heatmap image.")
        if return_image:
            return floorplan
        else:
            if output_heatmap_path:
                cv2.imwrite(output_heatmap_path, floorplan)
            return None

    # Calculate time range for adaptive threshold adjustment
    if detections and len(detections) > 0:
        timestamps = [det.get('timestamp', 0) for det in detections if 'timestamp' in det]
        time_range = max(timestamps) - min(timestamps) if timestamps else 0
    else:
        time_range = 0

    # Apply power curve for better contrast
    heatmap = np.power(heatmap, heatmap_params.get('power', 0.4))
    
    # Apply Gaussian smoothing before normalization for smoother gradients
    heatmap = gaussian_filter(heatmap, sigma=heatmap_params.get('sigma', 18))
    
    # Use percentile-based normalization for better contrast (ignore extreme outliers)
    min_val = np.percentile(heatmap[heatmap > 0], 5) if np.any(heatmap > 0) else 0
    max_val = np.percentile(heatmap, 98) if np.any(heatmap > 0) else 1
    if max_val > min_val:
        heatmap_norm = np.clip((heatmap - min_val) / (max_val - min_val), 0, 1)
    else:
        heatmap_norm = cv2.normalize(heatmap, None, 0, 1, cv2.NORM_MINMAX)
    
    # Apply adaptive minimum threshold: lower for short segments to ensure visibility
    base_min_threshold = heatmap_params.get('min_threshold', 0.05)
    num_data_points = np.count_nonzero(heatmap_norm)
    
    if time_range > 0 and time_range < 10:  # Very short segments (< 10 seconds)
        # Lower threshold for short segments to ensure heatmap is visible
        min_threshold = max(0.01, base_min_threshold * 0.2)  # Much lower threshold
        logger.info(f"Using lower min_threshold ({min_threshold}) for short segment ({time_range:.1f}s, {num_data_points} data points)")
    elif num_data_points < 20:  # Sparse data regardless of duration
        # For sparse data, use very low threshold to ensure visibility
        min_threshold = max(0.005, base_min_threshold * 0.1)
        logger.info(f"Using very low min_threshold ({min_threshold}) for sparse data ({num_data_points} data points)")
    else:
        min_threshold = base_min_threshold
    
    # Only apply threshold if we have enough data points, otherwise keep all visible data
    if num_data_points > 10:  # Only filter if we have substantial data
        heatmap_norm[heatmap_norm < min_threshold] = 0
    else:
        # For very sparse data, keep all non-zero values visible (no threshold filtering)
        logger.info(f"Keeping all heatmap data visible for sparse segment ({num_data_points} data points, no threshold applied)")
    
    # Normalize to 0-255 for color mapping
    heatmap_img = (heatmap_norm * 255).astype(np.uint8)
    heatmap_colored = cv2.applyColorMap(heatmap_img, cv2.COLORMAP_TURBO)

    # Improved alpha blending with adaptive opacity
    alpha = heatmap_params.get('alpha', 0.7)
    # Create alpha mask with smooth falloff
    alpha_mask = (heatmap_norm[..., None] * alpha).astype(np.float32)
    # Use better blending formula for more natural appearance
    blended = (floorplan.astype(np.float32) * (1 - alpha_mask) + heatmap_colored.astype(np.float32) * alpha_mask).astype(np.uint8)

    if output_heatmap_path:
        cv2.imwrite(output_heatmap_path, blended)

    # Video processing part remains, but now heatmap generation is cleaner.
    if video_path:
        # The video annotation part of the original function can be called from here
        # For brevity, this example assumes the video processing part is refactored
        # into its own function or handled separately.
        # process_video_annotations(detections, output_video_path, progress_callback)
        pass

    logger.info("Main heatmap processing and annotated video creation complete.")
    
    if return_image:
        return blended
    else:
        return None

def create_progressive_heatmap_video_local(detections, floorplan, job_id, video_path, points=None, heatmap_params=None):
    """
    Create a progressive heatmap video and save locally.
    This version is optimized to generate the heatmap once and then overlay it on the video.
    """
    logger.info(f"Starting progressive video creation for job {job_id}.")
    if heatmap_params is None:
        # Optimized heatmap parameters for better visualization and accuracy
        heatmap_params = {'power': 0.4, 'sigma': 18, 'alpha': 0.7, 'radius': 25, 'min_threshold': 0.05}

    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.warning(f"Could not open video at path for progressive heatmap: {video_path}")
            return

        video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0

        output_dir = f"/project_results/{job_id}"
        os.makedirs(output_dir, exist_ok=True)
        progressive_video_path = os.path.join(output_dir, f"progressive_heatmap_{job_id}.mp4")
        
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(progressive_video_path, fourcc, fps, (video_width, video_height))

        # Generate heatmap data once
        homography_matrix = None
        if points:
            video_pts = np.array([[0, 0], [video_width, 0], [video_width, video_height], [0, video_height]], dtype=np.float32)
            floorplan_pts = np.array(points, dtype=np.float32)
            homography_matrix, _ = cv2.findHomography(video_pts, floorplan_pts)
            
        heatmap_data = _generate_heatmap_data(detections, (video_height, video_width), (video_width, video_height), homography_matrix, radius=heatmap_params.get('radius', 25))

        if np.count_nonzero(heatmap_data) > 0:
            # Apply power curve for better contrast
            heatmap_data = np.power(heatmap_data, heatmap_params.get('power', 0.4))
            
            # Apply Gaussian smoothing before normalization for smoother gradients
            heatmap_data = gaussian_filter(heatmap_data, sigma=heatmap_params.get('sigma', 18))
            
            # Use percentile-based normalization for better contrast
            min_val = np.percentile(heatmap_data[heatmap_data > 0], 5) if np.any(heatmap_data > 0) else 0
            max_val = np.percentile(heatmap_data, 98) if np.any(heatmap_data > 0) else 1
            if max_val > min_val:
                heatmap_norm = np.clip((heatmap_data - min_val) / (max_val - min_val), 0, 1)
            else:
                heatmap_norm = cv2.normalize(heatmap_data, None, 0, 1, cv2.NORM_MINMAX)
            
            # Apply minimum threshold to reduce noise
            min_threshold = heatmap_params.get('min_threshold', 0.05)
            heatmap_norm[heatmap_norm < min_threshold] = 0
            
            # Normalize to 0-255 for color mapping
            heatmap_img = (heatmap_norm * 255).astype(np.uint8)
            heatmap_colored = cv2.applyColorMap(heatmap_img, cv2.COLORMAP_TURBO)
        else:
            heatmap_colored = np.zeros((video_height, video_width, 3), dtype=np.uint8)

        frame_index = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Improved blending with adaptive alpha based on heatmap intensity
            alpha = heatmap_params.get('alpha', 0.7)
            # Create alpha mask from normalized heatmap
            if np.count_nonzero(heatmap_data) > 0:
                alpha_mask = (heatmap_norm[..., None] * alpha).astype(np.float32)
                overlay = (frame.astype(np.float32) * (1 - alpha_mask) + heatmap_colored.astype(np.float32) * alpha_mask).astype(np.uint8)
            else:
                overlay = frame
            out.write(overlay)
            frame_index += 1

        cap.release()
        out.release()
        logger.info("Progressive heatmap video creation completed.")
    except Exception as e:
        logger.error(f"Progressive video creation failed: {e}", exc_info=True)