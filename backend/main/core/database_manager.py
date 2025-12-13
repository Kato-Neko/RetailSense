"""
Database Manager - OOP wrapper for database operations with connection pooling.
"""

import os
import psycopg2
from psycopg2 import pool
from urllib.parse import urlparse
from ..core.config import logger
import weakref


class DatabaseManager:
    """Manages database connections with connection pooling."""
    
    def __init__(self):
        """Initialize the database manager with connection pool."""
        self._connection_pool = None
        # Track flags per connection without mutating psycopg2 connection objects
        self._conn_flags = weakref.WeakKeyDictionary()
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
            # Optimize pool size for Railway Pro plan (32 vCPU)
            # Use smaller pool to reduce memory usage while maintaining efficiency
            minconn = int(os.getenv("DB_POOL_MIN", 2))
            maxconn = int(os.getenv("DB_POOL_MAX", 5))  # Reduced from 10 to save memory
            
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

    def _set_from_pool_flag(self, conn, from_pool: bool):
        """Record pooled flag using a side table to avoid mutating connection."""
        try:
            self._conn_flags[conn] = {"from_pool": from_pool, "returned": False}
        except Exception:
            logger.warning("Could not tag connection with from_pool flag; treating as direct")

    def _get_from_pool_flag(self, conn) -> bool:
        """Retrieve pooled flag set by _set_from_pool_flag."""
        try:
            return bool(self._conn_flags.get(conn, {}).get("from_pool", False))
        except Exception:
            return False

    def _mark_returned(self, conn):
        try:
            flags = self._conn_flags.get(conn)
            if flags is not None:
                flags["returned"] = True
        except Exception:
            pass

    def _wrap_close(self, conn):
        """Wrap conn.close so accidental close() returns to pool instead of leaking."""
        try:
            original_close = conn.close
        except Exception:
            return

        def close_wrapper():
            try:
                from_pool = self._get_from_pool_flag(conn)
                already_returned = self._conn_flags.get(conn, {}).get("returned", False)
                if from_pool and self._connection_pool and not already_returned:
                    self._mark_returned(conn)
                    try:
                        self._connection_pool.putconn(conn)
                        return
                    except Exception as e:
                        logger.warning(f"Failed to return connection to pool via close(): {e}")
                # Fall back to original close
                original_close()
            except Exception:
                try:
                    original_close()
                except Exception:
                    pass

        try:
            conn.close = close_wrapper  # type: ignore[assignment]
        except Exception:
            # If we cannot wrap, just proceed; worst case the caller must return manually.
            pass
    
    def get_connection(self):
        """Get a PostgreSQL connection from the pool.

        Supports either a single DATABASE_URL or discrete SUPABASE_DB_* vars.
        Defaults sslmode to "require" for Supabase compatibility.
        Falls back to direct connection if pool is unavailable.
        """
        if self._connection_pool:
            try:
                conn = self._connection_pool.getconn()
                # Mark connection as from pool for proper cleanup
                self._set_from_pool_flag(conn, True)
                self._wrap_close(conn)
                return conn
            except Exception as e:
                logger.warning(f"Failed to get connection from pool: {e}, falling back to direct connection")
                # Fallback to direct connection
                conn = self._get_direct_connection()
                self._set_from_pool_flag(conn, False)
                self._wrap_close(conn)
                return conn
        else:
            # Fallback to direct connection if pool not initialized
            conn = self._get_direct_connection()
            self._set_from_pool_flag(conn, False)
            self._wrap_close(conn)
            return conn
    
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
        if not conn:
            return
        
        try:
            # Check if connection came from pool
            from_pool = self._get_from_pool_flag(conn)
            
            if from_pool and self._connection_pool:
                # Connection from pool - return it
                if conn.closed:
                    logger.warning("Connection already closed, not returning to pool")
                    return
                try:
                    self._mark_returned(conn)
                    self._connection_pool.putconn(conn)
                except Exception as e:
                    logger.warning(f"Failed to return connection to pool: {e}")
                    # If return fails, close the connection
                    try:
                        if not conn.closed:
                            conn.close()
                    except:
                        pass
            else:
                # Direct connection (fallback) - just close it
                try:
                    if not conn.closed:
                        conn.close()
                except:
                    pass
        except Exception as e:
            logger.warning(f"Error in return_connection: {e}")
            # Last resort - try to close
            try:
                if conn and not conn.closed:
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

