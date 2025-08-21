"""
Database connection utilities.
"""

import os
import psycopg2


def get_db_connection():
    return psycopg2.connect(
        dbname=os.getenv("SUPABASE_DB_NAME"),
        user=os.getenv("SUPABASE_DB_USER"),
        password=os.getenv("SUPABASE_DB_PASSWORD"),
        host=os.getenv("SUPABASE_DB_HOST"),
        port=os.getenv("SUPABASE_DB_PORT", 5432),
    )

