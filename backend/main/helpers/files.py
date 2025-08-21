import os
import cv2

def allowed_file(filename: str, allowed_extensions: set) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions


def get_video_duration(video_path: str) -> int:
    cap = cv2.VideoCapture(video_path)
    duration = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS))
    cap.release()
    return duration


def validate_video_file(video_path):
    """Check if the video file exists and can be opened."""
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Input video not found: {video_path}")
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Error reading video file from {video_path}")
    return cap
