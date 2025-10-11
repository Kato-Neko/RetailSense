"""
Main package for the backend application.
"""
try:
	from .services.state import attach_jobs_store, get_jobs_store, set_custom_progress, get_custom_progress
except Exception as _err:
	# Provide lightweight fallbacks so importing the package doesn't raise ModuleNotFoundError.
	# Any call into these stubs will raise a descriptive RuntimeError instead.
	def attach_jobs_store(*_a, **_k):
		raise RuntimeError(f"backend.main.services.state not available: {_err}")

	def get_jobs_store(*_a, **_k):
		raise RuntimeError(f"backend.main.services.state not available: {_err}")

	def set_custom_progress(*_a, **_k):
		raise RuntimeError(f"backend.main.services.state not available: {_err}")

	def get_custom_progress(*_a, **_k):
		raise RuntimeError(f"backend.main.services.state not available: {_err}")

# re-export other helpers if needed
# from .video_jobs import process_video_job, run_custom_heatmap_job, update_job_status_in_db, update_job_progress