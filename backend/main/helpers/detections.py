from ..core.config import logger
from ..core.storage import download_json_from_supabase


class DetectionsLoaderService:
    """Loads detections and fps metadata from Supabase storage with fallbacks."""

    def load_detections(self, job_id: str):
        supabase_path = f"{job_id}/detections.json"
        det_data = download_json_from_supabase(supabase_path)

        if det_data is None:
            alternate_paths = [
                f"projectresults/{job_id}/detections.json",
                f"{job_id}_detections.json",
            ]
            for alt_path in alternate_paths:
                det_data = download_json_from_supabase(alt_path)
                if det_data is not None:
                    logger.info(f"Found detections at alternate path: {alt_path}")
                    break

            if det_data is None:
                logger.error(f"Detections file not found for job ID: {job_id} in any location")
                return None, None

        try:
            detections = det_data.get("detections", [])
            fps = det_data.get("fps")
            if not detections or not isinstance(detections, list):
                logger.error(f"Invalid detections data for job ID: {job_id}")
                return None, None
            return detections, fps
        except Exception as e:
            logger.error(f"Error processing detections for job ID {job_id}: {e}")
            return None, None


# Backward-compatible singleton and wrapper
_detections_loader_singleton = DetectionsLoaderService()


def load_detections(job_id: str):
    return _detections_loader_singleton.load_detections(job_id)
