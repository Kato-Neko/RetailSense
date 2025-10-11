"""
JobManager class for managing job state and operations.
Handles in-memory job tracking and custom heatmap progress.
"""

from typing import Dict, Any, Callable, Optional
from ..core.database_manager import db_manager


class JobManager:
    """Manages job state and operations."""
    
    def __init__(self):
        self._jobs_store: Dict[str, Dict[str, Any]] = {}
        self._custom_heatmap_progress: Dict[str, float] = {}
    
    def attach_jobs_store(self, store: Dict[str, Dict[str, Any]]) -> None:
        """Attach an external jobs store."""
        self._jobs_store = store
    
    def get_jobs_store(self) -> Dict[str, Dict[str, Any]]:
        """Get the current jobs store."""
        return self._jobs_store
    
    def add_job(self, job_id: str, job_data: Dict[str, Any]) -> None:
        """Add a new job to the store."""
        self._jobs_store[job_id] = job_data
    
    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get a job from the store."""
        return self._jobs_store.get(job_id)
    
    def update_job(self, job_id: str, updates: Dict[str, Any]) -> bool:
        """Update a job in the store."""
        if job_id in self._jobs_store:
            self._jobs_store[job_id].update(updates)
            return True
        return False
    
    def remove_job(self, job_id: str) -> bool:
        """Remove a job from the store."""
        if job_id in self._jobs_store:
            del self._jobs_store[job_id]
            return True
        return False
    
    def set_custom_progress(self, job_id: str, progress: float) -> None:
        """Set custom heatmap generation progress for a job."""
        self._custom_heatmap_progress[job_id] = progress
    
    def get_custom_progress(self, job_id: str) -> float:
        """Get custom heatmap generation progress for a job."""
        return self._custom_heatmap_progress.get(job_id, 0.0)
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a job by setting the cancelled flag."""
        if job_id in self._jobs_store:
            self._jobs_store[job_id]['cancelled'] = True
            # Update database status
            db_manager.update_job_status(job_id, 'cancelled', 'Job was cancelled by user.')
            return True
        return False
    
    def is_job_cancelled(self, job_id: str) -> bool:
        """Check if a job has been cancelled."""
        job = self.get_job(job_id)
        return job.get('cancelled', False) if job else False
    
    def update_job_progress(self, job_id: str, stage: str, progress: float) -> None:
        """Update job progress in both memory and database."""
        message = f'{stage} ({int(progress * 100)}%)'
        self.update_job(job_id, {'message': message})
        db_manager.update_job_status(job_id, self.get_job(job_id)['status'], message)
    
    def complete_job(self, job_id: str, output_heatmap_path: str, output_video_path: str) -> None:
        """Mark a job as completed."""
        self.update_job(job_id, {
            'status': 'completed',
            'message': 'Processing completed successfully'
        })
        db_manager.update_job_status(job_id, 'completed', 'Processing completed successfully',
                                   output_heatmap_path, output_video_path)
    
    def error_job(self, job_id: str, error_message: str) -> None:
        """Mark a job as error."""
        self.update_job(job_id, {
            'status': 'error',
            'message': error_message
        })
        db_manager.mark_job_as_error(job_id, error_message)
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, str]]:
        """Get job status from memory or database."""
        job = self.get_job(job_id)
        if job:
            return {
                'job_id': job_id,
                'status': job['status'],
                'message': job.get('message', '')
            }
        
        # Fallback to database
        db_job = db_manager.get_job_by_id(job_id)
        if db_job:
            return {
                'job_id': job_id,
                'status': db_job['status'],
                'message': db_job['message']
            }
        
        return None
    
    def cleanup_orphaned_jobs(self) -> None:
        """Clean up jobs that are marked as pending/processing but not in memory."""
        orphaned_job_ids = db_manager.get_orphaned_jobs()
        for job_id in orphaned_job_ids:
            if job_id not in self._jobs_store:
                db_manager.mark_job_as_error(job_id, 'Job was interrupted by server shutdown.')


# Singleton instance for global access
job_manager = JobManager()
