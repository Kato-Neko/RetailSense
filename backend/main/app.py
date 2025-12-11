"""
app.py
Flask entry point for the backend, using refactored modules.
"""

import os
from flask import Flask, jsonify, request, make_response
from flask_cors import CORS, cross_origin
from flask_jwt_extended import JWTManager, jwt_required

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
            "origins": "*",  # Allow all origins
            "supports_credentials": True,
            "allow_headers": ["Content-Type", "Authorization"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "expose_headers": ["Content-Type", "Authorization", "Content-Disposition"],
            "max_age": 600  # Cache preflight requests for 10 minutes
        },
        r"/*": {  # Add this to catch any routes not under /api
            "origins": "*",  # Allow all origins
            "supports_credentials": True,
            "allow_headers": ["Content-Type", "Authorization"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "expose_headers": ["Content-Type", "Authorization", "Content-Disposition"],
            "max_age": 600  # Cache preflight requests for 10 minutes
        }
    }
)

# Add OPTIONS handler for all routes
# Note: Flask-CORS handles CORS automatically, so we only handle OPTIONS if CORS doesn't
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        # Let Flask-CORS handle it - don't add duplicate headers
        response = make_response()
        return response


jobs = {}
attach_jobs_store(jobs)


# Register the authentication blueprint
app.register_blueprint(auth_bp)
app.register_blueprint(heatmap_bp, url_prefix='/api')
app.register_blueprint(jobs_bp, url_prefix='/api')

# Add a simple test route to verify routing is working
@app.route('/api/test')
def test_route():
    return jsonify({"message": "API routing is working"})

# Health check endpoint
@app.route('/health')
@app.route('/api/health')
def health_check():
    """Health check endpoint for monitoring system status."""
    try:
        from .services.job_queue import get_job_queue
        from .services.tracking import _get_model
        from .core.db import get_db_connection_context
        
        # Check job queue
        job_queue = get_job_queue()
        queue_status = job_queue.get_status()
        
        # Check model is loaded (cached)
        model_loaded = False
        try:
            model = _get_model()
            model_loaded = model is not None
        except Exception as e:
            logger.warning(f"Model check failed: {e}")
        
        # Check database connection
        db_healthy = False
        try:
            with get_db_connection_context() as conn:
                cur = conn.cursor()
                cur.execute("SELECT 1")
                cur.fetchone()
                cur.close()
                db_healthy = True
        except Exception as e:
            logger.warning(f"Database check failed: {e}")
        
        status = "healthy" if (model_loaded and db_healthy) else "degraded"
        
        return jsonify({
            "status": status,
            "model_loaded": model_loaded,
            "database": "connected" if db_healthy else "disconnected",
            "job_queue": queue_status,
            "timestamp": __import__('datetime').datetime.now().isoformat()
        }), 200 if status == "healthy" else 503
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 503

# Direct routes for backward compatibility (without /api prefix)
@app.route('/heatmap_jobs/<job_id>/result/image', methods=['GET', 'OPTIONS'])
@cross_origin()
def direct_heatmap_image(job_id):
    """Direct access to heatmap image without /api prefix"""
    from .api.heatmap import get_heatmap_image_logic
    return get_heatmap_image_logic(job_id)

@app.route('/heatmap_jobs/<job_id>/detections', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def direct_heatmap_detections(job_id):
    """Direct access to detections without /api prefix"""
    from .api.heatmap import get_detections_logic
    from flask_jwt_extended import get_jwt_identity
    current_user = get_jwt_identity()
    return get_detections_logic(job_id, current_user)

@app.route('/heatmap_jobs/<job_id>/regenerate_detections', methods=['POST', 'OPTIONS'])
@cross_origin()
@jwt_required()
def direct_regenerate_detections(job_id):
    """Direct access to regenerate detections without /api prefix"""
    from .api.heatmap import regenerate_detections
    return regenerate_detections(job_id)

@app.route('/heatmap_jobs/<job_id>/analysis', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def direct_heatmap_analysis(job_id):
    """Direct access to analysis without /api prefix"""
    from .api.heatmap import get_heatmap_analysis_logic
    return get_heatmap_analysis_logic(job_id)

@app.route('/heatmap_jobs/<job_id>/export/pdf', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def direct_export_pdf(job_id):
    """Direct access to PDF export without /api prefix"""
    from .api.heatmap import export_heatmap_pdf
    return export_heatmap_pdf(job_id)

@app.route('/heatmap_jobs/<job_id>/export/csv', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def direct_export_csv(job_id):
    """Direct access to CSV export without /api prefix"""
    from .api.heatmap import export_heatmap_csv
    return export_heatmap_csv(job_id)

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
    from .core.db import get_db_connection_context
    with get_db_connection_context() as conn:
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
        conn.commit()


if __name__ == '__main__':
    # init_db()  # No longer needed, handled by Supabase
    cleanup_orphaned_jobs()  # Clean up jobs on startup
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=debug_mode)