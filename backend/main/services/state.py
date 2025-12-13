from typing import Dict, Any


class StateManager:
    """Manages application state including job stores and progress tracking."""
    
    def __init__(self):
        """Initialize the state manager."""
        self._jobs_store: Dict[str, Dict[str, Any]] = {}
        self._custom_heatmap_progress: Dict[str, float] = {}
    
    def attach_jobs_store(self, store: Dict[str, Dict[str, Any]]):
        """Attach an external jobs store.
        
        Args:
            store: Dictionary to use as jobs store
        """
        self._jobs_store = store
    
    def get_jobs_store(self) -> Dict[str, Dict[str, Any]]:
        """Get the jobs store dictionary.
        
        Returns:
            Dictionary containing job data
        """
        return self._jobs_store
    
    def set_custom_progress(self, job_id: str, progress: float) -> None:
        """Set custom heatmap generation progress for a job.
        
        Args:
            job_id: The job ID
            progress: Progress value between 0.0 and 1.0
        """
        self._custom_heatmap_progress[job_id] = progress
    
    def get_custom_progress(self, job_id: str) -> float:
        """Get custom heatmap generation progress for a job.
        
        Args:
            job_id: The job ID
            
        Returns:
            Progress value between 0.0 and 1.0, or 0.0 if not found
        """
        return self._custom_heatmap_progress.get(job_id, 0.0)


# Global instance
_state_manager = None


def get_state_manager() -> StateManager:
    """Get the global state manager instance."""
    global _state_manager
    if _state_manager is None:
        _state_manager = StateManager()
    return _state_manager


# Legacy functions for backward compatibility
def attach_jobs_store(store: Dict[str, Dict[str, Any]]):
    """Legacy function for backward compatibility."""
    return get_state_manager().attach_jobs_store(store)


def get_jobs_store() -> Dict[str, Dict[str, Any]]:
    """Legacy function for backward compatibility."""
    return get_state_manager().get_jobs_store()


def set_custom_progress(job_id: str, progress: float) -> None:
    """Legacy function for backward compatibility."""
    return get_state_manager().set_custom_progress(job_id, progress)


def get_custom_progress(job_id: str) -> float:
    """Legacy function for backward compatibility."""
    return get_state_manager().get_custom_progress(job_id)
