import os
import cv2
import numpy as np
from scipy.ndimage import gaussian_filter


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


def blend_heatmap(detections, floorplan_path, output_heatmap_path, output_video_path, video_path, points=None, progress_callback=None, return_image=False):
    """
    Generate and blend heatmap from detections using homography transformation.
    
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
    print(f"DEBUG: blend_heatmap called with {len(detections)} detections")
    print(f"DEBUG: First few detections: {detections[:3] if detections else 'None'}")
    print(f"DEBUG: Received points for mapping: {points}")
    
    # Check if detections are in a different coordinate space
    if detections:
        first_bbox = detections[0]['bbox']
        print(f"DEBUG: First bbox: {first_bbox}")
        print(f"DEBUG: Bbox coordinates are much larger than video dimensions - possible coordinate system mismatch!")
    
    floorplan = cv2.imread(floorplan_path)
    if floorplan is None:
        raise ValueError(f"Could not load floorplan image: {floorplan_path}")

    # Get video dimensions
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Could not open video for verification")
    
    video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    
    floorplan_height, floorplan_width = floorplan.shape[:2]
    
    print(f"DEBUG: Video dimensions: {video_width}x{video_height}")
    print(f"DEBUG: Floorplan dimensions: {floorplan_width}x{floorplan_height}")
    
    # Debug: Check first few detection coordinates
    if detections:
        print(f"DEBUG: First detection bbox: {detections[0]['bbox']}")
        center_x = (detections[0]['bbox'][0] + detections[0]['bbox'][2]) / 2
        center_y = (detections[0]['bbox'][1] + detections[0]['bbox'][3]) / 2
        print(f"DEBUG: First detection center: ({center_x:.1f}, {center_y:.1f})")
        print(f"DEBUG: Detection center as % of video: ({center_x/video_width*100:.1f}%, {center_y/video_height*100:.1f}%)")
        
        # Check if coordinates are way outside video bounds
        if center_x > video_width * 2 or center_y > video_height * 2:
            print(f"DEBUG: WARNING - Detection coordinates are much larger than video dimensions!")
            print(f"DEBUG: This suggests the detections might be in a different coordinate space")
            print(f"DEBUG: Video: {video_width}x{video_height}, Detection center: ({center_x:.1f}, {center_y:.1f})")
    
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
    
    for i, detection in enumerate(detections):
        bbox = detection['bbox']
        # Get bounding box center in video coordinates
        center_x = (bbox[0] + bbox[2]) / 2
        center_y = (bbox[1] + bbox[3]) / 2
        
        # Use direct coordinate mapping (no homography)
        mx = int(center_x * floorplan_width / video_width)
        my = int(center_y * floorplan_height / video_height)
        mx = max(0, min(mx, floorplan_width - 1))
        my = max(0, min(my, floorplan_height - 1))
        cv2.circle(heatmap, (mx, my), 20, 1.0, -1)
        
        # Debug first few detections
        if i < 3:
            print(f"DEBUG: Detection {i}: video=({center_x:.1f}, {center_y:.1f}) -> floorplan=({mx}, {my}) [DIRECT MAPPING]")
            print(f"DEBUG:  -> Raw mapping: ({center_x * floorplan_width / video_width:.1f}, {center_y * floorplan_height / video_height:.1f})")
            print(f"DEBUG:  -> As % of floorplan: ({mx/floorplan_width*100:.1f}%, {my/floorplan_height*100:.1f}%)")
        
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
        
        if progress_callback and total_detections > 0:
            progress = 0.5 * (i + 1) / total_detections
            progress_callback(progress)
    
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
    if return_image:
        return blended
    else:
        return None
