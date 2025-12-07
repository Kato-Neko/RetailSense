"""
Database connection utilities with connection pooling support.
"""

from .database_manager import get_db_manager
from contextlib import contextmanager

# Initialize db manager
_db_manager = get_db_manager()

# Export for backward compatibility
def get_db_connection():
    """Get a database connection from the pool."""
    return _db_manager.get_connection()

def return_db_connection(conn):
    """Return a connection to the pool."""
    _db_manager.return_connection(conn)

@contextmanager
def get_db_connection_context():
    """Context manager for database connections (auto-returns to pool)."""
    conn = None
    try:
        conn = get_db_connection()
        yield conn
    finally:
        if conn:
            return_db_connection(conn)

