from typing import Dict, Any

_jobs_store: Dict[str, Dict[str, Any]] = {}
_custom_heatmap_progress: Dict[str, float] = {}


def attach_jobs_store(store: Dict[str, Dict[str, Any]]):
    global _jobs_store
    _jobs_store = store


def get_jobs_store() -> Dict[str, Dict[str, Any]]:
    return _jobs_store


def set_custom_progress(job_id: str, progress: float) -> None:
    _custom_heatmap_progress[job_id] = progress


def get_custom_progress(job_id: str) -> float:
    return _custom_heatmap_progress.get(job_id, 0.0)
