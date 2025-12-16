import numpy as np
import cv2
import os

# Try to import AI analysis module (optional)
try:
    from .ai_analysis import generate_ai_recommendations
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False


def count_unique_visitors(detections, fps=None, min_track_duration=1.0, min_detections=3, merge_close_tracks=True):
    """
    Count unique visitors with smart filtering to avoid overcounting.
    
    Args:
        detections: List of detection dicts with 'track_id', 'timestamp', and 'bbox'
        fps: Frames per second (optional, for duration calculation)
        min_track_duration: Minimum track duration in seconds to count as a visitor (default: 1.0)
        min_detections: Minimum number of detections per track to count (default: 3)
        merge_close_tracks: Whether to merge tracks that are close in space and time (default: True)
    
    Returns:
        int: Count of unique visitors after filtering and deduplication
    """
    if not detections:
        return 0
    
    # Group detections by track_id
    tracks = {}
    for det in detections:
        track_id = det.get('track_id')
        if track_id is None:
            continue
        
        if track_id not in tracks:
            tracks[track_id] = {
                'detections': [],
                'timestamps': [],
                'positions': []
            }
        
        tracks[track_id]['detections'].append(det)
        if 'timestamp' in det:
            tracks[track_id]['timestamps'].append(det['timestamp'])
        
        # Calculate center position from bbox
        if 'bbox' in det and len(det['bbox']) >= 4:
            bbox = det['bbox']
            center_x = (bbox[0] + bbox[2]) / 2
            center_y = (bbox[1] + bbox[3]) / 2
            tracks[track_id]['positions'].append((center_x, center_y))
    
    # Filter tracks by minimum duration and detection count
    valid_tracks = {}
    for track_id, track_data in tracks.items():
        detections_count = len(track_data['detections'])
        
        # Calculate track duration
        if track_data['timestamps']:
            duration = max(track_data['timestamps']) - min(track_data['timestamps'])
        elif fps and detections_count > 1:
            # Estimate duration from frame numbers if timestamps not available
            frames = [det.get('frame', 0) for det in track_data['detections']]
            duration = (max(frames) - min(frames)) / fps if fps > 0 else 0
        else:
            duration = 0
        
        # Filter: must have minimum duration AND minimum detections
        if duration >= min_track_duration and detections_count >= min_detections:
            valid_tracks[track_id] = {
                'duration': duration,
                'detections': detections_count,
                'start_time': min(track_data['timestamps']) if track_data['timestamps'] else 0,
                'end_time': max(track_data['timestamps']) if track_data['timestamps'] else 0,
                'avg_position': (
                    np.mean([p[0] for p in track_data['positions']]) if track_data['positions'] else 0,
                    np.mean([p[1] for p in track_data['positions']]) if track_data['positions'] else 0
                )
            }
    
    if not merge_close_tracks:
        return len(valid_tracks)
    
    # Merge tracks that are close in space and time (likely same person re-entering)
    # This helps reduce overcounting when people leave and re-enter the frame
    merged_tracks = {}
    track_ids = list(valid_tracks.keys())
    
    for i, track_id in enumerate(track_ids):
        if track_id in merged_tracks:
            continue  # Already merged
        
        # Find tracks that might be the same person
        similar_tracks = [track_id]
        track_i = valid_tracks[track_id]
        
        for j, other_id in enumerate(track_ids[i+1:], start=i+1):
            if other_id in merged_tracks:
                continue
            
            track_j = valid_tracks[other_id]
            
            # Calculate time overlap and gap between tracks
            # Check if tracks overlap in time (same person detected simultaneously)
            time_overlap = min(track_i['end_time'], track_j['end_time']) - max(track_i['start_time'], track_j['start_time'])
            time_gap = min(
                abs(track_i['start_time'] - track_j['end_time']),
                abs(track_j['start_time'] - track_i['end_time'])
            )
            
            # Calculate spatial distance in pixels (not normalized)
            spatial_dist_pixels = np.sqrt(
                (track_i['avg_position'][0] - track_j['avg_position'][0])**2 +
                (track_i['avg_position'][1] - track_j['avg_position'][1])**2
            )
            
            # More aggressive merging criteria:
            # 1. If tracks overlap in time (> 0.5s) and are close in space (< 150px) - likely duplicate
            # 2. If tracks are close in time (< 2s gap) and space (< 200px) - same person re-entering
            should_merge = False
            if time_overlap > 0.5 and spatial_dist_pixels < 150:
                # Overlapping tracks - definitely same person
                should_merge = True
            elif time_gap < 2.0 and spatial_dist_pixels < 200:
                # Close in time and space - likely same person
                should_merge = True
            
            if should_merge:
                similar_tracks.append(other_id)
                merged_tracks[other_id] = track_id
        
        # Keep the longest track as the representative
        if len(similar_tracks) > 1:
            longest_track = max(similar_tracks, key=lambda tid: valid_tracks[tid]['duration'])
            for tid in similar_tracks:
                if tid != longest_track:
                    merged_tracks[tid] = longest_track
    
    # Count unique tracks after merging
    unique_visitors = set()
    for track_id in valid_tracks.keys():
        # Get the representative track (either itself or merged track)
        representative = merged_tracks.get(track_id, track_id)
        unique_visitors.add(representative)
    
    # Additional safety check: if we have too many tracks relative to video duration,
    # apply additional filtering by prioritizing longer, more substantial tracks
    if detections and len(detections) > 0:
        timestamps = [det.get('timestamp', 0) for det in detections if 'timestamp' in det]
        if timestamps:
            video_duration = max(timestamps) - min(timestamps)
            if video_duration > 0:
                # For very short videos (< 60s), if we have more than 1 track per 5 seconds, be more aggressive
                current_count = len(unique_visitors)
                if video_duration < 60 and current_count > video_duration / 5:
                    # Keep only the top tracks by duration and detection count
                    track_scores = {}
                    for track_id in unique_visitors:
                        if track_id in valid_tracks:
                            # Score = duration * detections (prioritize substantial tracks)
                            track_scores[track_id] = valid_tracks[track_id]['duration'] * valid_tracks[track_id]['detections']
                    
                    # Sort by score and keep top tracks
                    sorted_tracks = sorted(track_scores.items(), key=lambda x: x[1], reverse=True)
                    # Keep at most video_duration / 5 tracks (1 per 5 seconds), but at least 1
                    max_tracks = max(1, int(video_duration / 5))
                    top_track_ids = {tid for tid, _ in sorted_tracks[:max_tracks]}
                    unique_visitors = top_track_ids
    
    return len(unique_visitors)


def analyze_peak_hours(detections, fps, bin_minutes=5):
    """
    Analyze detections to find peak time frames.
    - detections: list of dicts, each with a 'timestamp' (in seconds)
    - fps: frames per second of the video
    - bin_minutes: size of each time bin in minutes
    Returns: list of (start_time, end_time, count) for the busiest bins
    """
    timestamps = [det['timestamp'] for det in detections if 'timestamp' in det]
    if not timestamps:
        return []
    bin_seconds = bin_minutes * 60
    max_time = max(timestamps)
    num_bins = int(np.ceil(max_time / bin_seconds))
    bins = [0] * (num_bins + 1)
    for t in timestamps:
        bin_idx = int(t // bin_seconds)
        bins[bin_idx] += 1
    peak_count = max(bins)
    peak_bins = [i for i, count in enumerate(bins) if count == peak_count]
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


def analyze_heatmap(heatmap, floorplan_shape, detections=None, fps=None):
    """
    Analyze heatmap data to identify traffic patterns and generate insights.
    """
    heatmap_norm = cv2.normalize(heatmap, None, 0, 100, cv2.NORM_MINMAX)
    HIGH_THRESHOLD = 70
    MEDIUM_THRESHOLD = 40
    LOW_THRESHOLD = 20
    total_area = floorplan_shape[0] * floorplan_shape[1]
    areas = {
        'high': {'pixels': 0, 'regions': []},
        'medium': {'pixels': 0, 'regions': []},
        'low': {'pixels': 0, 'regions': []}
    }
    height, width = heatmap_norm.shape
    region_size = 50
    for y in range(0, height, region_size):
        for x in range(0, width, region_size):
            region = heatmap_norm[y:min(y+region_size, height), x:min(x+region_size, width)]
            avg_density = np.mean(region)
            if avg_density >= HIGH_THRESHOLD:
                areas['high']['pixels'] += region.size
                areas['high']['regions'].append({'x': x, 'y': y, 'density': round(avg_density, 1)})
            elif avg_density >= MEDIUM_THRESHOLD:
                areas['medium']['pixels'] += region.size
                areas['medium']['regions'].append({'x': x, 'y': y, 'density': round(avg_density, 1)})
            elif avg_density >= LOW_THRESHOLD:
                areas['low']['pixels'] += region.size
                areas['low']['regions'].append({'x': x, 'y': y, 'density': round(avg_density, 1)})
    for category in areas:
        areas[category]['percentage'] = round((areas[category]['pixels'] / total_area) * 100, 1)

    if detections and fps:
        peak_hours = analyze_peak_hours(detections, fps)
    else:
        peak_hours = []

    if detections:
        # Use smart visitor counting to avoid overcounting from track fragmentation
        # For short videos (< 1 min), use much stricter filters to reduce false positives
        video_duration = max([det.get('timestamp', 0) for det in detections]) if detections else 0
        if video_duration < 60:  # Short video (< 1 minute)
            # Much stricter filters for short videos to reduce overcounting
            # For 30-second videos, we need to be very aggressive
            total_visitors = count_unique_visitors(
                detections, 
                fps=fps,
                min_track_duration=2.0,  # Require 2 seconds minimum (was 1.5)
                min_detections=8,        # Require at least 8 detections (was 5)
                merge_close_tracks=True
            )
        else:
            # Standard filters for longer videos
            total_visitors = count_unique_visitors(
                detections,
                fps=fps,
                min_track_duration=1.5,  # Require 1.5 seconds minimum (was 1.0)
                min_detections=5,       # Require at least 5 detections (was 3)
                merge_close_tracks=True
            )
    else:
        total_visitors = 0

    # Generate recommendations using AI if available and enabled, otherwise use rule-based
    use_ai = os.getenv('USE_AI_RECOMMENDATIONS', 'false').lower() == 'true'
    ai_provider = os.getenv('AI_PROVIDER', None)  # 'groq', 'gemini', 'openai', or None for auto-detect
    recommendations = []
    
    if AI_AVAILABLE and use_ai:
        try:
            recommendations, used_ai = generate_ai_recommendations(areas, total_visitors, peak_hours, provider=ai_provider)
        except Exception as e:
            recommendations = []
            used_ai = False
            import logging
            logging.getLogger(__name__).error(f"AI generation failed: {e}")
        if used_ai:
            recommendations_source = 'ai'
            recommendations_provider = (ai_provider or 'auto')
        else:
            # Will fall back below to rule-based if empty
            recommendations_source = 'rule'
            recommendations_provider = None
    else:
        # Fallback to rule-based recommendations
        if areas['high']['percentage'] > 30:
            recommendations.append("Consider redistributing traffic from high-density areas to improve customer flow")
        if areas['low']['percentage'] > 40:
            recommendations.append("Implement strategies to increase traffic in low-density areas")
        if areas['medium']['percentage'] < 30:
            recommendations.append("Optimize store layout to create more balanced traffic distribution")
        if not recommendations:
            recommendations.append("Monitor traffic patterns over time to identify optimization opportunities")
        recommendations_source = 'rule'
        recommendations_provider = None

    return {
        'areas': areas,
        'recommendations': recommendations,
        'recommendations_source': recommendations_source,
        'recommendations_provider': recommendations_provider,
        'peak_hours': peak_hours,
        'total_visitors': total_visitors
    }
