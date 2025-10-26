"""
Database Manager - OOP wrapper for database operations.
"""

import os
import psycopg2
from urllib.parse import urlparse


class DatabaseManager:
    """Manages database connections."""
    
    def __init__(self):
        """Initialize the database manager."""
        pass
    
    def _connect_with_parts(self):
        """Connect using discrete SUPABASE_DB_* env vars.
        Ensures sslmode=require (needed by Supabase).
        """
        return psycopg2.connect(
            dbname=os.getenv("SUPABASE_DB_NAME"),
            user=os.getenv("SUPABASE_DB_USER"),
            password=os.getenv("SUPABASE_DB_PASSWORD"),
            host=os.getenv("SUPABASE_DB_HOST"),
            port=os.getenv("SUPABASE_DB_PORT", 5432),
            sslmode=os.getenv("SUPABASE_DB_SSLMODE", "require"),
        )
    
    def _connect_with_url(self, database_url: str):
        """Connect using a single DATABASE_URL.
        Adds sslmode=require if not present.
        """
        # If the URL doesn't specify sslmode, append it
        if "sslmode=" not in database_url:
            sep = "&" if "?" in database_url else "?"
            database_url = f"{database_url}{sep}sslmode=require"
        return psycopg2.connect(database_url)
    
    def get_connection(self):
        """Get a PostgreSQL connection.

        Supports either a single DATABASE_URL or discrete SUPABASE_DB_* vars.
        Defaults sslmode to "require" for Supabase compatibility.
        """
        database_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
        if database_url:
            return self._connect_with_url(database_url)
        return self._connect_with_parts()


# Global instance
_db_manager = None


def get_db_manager() -> DatabaseManager:
    """Get the global database manager instance."""
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
    return _db_manager


def get_db_connection():
    """Legacy function for backward compatibility."""
    return get_db_manager().get_connection()

