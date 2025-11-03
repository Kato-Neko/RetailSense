from typing import Dict, Any


class InMemoryJobsState:
    """In-memory state holder for jobs and custom heatmap progress."""

    def __init__(self) -> None:
        self._jobs_store: Dict[str, Dict[str, Any]] = {}
        self._custom_heatmap_progress: Dict[str, float] = {}

    def attach_jobs_store(self, store: Dict[str, Dict[str, Any]]):
        self._jobs_store = store

    def get_jobs_store(self) -> Dict[str, Dict[str, Any]]:
        return self._jobs_store

    def set_custom_progress(self, job_id: str, progress: float) -> None:
        self._custom_heatmap_progress[job_id] = progress

    def get_custom_progress(self, job_id: str) -> float:
        return self._custom_heatmap_progress.get(job_id, 0.0)


# Singleton instance and backward-compatible function wrappers
_state_singleton = InMemoryJobsState()


def attach_jobs_store(store: Dict[str, Dict[str, Any]]):
    return _state_singleton.attach_jobs_store(store)


def get_jobs_store() -> Dict[str, Dict[str, Any]]:
    return _state_singleton.get_jobs_store()


def set_custom_progress(job_id: str, progress: float) -> None:
    return _state_singleton.set_custom_progress(job_id, progress)


def get_custom_progress(job_id: str) -> float:
    return _state_singleton.get_custom_progress(job_id)
