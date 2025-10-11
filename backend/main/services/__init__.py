from .job_manager import job_manager
from .auth_service import auth_service
from .file_manager import file_manager
from .video_jobs import process_video_job, run_custom_heatmap_job

# Legacy compatibility - these will be deprecated
from .state import attach_jobs_store, get_jobs_store, set_custom_progress, get_custom_progress

def attach_jobs_store_legacy(store):
    """Legacy function for backward compatibility."""
    job_manager.attach_jobs_store(store)

def get_jobs_store_legacy():
    """Legacy function for backward compatibility."""
    return job_manager.get_jobs_store()