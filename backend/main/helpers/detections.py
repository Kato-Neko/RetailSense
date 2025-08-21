from core.config import logger
from core.storage import download_json_from_supabase


def load_detections(job_id: str):
    supabase_path = f"{job_id}/detections.json"
    det_data = download_json_from_supabase(supabase_path)
    if det_data is None:
        logger.error(f"Detections file not found for job ID: {job_id} in Supabase")
        return None, None
    detections = det_data.get("detections", [])
    fps = det_data.get("fps")
    return detections, fps
