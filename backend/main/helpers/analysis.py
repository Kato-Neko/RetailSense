import numpy as np
import cv2
import os

# Try to import AI analysis module (optional)
try:
    from .ai_analysis import generate_ai_recommendations
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False


class HeatmapAnalyzer:
    """Analyzes heatmap data to identify traffic patterns and generate insights."""
    
    def __init__(self):
        """Initialize the heatmap analyzer."""
        self.high_threshold = 70
        self.medium_threshold = 40
        self.low_threshold = 20
    
    def analyze_peak_hours(self, detections, fps, bin_minutes=5):
        """
        Analyze detections to find peak time frames.
        
        Args:
            detections: list of dicts, each with a 'timestamp' (in seconds)
            fps: frames per second of the video
            bin_minutes: size of each time bin in minutes
            
        Returns:
            list of (start_time, end_time, count) for the busiest bins
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
    
    def analyze_heatmap(self, heatmap, floorplan_shape, detections=None, fps=None):
        """Analyze heatmap data to identify traffic patterns and generate insights.
        
        Args:
            heatmap: Heatmap image as numpy array
            floorplan_shape: Tuple of (height, width) for the floorplan
            detections: Optional list of detection dictionaries
            fps: Optional frames per second
            
        Returns:
            Dictionary containing analysis results
        """
        heatmap_norm = cv2.normalize(heatmap, None, 0, 100, cv2.NORM_MINMAX)
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
                if avg_density >= self.high_threshold:
                    areas['high']['pixels'] += region.size
                    areas['high']['regions'].append({'x': x, 'y': y, 'density': round(avg_density, 1)})
                elif avg_density >= self.medium_threshold:
                    areas['medium']['pixels'] += region.size
                    areas['medium']['regions'].append({'x': x, 'y': y, 'density': round(avg_density, 1)})
                elif avg_density >= self.low_threshold:
                    areas['low']['pixels'] += region.size
                    areas['low']['regions'].append({'x': x, 'y': y, 'density': round(avg_density, 1)})
        for category in areas:
            areas[category]['percentage'] = round((areas[category]['pixels'] / total_area) * 100, 1)

        if detections and fps:
            peak_hours = self.analyze_peak_hours(detections, fps)
        else:
            peak_hours = []

        if detections:
            unique_ids = set(det['track_id'] for det in detections if 'track_id' in det)
            total_visitors = len(unique_ids)
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


# Global instance
_heatmap_analyzer = None


def get_heatmap_analyzer() -> HeatmapAnalyzer:
    """Get the global heatmap analyzer instance."""
    global _heatmap_analyzer
    if _heatmap_analyzer is None:
        _heatmap_analyzer = HeatmapAnalyzer()
    return _heatmap_analyzer


# Legacy functions for backward compatibility
def analyze_peak_hours(detections, fps, bin_minutes=5):
    """Legacy function for backward compatibility."""
    return get_heatmap_analyzer().analyze_peak_hours(detections, fps, bin_minutes)


def analyze_heatmap(heatmap, floorplan_shape, detections=None, fps=None):
    """Legacy function for backward compatibility."""
    return get_heatmap_analyzer().analyze_heatmap(heatmap, floorplan_shape, detections, fps)
