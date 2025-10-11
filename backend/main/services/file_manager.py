"""
FileManager class for handling file operations.
Centralizes file validation, processing, and management.
"""

import os
import cv2
import json
import shutil
from typing import Set, Optional, Tuple, Any
from ..core.config import UPLOAD_FOLDER, RESULTS_FOLDER, ALLOWED_EXTENSIONS_VIDEO, ALLOWED_EXTENSIONS_IMAGE


class FileManager:
    """Manages file operations and validation."""
    
    def __init__(self):
        self.allowed_video_extensions = ALLOWED_EXTENSIONS_VIDEO
        self.allowed_image_extensions = ALLOWED_EXTENSIONS_IMAGE
        self.upload_folder = UPLOAD_FOLDER
        self.results_folder = RESULTS_FOLDER
    
    def allowed_file(self, filename: str, allowed_extensions: Set[str]) -> bool:
        """Check if file extension is allowed."""
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions
    
    def is_video_file(self, filename: str) -> bool:
        """Check if file is a valid video file."""
        return self.allowed_file(filename, self.allowed_video_extensions)
    
    def is_image_file(self, filename: str) -> bool:
        """Check if file is a valid image file."""
        return self.allowed_file(filename, self.allowed_image_extensions)
    
    def get_video_duration(self, video_path: str) -> int:
        """Get video duration in seconds."""
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video file: {video_path}")
        
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        duration = int(frame_count / fps) if fps > 0 else 0
        
        cap.release()
        return duration
    
    def validate_video_file(self, video_path: str) -> cv2.VideoCapture:
        """Validate and open video file."""
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Input video not found: {video_path}")
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Error reading video file from {video_path}")
        
        return cap
    
    def create_job_directories(self, job_id: str) -> Tuple[str, str]:
        """Create upload and results directories for a job."""
        job_upload_folder = os.path.join(self.upload_folder, job_id)
        job_results_folder = os.path.join(self.results_folder, job_id)
        
        os.makedirs(job_upload_folder, exist_ok=True)
        os.makedirs(job_results_folder, exist_ok=True)
        
        return job_upload_folder, job_results_folder
    
    def save_uploaded_file(self, file, job_upload_folder: str, filename: str) -> str:
        """Save uploaded file to job directory."""
        file_path = os.path.join(job_upload_folder, filename)
        file.save(file_path)
        return file_path
    
    def copy_file(self, src_path: str, dest_path: str) -> str:
        """Copy file from source to destination."""
        dest_dir = os.path.dirname(dest_path)
        os.makedirs(dest_dir, exist_ok=True)
        shutil.copy2(src_path, dest_path)
        return dest_path
    
    def extract_first_frame(self, video_path: str, output_path: str) -> bool:
        """Extract first frame from video and save as image."""
        cap = cv2.VideoCapture(video_path)
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            return False
        
        cv2.imwrite(output_path, frame)
        return True
    
    def save_points_data(self, points_data: list, job_upload_folder: str, job_id: str) -> str:
        """Save points data to JSON file."""
        points_filename = f"points_{job_id}.json"
        points_path = os.path.join(job_upload_folder, points_filename)
        
        with open(points_path, 'w') as f:
            json.dump(points_data, f)
        
        return points_path
    
    def load_points_data(self, job_id: str) -> Optional[list]:
        """Load points data from JSON file."""
        job_upload_folder = os.path.join(self.upload_folder, job_id)
        points_filename = f"points_{job_id}.json"
        points_path = os.path.join(job_upload_folder, points_filename)
        
        if not os.path.exists(points_path):
            return None
        
        try:
            with open(points_path, 'r') as f:
                return json.load(f)
        except Exception:
            return None
    
    def delete_job_files(self, job_id: str) -> None:
        """Delete all files associated with a job."""
        results_folder = os.path.join(self.results_folder, job_id)
        uploads_folder = os.path.join(self.upload_folder, job_id)
        
        for folder in [results_folder, uploads_folder]:
            if os.path.exists(folder):
                shutil.rmtree(folder)
    
    def get_job_file_paths(self, job_id: str, video_filename: str, floorplan_filename: str) -> Tuple[str, str, str]:
        """Get file paths for job inputs."""
        job_upload_folder = os.path.join(self.upload_folder, job_id)
        
        video_path = os.path.join(job_upload_folder, video_filename)
        floorplan_path = os.path.join(job_upload_folder, floorplan_filename)
        points_path = os.path.join(job_upload_folder, f"points_{job_id}.json")
        
        return video_path, floorplan_path, points_path
    
    def get_job_output_paths(self, job_id: str) -> Tuple[str, str]:
        """Get output file paths for job results."""
        job_results_folder = os.path.join(self.results_folder, job_id)
        
        heatmap_path = os.path.join(job_results_folder, f"video_{job_id}_heatmap.jpg")
        video_path = os.path.join(job_results_folder, f"video_{job_id}.mp4")
        
        return heatmap_path, video_path
    
    def file_exists(self, file_path: str) -> bool:
        """Check if file exists."""
        return os.path.exists(file_path)
    
    def get_file_size(self, file_path: str) -> int:
        """Get file size in bytes."""
        if self.file_exists(file_path):
            return os.path.getsize(file_path)
        return 0
    
    def validate_points_data(self, points_data: Any) -> Tuple[bool, str]:
        """Validate points data structure."""
        if not isinstance(points_data, list) or len(points_data) != 4:
            return False, "pointsData must be a list of 4 points"
        
        for i, point in enumerate(points_data):
            if not isinstance(point, dict) or 'x' not in point or 'y' not in point:
                return False, f"Point {i} must be an object with x and y coordinates"
        
        return True, "Valid points data"


# Singleton instance for global access
file_manager = FileManager()
