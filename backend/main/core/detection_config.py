"""
Detection and Tracking Configuration
Easily adjustable parameters for YOLO and DeepSort models.
"""

import os
from typing import Dict, Any


class DetectionConfig:
    """Configuration for YOLO detection and DeepSort tracking."""
    
    def __init__(self):
        """Initialize detection configuration with defaults or environment variables."""
        
        # ===== YOLO Detection Parameters =====
        
        # Model configuration
        self.YOLO_MODEL = os.getenv('YOLO_MODEL', 'yolov8n.pt')  # yolov8n.pt, yolov8s.pt, yolov8m.pt, etc.
        
        # Detection thresholds
        self.YOLO_CONFIDENCE = float(os.getenv('YOLO_CONFIDENCE', '0.4'))  # Confidence threshold (0.0-1.0)
        self.YOLO_IOU = float(os.getenv('YOLO_IOU', '0.5'))  # IoU threshold for NMS (0.0-1.0)
        self.YOLO_POST_CONFIDENCE = float(os.getenv('YOLO_POST_CONFIDENCE', '0.3'))  # Post-processing confidence filter
        
        # Input size (larger = more accurate but slower)
        # Options: 320 (fastest), 416, 640 (balanced), 1280 (most accurate, slowest)
        self.YOLO_INPUT_SIZE = int(os.getenv('YOLO_INPUT_SIZE', '320'))
        
        # Detection limits
        self.YOLO_MAX_DETECTIONS = int(os.getenv('YOLO_MAX_DETECTIONS', '5'))  # Max detections per frame
        
        # Device settings
        self.YOLO_DEVICE = os.getenv('YOLO_DEVICE', 'cpu')  # 'cpu' or 'cuda'
        self.YOLO_HALF_PRECISION = os.getenv('YOLO_HALF_PRECISION', 'false').lower() == 'true'  # Use FP16
        
        # Classes to detect (0 = person in COCO dataset)
        self.YOLO_CLASSES = [0]  # Person class only
        
        # ===== DeepSort Tracking Parameters =====
        
        # Track persistence
        self.DEEPSORT_MAX_AGE = int(os.getenv('DEEPSORT_MAX_AGE', '30'))  # Frames to keep track without detection
        
        # Track confirmation
        self.DEEPSORT_N_INIT = int(os.getenv('DEEPSORT_N_INIT', '3'))  # Frames needed to confirm track
        
        # Matching thresholds
        self.DEEPSORT_MAX_IOU_DISTANCE = float(os.getenv('DEEPSORT_MAX_IOU_DISTANCE', '0.7'))  # Max IoU distance for matching
        self.DEEPSORT_MAX_COSINE_DISTANCE = float(os.getenv('DEEPSORT_MAX_COSINE_DISTANCE', '0.2'))  # Max cosine distance for appearance
        
        # Appearance descriptor budget
        self.DEEPSORT_NN_BUDGET = int(os.getenv('DEEPSORT_NN_BUDGET', '100'))  # Appearance descriptor budget
        
        # ===== Frame Processing Parameters =====
        
        # Frame skipping (process every Nth frame)
        self.FRAME_SKIP = int(os.getenv('FRAME_SKIP', '10'))  # Process every 10th frame
        
        # Frame resizing (for faster processing)
        self.MAX_FRAME_WIDTH = int(os.getenv('MAX_FRAME_WIDTH', '320'))  # Resize frames to this width
        
        # ===== Live Stream Specific Parameters =====
        
        # Live stream uses different (lower) confidence for real-time processing
        self.LIVE_STREAM_CONFIDENCE = float(os.getenv('LIVE_STREAM_CONFIDENCE', '0.25'))
        
        # ===== Preset Configurations =====
        
        # Preset modes for easy switching
        self.PRESET = os.getenv('DETECTION_PRESET', 'balanced').lower()  # 'speed', 'balanced', 'accuracy'
        
        # Apply preset if specified
        self._apply_preset()
    
    def _apply_preset(self):
        """Apply preset configuration based on PRESET value."""
        if self.PRESET == 'speed':
            # Optimized for speed (lower accuracy)
            self.YOLO_CONFIDENCE = 0.3
            self.YOLO_INPUT_SIZE = 320
            self.FRAME_SKIP = 15
            self.MAX_FRAME_WIDTH = 320
            self.DEEPSORT_MAX_AGE = 20
        elif self.PRESET == 'accuracy':
            # Optimized for accuracy (slower)
            self.YOLO_CONFIDENCE = 0.5
            self.YOLO_INPUT_SIZE = 640
            self.FRAME_SKIP = 5
            self.MAX_FRAME_WIDTH = 640
            self.DEEPSORT_MAX_AGE = 50
            self.DEEPSORT_N_INIT = 5
        # 'balanced' uses the default values set above
    
    def get_yolo_params(self) -> Dict[str, Any]:
        """Get YOLO inference parameters as a dictionary."""
        return {
            'classes': self.YOLO_CLASSES,
            'verbose': False,
            'imgsz': self.YOLO_INPUT_SIZE,
            'conf': self.YOLO_CONFIDENCE,
            'iou': self.YOLO_IOU,
            'max_det': self.YOLO_MAX_DETECTIONS,
            'device': self.YOLO_DEVICE,
            'half': self.YOLO_HALF_PRECISION
        }
    
    def get_deepsort_params(self) -> Dict[str, Any]:
        """Get DeepSort tracker parameters as a dictionary."""
        return {
            'max_age': self.DEEPSORT_MAX_AGE,
            'n_init': self.DEEPSORT_N_INIT,
            'max_iou_distance': self.DEEPSORT_MAX_IOU_DISTANCE,
            'max_cosine_distance': self.DEEPSORT_MAX_COSINE_DISTANCE,
            'nn_budget': self.DEEPSORT_NN_BUDGET
        }
    
    def __repr__(self):
        """String representation of configuration."""
        return f"""DetectionConfig(
    YOLO: model={self.YOLO_MODEL}, conf={self.YOLO_CONFIDENCE}, iou={self.YOLO_IOU}, size={self.YOLO_INPUT_SIZE}
    DeepSort: max_age={self.DEEPSORT_MAX_AGE}, n_init={self.DEEPSORT_N_INIT}
    Processing: frame_skip={self.FRAME_SKIP}, max_width={self.MAX_FRAME_WIDTH}
    Preset: {self.PRESET}
)"""


# Global instance
_detection_config = None


def get_detection_config() -> DetectionConfig:
    """Get the global detection configuration instance."""
    global _detection_config
    if _detection_config is None:
        _detection_config = DetectionConfig()
    return _detection_config

