from ..core.config import logger
from ..core.storage import download_json_from_supabase, list_files_in_supabase


def load_detections(job_id: str):
    logger.info(f"DEBUG: load_detections called with job_id='{job_id}'")
    
    # First, let's see what files actually exist for this job_id
    existing_files = []
    try:
        existing_files = list_files_in_supabase(prefix=job_id)
        logger.info(f"DEBUG: Files found in storage with prefix '{job_id}': {existing_files}")
        if not existing_files:
            logger.warning(f"DEBUG: No files found in storage with prefix '{job_id}'")
    except Exception as e:
        logger.warning(f"DEBUG: Could not list files for job_id '{job_id}': {e}")
    
    # First try the default path
    supabase_path = f"{job_id}/detections.json"
    logger.info(f"DEBUG: Attempting to load detections from primary path: '{supabase_path}'")
    det_data = download_json_from_supabase(supabase_path)
    logger.info(f"DEBUG: Primary path download result: {type(det_data).__name__} (None={det_data is None})")
    
    if det_data is None:
        logger.warning(f"DEBUG: Primary path failed, trying alternate paths for job_id='{job_id}'")
        # If not found, try alternate paths (in case of path changes)
        # NOTE: Do NOT include bucket name in paths - it's already added by storage manager
        alternate_paths = [
            f"{job_id}_detections.json",  # Removed projectresults/ prefix - causes double prefix bug
            f"detections_{job_id}.json",  # Another possible naming convention
        ]
        for idx, alt_path in enumerate(alternate_paths):
            logger.info(f"DEBUG: Trying alternate path {idx+1}/{len(alternate_paths)}: '{alt_path}'")
            det_data = download_json_from_supabase(alt_path)
            logger.info(f"DEBUG: Alternate path '{alt_path}' result: {type(det_data).__name__} (None={det_data is None})")
            if det_data is not None:
                logger.info(f"DEBUG: Found detections at alternate path: {alt_path}")
                break
        
        if det_data is None:
            logger.error(f"DEBUG: Detections file not found for job ID: {job_id} in any location (tried {len(alternate_paths) + 1} paths)")
            logger.error(f"DEBUG: Available files for job_id '{job_id}': {existing_files}")
            return None, None
    
    logger.info(f"DEBUG: Successfully loaded detections data, type: {type(det_data).__name__}")
    try:
        detections = det_data.get("detections", [])
        fps = det_data.get("fps")
        logger.info(f"DEBUG: Extracted detections: type={type(detections).__name__}, length={len(detections) if isinstance(detections, list) else 'N/A'}")
        logger.info(f"DEBUG: Extracted fps: {fps} (type: {type(fps).__name__})")
        if not detections or not isinstance(detections, list):
            logger.error(f"DEBUG: Invalid detections data for job ID: {job_id} - detections type: {type(detections).__name__}, is_list: {isinstance(detections, list)}, length: {len(detections) if hasattr(detections, '__len__') else 'N/A'}")
            return None, None
        logger.info(f"DEBUG: Returning {len(detections)} detections and fps={fps} for job_id='{job_id}'")
        return detections, fps
    except Exception as e:
        logger.error(f"DEBUG: Error processing detections for job ID {job_id}: {type(e).__name__}: {e}")
        import traceback
        logger.error(f"DEBUG: Traceback:\n{traceback.format_exc()}")
        return None, None
