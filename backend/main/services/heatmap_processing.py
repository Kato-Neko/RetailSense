import os
import cv2
import numpy as np
from scipy.ndimage import gaussian_filter


def test_coordinate_transformation(detections, video_path, floorplan_path):
    """Test function to debug coordinate transformation issues"""
    print("=== COORDINATE TRANSFORMATION TEST ===")
    
    # Load floorplan
    floorplan = cv2.imread(floorplan_path)
    if floorplan is None:
        print(f"ERROR: Could not load floorplan: {floorplan_path}")
        return
    
    # Get video dimensions
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"ERROR: Could not open video: {video_path}")
        return
    
    video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    
    floorplan_height, floorplan_width = floorplan.shape[:2]
    scale_x = floorplan_width / video_width
    scale_y = floorplan_height / video_height
    
    print(f"Video dimensions: {video_width}x{video_height}")
    print(f"Floorplan dimensions: {floorplan_width}x{floorplan_height}")
    print(f"Scale factors: x={scale_x:.3f}, y={scale_y:.3f}")
    print(f"Number of detections: {len(detections)}")
    
    # Test first few detections
    for i, detection in enumerate(detections[:5]):  # Test first 5 detections
        bbox = detection['bbox']
        original_center_x = (bbox[0] + bbox[2]) / 2
        original_center_y = (bbox[1] + bbox[3]) / 2
        
        center_x = int(original_center_x * scale_x)
        center_y = int(original_center_y * scale_y)
        
        out_of_bounds = (center_x < 0 or center_x >= floorplan_width or 
                        center_y < 0 or center_y >= floorplan_height)
        
        print(f"Detection {i}: video=({original_center_x:.1f}, {original_center_y:.1f}) -> floorplan=({center_x}, {center_y}) {'[OUT OF BOUNDS]' if out_of_bounds else ''}")
    
    print("=== END TEST ===")


def blend_heatmap(detections, floorplan_path, output_heatmap_path, output_video_path, video_path, progress_callback=None, return_image=False):
    print(f"DEBUG: blend_heatmap called with {len(detections)} detections")
    print(f"DEBUG: First few detections: {detections[:3] if detections else 'None'}")
    
    floorplan = cv2.imread(floorplan_path)
    if floorplan is None:
        raise ValueError(f"Could not load floorplan image: {floorplan_path}")

    # Get video dimensions for verification
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Could not open video for verification")
    
    video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    
    floorplan_height, floorplan_width = floorplan.shape[:2]
    
    print(f"DEBUG: Video dimensions: {video_width}x{video_height}")
    print(f"DEBUG: Floorplan dimensions: {floorplan_width}x{floorplan_height}")
    
    # Verify that floorplan and video have the same dimensions
    if floorplan_width != video_width or floorplan_height != video_height:
        print(f"WARNING: Floorplan size ({floorplan_width}x{floorplan_height}) doesn't match video size ({video_width}x{video_height})")
        print("This might cause coordinate misalignment!")

    heatmap = np.zeros(floorplan.shape[:2], dtype=np.float32)
    total_detections = len(detections)
    print(f"DEBUG: Processing {total_detections} detections for heatmap")
    
    for i, detection in enumerate(detections):
        bbox = detection['bbox']
        # Use detection coordinates directly (no transformation needed)
        center_x = int((bbox[0] + bbox[2]) / 2)
        center_y = int((bbox[1] + bbox[3]) / 2)
        
        # Ensure coordinates are within bounds
        center_x = max(0, min(center_x, floorplan_width - 1))
        center_y = max(0, min(center_y, floorplan_height - 1))
        
        print(f"DEBUG: Detection {i}: center=({center_x}, {center_y})")
        
        cv2.circle(heatmap, (center_x, center_y), 20, 1.0, -1)
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
