"""
Memory monitoring utilities for video processing.
"""
import gc
import psutil
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def get_memory_usage() -> dict:
    """Get current memory usage statistics."""
    memory = psutil.virtual_memory()
    return {
        'total': memory.total,
        'available': memory.available,
        'percent': memory.percent,
        'used': memory.used,
        'free': memory.free
    }

def log_memory_usage(stage: str = ""):
    """Log current memory usage."""
    mem = get_memory_usage()
    logger.info(f"Memory usage {stage}: {mem['percent']:.1f}% ({mem['used'] / 1024**3:.2f}GB / {mem['total'] / 1024**3:.2f}GB)")

def force_garbage_collection():
    """Force garbage collection to free memory."""
    collected = gc.collect()
    logger.info(f"Garbage collection freed {collected} objects")
    return collected

def check_memory_limit(limit_percent: float = 80.0) -> bool:
    """Check if memory usage exceeds limit."""
    mem = get_memory_usage()
    if mem['percent'] > limit_percent:
        logger.warning(f"Memory usage {mem['percent']:.1f}% exceeds limit {limit_percent}%")
        return True
    return False

def cleanup_memory_if_needed(limit_percent: float = 80.0) -> bool:
    """Clean up memory if usage is too high."""
    if check_memory_limit(limit_percent):
        logger.info("Memory usage high, forcing garbage collection...")
        force_garbage_collection()
        log_memory_usage("after cleanup")
        return True
    return False

class MemoryMonitor:
    """Context manager for monitoring memory during operations."""
    
    def __init__(self, operation_name: str, limit_percent: float = 80.0):
        self.operation_name = operation_name
        self.limit_percent = limit_percent
        self.start_memory = None
        
    def __enter__(self):
        self.start_memory = get_memory_usage()
        log_memory_usage(f"before {self.operation_name}")
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        end_memory = get_memory_usage()
        memory_diff = end_memory['used'] - self.start_memory['used']
        log_memory_usage(f"after {self.operation_name}")
        logger.info(f"Memory change during {self.operation_name}: {memory_diff / 1024**2:.2f}MB")
        
        # Clean up if memory usage is high
        cleanup_memory_if_needed(self.limit_percent)
