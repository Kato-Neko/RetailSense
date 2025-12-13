import os
import cv2


class FileManager:
    """Manages file operations and validations."""
    
    @staticmethod
    def allowed_file(filename: str, allowed_extensions: set) -> bool:
        """Check if a file has an allowed extension.
        
        Args:
            filename: The filename to check
            allowed_extensions: Set of allowed file extensions
            
        Returns:
            True if extension is allowed, False otherwise
        """
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions
    
    @staticmethod
    def get_video_duration(video_path: str) -> int:
        """Get the duration of a video file in seconds.
        
        Args:
            video_path: Path to the video file
            
        Returns:
            Duration in seconds as integer
        """
        cap = cv2.VideoCapture(video_path)
        duration = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS))
        cap.release()
        return duration
    
    @staticmethod
    def validate_video_file(video_path):
        """Check if the video file exists and can be opened.
        
        Args:
            video_path: Path to the video file
            
        Returns:
            cv2.VideoCapture object if valid
            
        Raises:
            FileNotFoundError: If video file doesn't exist
            ValueError: If video file cannot be opened
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Input video not found: {video_path}")
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Error reading video file from {video_path}")
        return cap


# Global instance
_file_manager = None


def get_file_manager() -> FileManager:
    """Get the global file manager instance."""
    global _file_manager
    if _file_manager is None:
        _file_manager = FileManager()
    return _file_manager


# Legacy functions for backward compatibility
def allowed_file(filename: str, allowed_extensions: set) -> bool:
    """Legacy function for backward compatibility."""
    return FileManager.allowed_file(filename, allowed_extensions)


def get_video_duration(video_path: str) -> int:
    """Legacy function for backward compatibility."""
    return FileManager.get_video_duration(video_path)


def validate_video_file(video_path):
    """Legacy function for backward compatibility."""
    return FileManager.validate_video_file(video_path)
