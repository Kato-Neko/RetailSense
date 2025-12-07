"""
Database Manager - OOP wrapper for database operations with connection pooling.
"""

import os
import psycopg2
from psycopg2 import pool
from urllib.parse import urlparse
from ..core.config import logger


class DatabaseManager:
    """Manages database connections with connection pooling."""
    
    def __init__(self):
        """Initialize the database manager with connection pool."""
        self._connection_pool = None
        self._init_pool()
    
    def _get_connection_params(self):
        """Get connection parameters from environment variables."""
        database_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
        
        if database_url:
            # Parse URL and add sslmode if not present
            if "sslmode=" not in database_url:
                sep = "&" if "?" in database_url else "?"
                database_url = f"{database_url}{sep}sslmode=require"
            return database_url
        else:
            # Return dict for discrete env vars
            return {
                "dbname": os.getenv("SUPABASE_DB_NAME"),
                "user": os.getenv("SUPABASE_DB_USER"),
                "password": os.getenv("SUPABASE_DB_PASSWORD"),
                "host": os.getenv("SUPABASE_DB_HOST"),
                "port": os.getenv("SUPABASE_DB_PORT", 5432),
                "sslmode": os.getenv("SUPABASE_DB_SSLMODE", "require"),
            }
    
    def _init_pool(self):
        """Initialize the connection pool."""
        try:
            conn_params = self._get_connection_params()
            minconn = int(os.getenv("DB_POOL_MIN", 1))
            maxconn = int(os.getenv("DB_POOL_MAX", 10))
            
            if isinstance(conn_params, str):
                # URL-based connection
                self._connection_pool = pool.ThreadedConnectionPool(
                    minconn=minconn,
                    maxconn=maxconn,
                    dsn=conn_params
                )
            else:
                # Dict-based connection
                self._connection_pool = pool.ThreadedConnectionPool(
                    minconn=minconn,
                    maxconn=maxconn,
                    **conn_params
                )
            
            logger.info(f"Database connection pool initialized: min={minconn}, max={maxconn}")
        except Exception as e:
            logger.error(f"Failed to initialize connection pool: {e}")
            self._connection_pool = None
    
    def get_connection(self):
        """Get a PostgreSQL connection from the pool.

        Supports either a single DATABASE_URL or discrete SUPABASE_DB_* vars.
        Defaults sslmode to "require" for Supabase compatibility.
        Falls back to direct connection if pool is unavailable.
        """
        if self._connection_pool:
            try:
                return self._connection_pool.getconn()
            except Exception as e:
                logger.warning(f"Failed to get connection from pool: {e}, falling back to direct connection")
                # Fallback to direct connection
                return self._get_direct_connection()
        else:
            # Fallback to direct connection if pool not initialized
            return self._get_direct_connection()
    
    def _get_direct_connection(self):
        """Get a direct connection (fallback when pool is unavailable)."""
        database_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
        if database_url:
            if "sslmode=" not in database_url:
                sep = "&" if "?" in database_url else "?"
                database_url = f"{database_url}{sep}sslmode=require"
            return psycopg2.connect(database_url)
        else:
            return psycopg2.connect(
                dbname=os.getenv("SUPABASE_DB_NAME"),
                user=os.getenv("SUPABASE_DB_USER"),
                password=os.getenv("SUPABASE_DB_PASSWORD"),
                host=os.getenv("SUPABASE_DB_HOST"),
                port=os.getenv("SUPABASE_DB_PORT", 5432),
                sslmode=os.getenv("SUPABASE_DB_SSLMODE", "require"),
            )
    
    def return_connection(self, conn):
        """Return a connection to the pool."""
        if self._connection_pool and conn:
            try:
                self._connection_pool.putconn(conn)
            except Exception as e:
                logger.warning(f"Failed to return connection to pool: {e}")
                try:
                    conn.close()
                except:
                    pass
    
    def close_all(self):
        """Close all connections in the pool."""
        if self._connection_pool:
            try:
                self._connection_pool.closeall()
                logger.info("All database connections closed")
            except Exception as e:
                logger.error(f"Error closing connection pool: {e}")


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

