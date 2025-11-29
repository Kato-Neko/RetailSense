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
    
    # If we found files from listing, check if detections.json is among them
    detections_path = None
    if existing_files:
        # Look for detections.json in the listed files
        for file_path in existing_files:
            if 'detections.json' in file_path:
                detections_path = file_path
                logger.info(f"DEBUG: Found detections.json in listed files: '{detections_path}'")
                break
    
    # Build list of paths to try (prioritize found path if available)
    paths_to_try = []
    if detections_path:
        paths_to_try.append(detections_path)  # Try the exact path from listing first
    paths_to_try.append(f"{job_id}/detections.json")  # Standard path
    # Add alternate paths as fallback
    paths_to_try.extend([
        f"{job_id}_detections.json",
        f"detections_{job_id}.json",
    ])
    
    logger.info(f"DEBUG: Will try {len(paths_to_try)} paths for job_id='{job_id}'")
    det_data = None
    
    for idx, supabase_path in enumerate(paths_to_try):
        logger.info(f"DEBUG: Trying path {idx+1}/{len(paths_to_try)}: '{supabase_path}'")
        det_data = download_json_from_supabase(supabase_path)
        logger.info(f"DEBUG: Path '{supabase_path}' result: {type(det_data).__name__} (None={det_data is None})")
        if det_data is not None:
            logger.info(f"DEBUG: Found detections at path: {supabase_path}")
            break
    
    if det_data is None:
        logger.error(f"DEBUG: Detections file not found for job ID: {job_id} in any location (tried {len(paths_to_try)} paths)")
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
