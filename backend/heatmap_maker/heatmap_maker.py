"""
heatmap_maker.py
Handles heatmap generation and blending logic for the backend.
"""

import cv2
import numpy as np
from scipy.ndimage import gaussian_filter

# Add this after your imports
custom_heatmap_progress = {}

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

def blend_heatmap(detections, floorplan_path, output_heatmap_path, output_video_path, video_path, progress_callback=None):
    """
    Generate and blend heatmap from detections.
    
    Args:
        detections: List of detections from object tracking
        floorplan_path: Path to floorplan image
        output_heatmap_path: Path to save the heatmap image
        output_video_path: Path to save the processed video
        video_path: Path to the video
        progress_callback: Optional callback function(progress) to report progress
    """
    # Load floorplan
    floorplan = cv2.imread(floorplan_path)
    if floorplan is None:
        raise ValueError(f"Could not load floorplan image: {floorplan_path}")
    
    # Create heatmap canvas
    heatmap = np.zeros(floorplan.shape[:2], dtype=np.float32)
    
    # Process detections
    total_detections = len(detections)
    for i, detection in enumerate(detections):
        # Get bounding box center
        bbox = detection['bbox']
        center_x = int((bbox[0] + bbox[2]) / 2)
        center_y = int((bbox[1] + bbox[3]) / 2)
        
        # Add Gaussian kernel at detection point
        cv2.circle(heatmap, (center_x, center_y), 20, 1.0, -1)
        
        # Update progress (0 to 0.5)
        if progress_callback:
            progress = 0.5 * ((i + 1) / total_detections) if total_detections > 0 else 0
            progress_callback(progress)
    
    # Apply gamma correction to brighten low values
    heatmap = np.power(heatmap, 0.6)
    heatmap_norm = cv2.normalize(heatmap, None, 0, 1, cv2.NORM_MINMAX)  # For alpha mask
    heatmap_img = cv2.normalize(heatmap, None, 0, 255, cv2.NORM_MINMAX)

    # Apply Gaussian blur
    heatmap_img = gaussian_filter(heatmap_img, sigma=10)

    # Convert to color heatmap (blue-green-yellow-red)
    heatmap_colored = cv2.applyColorMap(heatmap_img.astype(np.uint8), cv2.COLORMAP_TURBO)

    # Per-pixel alpha blending: alpha is higher for high-traffic, lower for low-traffic
    alpha_mask = heatmap_norm[..., None]  # Shape (H, W, 1)
    # Optionally, scale alpha to max 0.7 for even more transparency
    alpha_mask = alpha_mask * 0.7
    blended = (floorplan * (1 - alpha_mask) + heatmap_colored * alpha_mask).astype(np.uint8)
    
    # Save heatmap image
    cv2.imwrite(output_heatmap_path, blended)
    
    # Create video with detections
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
        # Update progress (0.5 to 1.0)
        if progress_callback and total_frames > 0:
            progress = 0.5 + 0.5 * (frame_count / total_frames)
            progress_callback(progress)
    
    # Release resources
    cap.release()
    out.release()

def analyze_heatmap(heatmap, floorplan_shape, detections=None, fps=None):
    """
    Analyze heatmap data to identify traffic patterns and generate insights.
    
    Args:
        heatmap: numpy array of heatmap data
        floorplan_shape: tuple of (height, width) of the floorplan
        detections: List of detections from object tracking
        fps: Frames per second of the video
        
    Returns:
        dict containing analysis results
    """
    # Normalize heatmap to 0-100 range for percentage calculations
    heatmap_norm = cv2.normalize(heatmap, None, 0, 100, cv2.NORM_MINMAX)
    
    # Define traffic thresholds
    HIGH_THRESHOLD = 70
    MEDIUM_THRESHOLD = 40
    LOW_THRESHOLD = 20
    
    # Calculate total area
    total_area = floorplan_shape[0] * floorplan_shape[1]
    
    # Initialize areas dictionary
    areas = {
        'high': {'pixels': 0, 'regions': []},
        'medium': {'pixels': 0, 'regions': []},
        'low': {'pixels': 0, 'regions': []}
    }
    
    # Analyze regions
    height, width = heatmap_norm.shape
    region_size = 50  # Size of region to analyze (in pixels)
    
    for y in range(0, height, region_size):
        for x in range(0, width, region_size):
            # Get region
            region = heatmap_norm[y:min(y+region_size, height), x:min(x+region_size, width)]
            avg_density = np.mean(region)
            
            # Categorize region
            if avg_density >= HIGH_THRESHOLD:
                areas['high']['pixels'] += region.size
                areas['high']['regions'].append({
                    'x': x,
                    'y': y,
                    'density': round(avg_density, 1)
                })
            elif avg_density >= MEDIUM_THRESHOLD:
                areas['medium']['pixels'] += region.size
                areas['medium']['regions'].append({
                    'x': x,
                    'y': y,
                    'density': round(avg_density, 1)
                })
            elif avg_density >= LOW_THRESHOLD:
                areas['low']['pixels'] += region.size
                areas['low']['regions'].append({
                    'x': x,
                    'y': y,
                    'density': round(avg_density, 1)
                })
    
    # Calculate percentages
    for category in areas:
        areas[category]['percentage'] = round((areas[category]['pixels'] / total_area) * 100, 1)
    
    # Generate recommendations
    recommendations = []
    
    if areas['high']['percentage'] > 30:
        recommendations.append("Consider redistributing traffic from high-density areas to improve customer flow")
    if areas['low']['percentage'] > 40:
        recommendations.append("Implement strategies to increase traffic in low-density areas")
    if areas['medium']['percentage'] < 30:
        recommendations.append("Optimize store layout to create more balanced traffic distribution")
    
    # Add peak hours analysis if available
    if detections and fps:
        peak_hours = analyze_peak_hours(detections, fps)
    else:
        peak_hours = []
    
    if detections:
        unique_ids = set(det['track_id'] for det in detections if 'track_id' in det)
        total_visitors = len(unique_ids)
    else:
        total_visitors = 0
    
    return {
        'areas': areas,
        'recommendations': recommendations,
        'peak_hours': peak_hours,
        'total_visitors': total_visitors
    }

# Add more heatmap-related utilities as needed 