from ..core.config import logger
from ..core.storage import download_json_from_supabase, list_files_in_supabase


class DetectionsLoader:
    """Manages loading detection data from storage."""
    
    def __init__(self, logger_instance=None):
        """Initialize the detections loader.
        
        Args:
            logger_instance: Optional logger instance (defaults to module logger)
        """
        self.logger = logger_instance or logger
    
    def load_detections(self, job_id: str):
        """Loads detections data for a given job_id from Supabase Storage.
        
        Args:
            job_id: The job ID to load detections for
            
        Returns:
            Tuple of (detections list, fps) or (None, None) if failed
        """
        self.logger.info(f"Attempting to load detections for job_id: '{job_id}'")
        
        try:
            # The standard path for the detections file
            detections_path = f"{job_id}/detections.json"
            self.logger.info(f"Attempting to download from standard path: '{detections_path}'")
            
            det_data = download_json_from_supabase(detections_path)
            
            if det_data is None:
                self.logger.error(f"Detections file not found for job ID: {job_id} at path {detections_path}")
                return None, None
                
            self.logger.info(f"Successfully loaded detections data for job {job_id}")
            detections = det_data.get("detections", [])
            fps = det_data.get("fps")
            
            if not isinstance(detections, list) or not detections:
                self.logger.error(f"Invalid or empty detections data for job ID: {job_id}")
                return None, None
                
            self.logger.info(f"Returning {len(detections)} detections and fps={fps} for job_id='{job_id}'")
            return detections, fps
        except Exception as e:
            self.logger.error(f"An unexpected error occurred while loading detections for job ID {job_id}: {e}")
            import traceback
            self.logger.error(f"Traceback:\n{traceback.format_exc()}")
            return None, None


# Global instance
_detections_loader = None


def get_detections_loader() -> DetectionsLoader:
    """Get the global detections loader instance."""
    global _detections_loader
    if _detections_loader is None:
        _detections_loader = DetectionsLoader()
    return _detections_loader


# Legacy function for backward compatibility
def load_detections(job_id: str):
    """Legacy function for backward compatibility."""
    return get_detections_loader().load_detections(job_id)
