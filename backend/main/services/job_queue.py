"""
Job Queue System - Manages video processing jobs with concurrency limits.
"""

import threading
import queue
import logging
from typing import Callable, Any, Optional
from ..core.config import logger

class JobQueue:
    """Thread-safe job queue with concurrency control."""
    
    def __init__(self, max_concurrent: int = 1):
        """
        Initialize the job queue.
        
        Args:
            max_concurrent: Maximum number of jobs to process simultaneously
        """
        self.queue = queue.Queue()
        self.semaphore = threading.Semaphore(max_concurrent)
        self.worker_thread = None
        self.running = False
        self.active_jobs = {}  # Track active jobs
        self.active_jobs_lock = threading.Lock()
        self.max_concurrent = max_concurrent
        
        logger.info(f"JobQueue initialized with max_concurrent={max_concurrent}")
    
    def start(self):
        """Start the worker thread."""
        if not self.running:
            self.running = True
            self.worker_thread = threading.Thread(target=self._worker, daemon=True, name="JobQueueWorker")
            self.worker_thread.start()
            logger.info("JobQueue worker thread started")
    
    def stop(self):
        """Stop the worker thread (waits for current jobs to finish)."""
        self.running = False
        if self.worker_thread:
            self.worker_thread.join(timeout=10)
            logger.info("JobQueue worker thread stopped")
    
    def add_job(self, job_id: str, job_func: Callable, *args, **kwargs):
        """
        Add a job to the queue.
        
        Args:
            job_id: Unique identifier for the job
            job_func: Function to execute
            *args: Positional arguments for job_func
            **kwargs: Keyword arguments for job_func
        """
        self.queue.put((job_id, job_func, args, kwargs))
        logger.info(f"Job {job_id} added to queue (queue size: {self.queue.qsize()})")
    
    def _worker(self):
        """Worker thread that processes jobs from the queue."""
        while self.running:
            try:
                # Get job with timeout to allow checking self.running
                try:
                    job_id, job_func, args, kwargs = self.queue.get(timeout=1)
                except queue.Empty:
                    continue
                
                # Acquire semaphore (blocks if max_concurrent jobs are running)
                self.semaphore.acquire()
                
                # Track active job
                with self.active_jobs_lock:
                    self.active_jobs[job_id] = True
                
                # Process job in a separate thread to avoid blocking
                def process_job():
                    try:
                        logger.info(f"Processing job {job_id} (active jobs: {len(self.active_jobs)})")
                        job_func(*args, **kwargs)
                        logger.info(f"Job {job_id} completed successfully")
                    except Exception as e:
                        logger.error(f"Job {job_id} failed: {e}", exc_info=True)
                    finally:
                        # Remove from active jobs
                        with self.active_jobs_lock:
                            self.active_jobs.pop(job_id, None)
                        
                        # Release semaphore
                        self.semaphore.release()
                        
                        # Mark task as done
                        self.queue.task_done()
                
                # Start processing in background
                thread = threading.Thread(target=process_job, daemon=True, name=f"JobProcessor-{job_id}")
                thread.start()
                
            except Exception as e:
                logger.error(f"Error in job queue worker: {e}", exc_info=True)
    
    def get_queue_size(self) -> int:
        """Get the number of jobs waiting in the queue."""
        return self.queue.qsize()
    
    def get_active_jobs_count(self) -> int:
        """Get the number of currently active jobs."""
        with self.active_jobs_lock:
            return len(self.active_jobs)
    
    def get_status(self) -> dict:
        """Get queue status information."""
        return {
            "queue_size": self.get_queue_size(),
            "active_jobs": self.get_active_jobs_count(),
            "max_concurrent": self.max_concurrent,
            "running": self.running
        }


# Global job queue instance
_job_queue: Optional[JobQueue] = None

def get_job_queue() -> JobQueue:
    """Get the global job queue instance."""
    global _job_queue
    if _job_queue is None:
        import os
        max_concurrent = int(os.getenv("MAX_CONCURRENT_JOBS", 1))
        _job_queue = JobQueue(max_concurrent=max_concurrent)
        _job_queue.start()
    return _job_queue

