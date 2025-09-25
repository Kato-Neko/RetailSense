"""
app.py
Flask entry point for the backend, using refactored modules.
"""

import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager

# Import from backend files
from .api.auth import auth_bp 
from .services import attach_jobs_store
from .api.heatmap import heatmap_bp
from .api.jobs import jobs_bp
from .core.config import logger
from .core.db import get_db_connection

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'supersecretkey')
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'superjwtsecretkey')
jwt = JWTManager(app)

# Configure CORS properly
allowed_origins = [o.strip() for o in os.getenv('ALLOWED_ORIGINS', '*').split(',')]
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": allowed_origins,
            "supports_credentials": True,
            "allow_headers": ["Content-Type", "Authorization"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "expose_headers": ["Content-Type", "Authorization"]
        }
    }
)


jobs = {}
attach_jobs_store(jobs)


# Register the authentication blueprint
app.register_blueprint(auth_bp)
app.register_blueprint(heatmap_bp)
app.register_blueprint(jobs_bp)

## no in-memory progress kept here; services.state manages progress



## moved DB update helpers into services.video_jobs


## moved to services.video_jobs.process_video_job

## moved to services.video_jobs.update_job_progress


## moved to api.jobs.create_heatmap_job

## moved to api.jobs.get_job_status

## moved to api.heatmap.get_heatmap_image

## moved to api.jobs.get_processed_video

## moved to api.jobs.get_job_history

## moved to api.jobs.delete_heatmap_job

## moved to api.jobs.cancel_heatmap_job

## moved to api.heatmap.get_detection_preview

## moved to api.heatmap.get_heatmap_preview

## moved to api.heatmap.receive_live_detections

# Helper function to load detections and fps from Supabase

## moved to api.heatmap.get_detections_from_json

## moved to api.heatmap.export_heatmap_csv+

## moved to api.heatmap.export_heatmap_pdf

## moved to api.heatmap.get_heatmap_analysis

# Helper function to run custom heatmap generation in a thread

## moved to services.video_jobs.run_custom_heatmap_job

## moved to api.heatmap.generate_custom_heatmap

## moved to api.heatmap.get_custom_heatmap_image

## moved to api.heatmap.get_custom_heatmap_progress

## moved to api.heatmap.get_custom_heatmap_analysis

## moved to api.jobs.get_job_points

## moved to api.jobs.get_job_time_range

# On backend startup, clean up orphaned jobs left as 'pending' or 'processing' if not running in memory

def cleanup_orphaned_jobs():
    conn = get_db_connection()
    cur = conn.cursor()
    # Find jobs that are not completed/cancelled/errored
    cur.execute(
        "SELECT job_id FROM jobs WHERE status IN ('pending', 'processing')"
    )
    orphaned = cur.fetchall()
    for row in orphaned:
        job_id = row[0]  # psycopg2 returns tuples, not dicts
        # If job is not in memory (not running), mark as error
        if job_id not in jobs:
            cur.execute(
                "UPDATE jobs SET status = %s, message = %s, updated_at = CURRENT_TIMESTAMP WHERE job_id = %s",
                ('error', 'Job was interrupted by server shutdown.', job_id)
            )
    cur.close()
    conn.commit()
    conn.close()


if __name__ == '__main__':
    # init_db()  # No longer needed, handled by Supabase
    cleanup_orphaned_jobs()  # Clean up jobs on startup
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=debug_mode)