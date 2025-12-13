from ..core.config import logger
from ..core.storage import download_json_from_supabase, list_files_in_supabase


def load_detections(job_id: str):
    """Loads detections data for a given job_id from Supabase Storage."""
    logger.info(f"Attempting to load detections for job_id: '{job_id}'")
    
    try:
        # The standard path for the detections file
        detections_path = f"{job_id}/detections.json"
        logger.info(f"Attempting to download from standard path: '{detections_path}'")
        
        det_data = download_json_from_supabase(detections_path)
        
        if det_data is None:
            logger.error(f"Detections file not found for job ID: {job_id} at path {detections_path}")
            return None, None
            
        logger.info(f"Successfully loaded detections data for job {job_id}")
        detections = det_data.get("detections", [])
        fps = det_data.get("fps")
        
        if not isinstance(detections, list) or not detections:
            logger.error(f"Invalid or empty detections data for job ID: {job_id}")
            return None, None
            
        logger.info(f"Returning {len(detections)} detections and fps={fps} for job_id='{job_id}'")
        return detections, fps
    except Exception as e:
        logger.error(f"An unexpected error occurred while loading detections for job ID {job_id}: {e}")
        import traceback
        logger.error(f"Traceback:\n{traceback.format_exc()}")
        return None, None
