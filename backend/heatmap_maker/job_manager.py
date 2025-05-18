"""
job_manager.py
Handles job queueing, status, and database management for the backend.
"""

import os
import sqlite3
import datetime
import logging

logger = logging.getLogger(__name__)

DATABASE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../heatmap_jobs.db'))

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    logger.debug("Initializing database")
    conn = get_db_connection()
    cursor = conn.cursor()
    # Only create tables if they do not exist; do NOT drop tables
    # Create users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Create jobs table with nullable user field
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            job_id TEXT PRIMARY KEY,
            user TEXT NULL,
            input_video_name TEXT,
            input_floorplan_name TEXT,
            output_heatmap_path TEXT,
            output_video_path TEXT,
            status TEXT NOT NULL,
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user) REFERENCES users(username)
        )
    ''')
    conn.commit()
    conn.close()
    logger.debug("Database initialization complete")

# Add more job/database utilities as needed 