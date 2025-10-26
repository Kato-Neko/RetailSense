"""
Database connection utilities.
"""

from .database_manager import get_db_manager

# Initialize db manager
_db_manager = get_db_manager()

# Export for backward compatibility
get_db_connection = _db_manager.get_connection

