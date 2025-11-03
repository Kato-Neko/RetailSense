import numpy as np
import cv2
import os

# Try to import AI analysis module (optional)
try:
    from .ai_analysis import generate_ai_recommendations
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False


class HeatmapAnalyticsService:
    """Performs heatmap and temporal analytics for detections and heatmaps."""

    def analyze_peak_hours(self, detections, fps, bin_minutes=5):
        """Find peak time bins from detections timestamps."""
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
        """Analyze heatmap to identify traffic patterns and insights."""
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
            peak_hours = self.analyze_peak_hours(detections, fps)
        else:
            peak_hours = []

        if detections:
            unique_ids = set(det['track_id'] for det in detections if 'track_id' in det)
            total_visitors = len(unique_ids)
        else:
            total_visitors = 0

        use_ai = os.getenv('USE_AI_RECOMMENDATIONS', 'false').lower() == 'true'
        ai_provider = os.getenv('AI_PROVIDER', None)
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
                recommendations_source = 'rule'
                recommendations_provider = None
        else:
            recommendations = [] if 'recommendations' not in locals() else recommendations
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


# Backward-compatible singleton and wrappers
_analytics_service_singleton = HeatmapAnalyticsService()


def analyze_peak_hours(detections, fps, bin_minutes=5):
    return _analytics_service_singleton.analyze_peak_hours(detections, fps, bin_minutes)


def analyze_heatmap(heatmap, floorplan_shape, detections=None, fps=None):
    return _analytics_service_singleton.analyze_heatmap(heatmap, floorplan_shape, detections, fps)
