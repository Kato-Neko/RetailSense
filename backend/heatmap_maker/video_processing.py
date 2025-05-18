"""
video_processing.py
Handles video file loading, validation, and saving utilities for the backend.
"""

import os
import cv2
import numpy as np

def validate_video_file(video_path):
    """Check if the video file exists and can be opened."""
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Input video not found: {video_path}")
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Error reading video file from {video_path}")
    return cap

# Add more video-related utilities as needed 