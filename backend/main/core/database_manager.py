"""
DatabaseManager class for handling all database operations.
Provides a centralized, object-oriented interface for database interactions.
"""

import os
import psycopg2
from typing import Optional, List, Dict, Any, Tuple
from contextlib import contextmanager
from dotenv import load_dotenv

# Load environment variables
main_dir = os.path.dirname(os.path.dirname(__file__))
env_path = os.path.join(main_dir, '.env')
load_dotenv(env_path)


class DatabaseManager:
    """Manages database connections and operations."""
    
    def __init__(self):
        self._db_config = {
            'dbname': os.getenv("SUPABASE_DB_NAME"),
            'user': os.getenv("SUPABASE_DB_USER"),
            'password': os.getenv("SUPABASE_DB_PASSWORD"),
            'host': os.getenv("SUPABASE_DB_HOST"),
            'port': os.getenv("SUPABASE_DB_PORT", 5432),
        }
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections."""
        conn = None
        try:
            conn = psycopg2.connect(**self._db_config)
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                conn.close()
    
    def execute_query(self, query: str, params: Optional[Tuple] = None, fetch_one: bool = False, fetch_all: bool = False) -> Optional[Any]:
        """Execute a database query with optional parameters."""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                
                if fetch_one:
                    return cur.fetchone()
                elif fetch_all:
                    return cur.fetchall()
                else:
                    conn.commit()
                    return cur.rowcount
    
    def insert_job(self, job_data: Dict[str, Any]) -> None:
        """Insert a new job record into the database."""
        query = '''
            INSERT INTO jobs (job_id, "user", input_video_name, input_floorplan_name, 
                            status, message, start_datetime, end_datetime, 
                            created_at, updated_at, output_heatmap_path, output_video_path)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''
        params = (
            job_data['job_id'], job_data['user'], job_data['input_video_name'],
            job_data['input_floorplan_name'], job_data['status'], job_data['message'],
            job_data['start_datetime'], job_data['end_datetime'], 
            job_data['created_at'], job_data['updated_at'],
            job_data.get('output_heatmap_path', ''), job_data.get('output_video_path', '')
        )
        self.execute_query(query, params)
    
    def update_job_status(self, job_id: str, status: str, message: str, 
                         output_heatmap_path: str = None, output_video_path: str = None) -> None:
        """Update job status and message."""
        if output_heatmap_path and output_video_path:
            query = '''
                UPDATE jobs 
                SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP,
                    output_heatmap_path = %s, output_video_path = %s
                WHERE job_id = %s
            '''
            params = (status, message, output_heatmap_path, output_video_path, job_id)
        else:
            query = '''
                UPDATE jobs 
                SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP
                WHERE job_id = %s
            '''
            params = (status, message, job_id)
        
        self.execute_query(query, params)
    
    def get_job_by_id(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get a job by its ID."""
        query = "SELECT * FROM jobs WHERE job_id = %s"
        result = self.execute_query(query, (job_id,), fetch_one=True)
        
        if result:
            return {
                'job_id': result[0],
                'user': result[1],
                'input_video_name': result[2],
                'input_floorplan_name': result[3],
                'start_datetime': result[4],
                'end_datetime': result[5],
                'status': result[6],
                'message': result[7],
                'created_at': result[8],
                'updated_at': result[9],
                'output_heatmap_path': result[10],
                'output_video_path': result[11]
            }
        return None
    
    def get_jobs_by_user(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all jobs for a specific user."""
        query = '''
            SELECT job_id, input_video_name, input_floorplan_name, status, message,
                   start_datetime, end_datetime, created_at, updated_at
            FROM jobs WHERE "user" = %s ORDER BY created_at DESC
        '''
        results = self.execute_query(query, (user_id,), fetch_all=True)
        
        return [
            {
                "job_id": row[0],
                "input_video_name": row[1],
                "input_floorplan_name": row[2],
                "status": row[3],
                "message": row[4],
                "start_datetime": row[5],
                "end_datetime": row[6],
                "created_at": row[7],
                "updated_at": row[8],
            }
            for row in results
        ]
    
    def delete_job(self, job_id: str, user_id: str) -> bool:
        """Delete a job if it belongs to the user."""
        query = "DELETE FROM jobs WHERE job_id = %s AND \"user\" = %s"
        rows_affected = self.execute_query(query, (job_id, user_id))
        return rows_affected > 0
    
    def get_orphaned_jobs(self) -> List[str]:
        """Get job IDs that are pending or processing but not in memory."""
        query = "SELECT job_id FROM jobs WHERE status IN ('pending', 'processing')"
        results = self.execute_query(query, fetch_all=True)
        return [row[0] for row in results]
    
    def mark_job_as_error(self, job_id: str, error_message: str) -> None:
        """Mark a job as error with a specific message."""
        self.update_job_status(job_id, 'error', error_message)


# Singleton instance for global access
db_manager = DatabaseManager()
