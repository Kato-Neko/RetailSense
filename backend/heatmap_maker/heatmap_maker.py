"""
heatmap_maker.py
Handles heatmap generation and blending logic for the backend.
"""

import cv2
import numpy as np
from scipy.ndimage import gaussian_filter
import os

def blend_heatmap(detections, floorplan_path, output_heatmap_path, output_video_path, points, preview_folder=None, progress_callback=None):
    """
    Generate and blend heatmap from detections.
    
    Args:
        detections: List of detections from object tracking
        floorplan_path: Path to floorplan image
        output_heatmap_path: Path to save the heatmap image
        output_video_path: Path to save the processed video
        points: List of 4 user-provided points for mapping
        preview_folder: Optional folder to save preview heatmaps
        progress_callback: Optional callback function(progress) to report progress
    """
    print(f"[DEBUG] Received points for mapping: {points}")
    # Load floorplan
    floorplan = cv2.imread(floorplan_path)
    if floorplan is None:
        raise ValueError(f"Could not load floorplan image: {floorplan_path}")
    
    # --- Homography mapping setup ---
    # Assume points is a list of 4 dicts: [{src_x, src_y, dst_x, dst_y}, ...] or [[src_x, src_y], ...] and [[dst_x, dst_y], ...]
    # For this implementation, assume points = [video_tl, video_tr, video_br, video_bl] (video frame corners in video coordinates)
    # and the destination is the same order in floorplan coordinates (full image corners)
    h, w = floorplan.shape[:2]
    # src_pts: corners of the video frame (in video coordinates)
    src_pts = np.array(points, dtype=np.float32)
    # dst_pts: corners of the floorplan image
    dst_pts = np.array([[0, 0], [w-1, 0], [w-1, h-1], [0, h-1]], dtype=np.float32)
    H, _ = cv2.findHomography(src_pts, dst_pts)
    print(f"[DEBUG] Homography matrix:\n{H}")

    # Create heatmap canvas
    heatmap = np.zeros(floorplan.shape[:2], dtype=np.float32)
    
    # Process detections
    total_detections = len(detections)
    for i, detection in enumerate(detections):
        # Get bounding box center in video coordinates
        bbox = detection['bbox']
        center_x = (bbox[0] + bbox[2]) / 2
        center_y = (bbox[1] + bbox[3]) / 2
        pt = np.array([[center_x, center_y]], dtype=np.float32)
        pt = np.array([pt])  # shape (1, 1, 2)
        mapped_pt = cv2.perspectiveTransform(pt, H)[0][0]
        mx, my = int(mapped_pt[0]), int(mapped_pt[1])
        # Add Gaussian kernel at mapped detection point
        if 0 <= mx < w and 0 <= my < h:
            cv2.circle(heatmap, (mx, my), 20, 1.0, -1)
        # Save preview heatmap every 20 detections
        if preview_folder and i % 20 == 0 and i > 0:
            # Generate preview heatmap image
            heatmap_preview = np.power(heatmap, 0.6)
            heatmap_norm = cv2.normalize(heatmap_preview, None, 0, 1, cv2.NORM_MINMAX)
            heatmap_img = cv2.normalize(heatmap_preview, None, 0, 255, cv2.NORM_MINMAX)
            heatmap_img = gaussian_filter(heatmap_img, sigma=10)
            heatmap_colored = cv2.applyColorMap(heatmap_img.astype(np.uint8), cv2.COLORMAP_JET)
            alpha_mask = heatmap_norm[..., None] * 0.7
            blended = (floorplan * (1 - alpha_mask) + heatmap_colored * alpha_mask).astype(np.uint8)
            preview_path = os.path.join(preview_folder, 'preview_heatmap.jpg')
            cv2.imwrite(preview_path, blended)
        # Update progress
        if progress_callback:
            progress = (i + 1) / total_detections
            progress_callback(progress)
    
    # Apply gamma correction to brighten low values
    heatmap = np.power(heatmap, 0.6)
    heatmap_norm = cv2.normalize(heatmap, None, 0, 1, cv2.NORM_MINMAX)  # For alpha mask
    heatmap_img = cv2.normalize(heatmap, None, 0, 255, cv2.NORM_MINMAX)

    # Apply Gaussian blur
    heatmap_img = gaussian_filter(heatmap_img, sigma=10)

    # Convert to color heatmap (blue-green)
    heatmap_colored = cv2.applyColorMap(heatmap_img.astype(np.uint8), cv2.COLORMAP_OCEAN)

    # Per-pixel alpha blending: alpha is higher for high-traffic, lower for low-traffic
    alpha_mask = heatmap_norm[..., None]  # Shape (H, W, 1)
    # Optionally, scale alpha to max 0.7 for even more transparency
    alpha_mask = alpha_mask * 0.7
    blended = (floorplan * (1 - alpha_mask) + heatmap_colored * alpha_mask).astype(np.uint8)
    
    # Save heatmap image
    cv2.imwrite(output_heatmap_path, blended)
    
    # Save raw grayscale heatmap for debugging
    cv2.imwrite(output_heatmap_path.replace('.jpg', '_raw_gray.jpg'), heatmap_img.astype(np.uint8))

    # Save a test gradient image with the same colormap and alpha blending for debugging
    h, w = floorplan.shape[:2]
    gradient = np.tile(np.linspace(0, 1, w, dtype=np.float32), (h, 1))
    gradient_img = (gradient * 255).astype(np.uint8)
    gradient_colored = cv2.applyColorMap(gradient_img, cv2.COLORMAP_TURBO)
    gradient_alpha = (gradient * 0.7)[..., None]
    gradient_blended = (floorplan * (1 - gradient_alpha) + gradient_colored * gradient_alpha).astype(np.uint8)
    cv2.imwrite(output_heatmap_path.replace('.jpg', '_gradient_blend.jpg'), gradient_blended)
    
    # --- Video overlay code moved to video_overlay.py ---
    # See video_overlay.py for code to generate a processed video with overlays.
    # --- End note ---

# Add more heatmap-related utilities as needed 