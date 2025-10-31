from flask import Blueprint, request, jsonify, send_file, Response, send_from_directory
from flask_cors import cross_origin
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import io
import csv
import cv2

from ..core.config import RESULTS_FOLDER, UPLOAD_FOLDER, logger
from ..core.db import get_db_connection
from ..core.storage import download_image_from_supabase, download_image_bytes_from_supabase
from ..helpers.detections import load_detections
from ..helpers.analysis import analyze_heatmap
from ..services.video_jobs import run_custom_heatmap_job
from ..services.state import get_custom_progress, set_custom_progress

heatmap_bp = Blueprint('heatmap', __name__)

@heatmap_bp.route('/heatmap_jobs/test', methods=['GET', 'OPTIONS'])
@cross_origin()
def test_heatmap_cors():
    """Test endpoint to verify CORS is working for heatmap routes"""
    return jsonify({"message": "Heatmap CORS test successful", "status": "ok"})

@heatmap_bp.route('/test', methods=['GET', 'OPTIONS'])
@cross_origin()
def test_direct_cors():
    """Test endpoint for direct access without /api prefix"""
    return jsonify({"message": "Direct heatmap CORS test successful", "status": "ok"})


@heatmap_bp.route('/heatmap_jobs/<job_id>/preview/detections', methods=['GET'])
@cross_origin()
def get_detection_preview(job_id):
    job_folder = os.path.join(RESULTS_FOLDER, job_id)
    preview_path = os.path.join(job_folder, 'preview_detections.jpg')
    if not os.path.exists(preview_path):
        return jsonify({"error": "No detection preview available yet."}), 404
    return send_from_directory(job_folder, 'preview_detections.jpg')


@heatmap_bp.route('/heatmap_jobs/<job_id>/preview/heatmap', methods=['GET'])
@cross_origin()
def get_heatmap_preview(job_id):
    job_folder = os.path.join(RESULTS_FOLDER, job_id)
    preview_path = os.path.join(job_folder, 'preview_heatmap.jpg')
    if not os.path.exists(preview_path):
        return jsonify({"error": "No heatmap preview available yet."}), 404
    return send_from_directory(job_folder, 'preview_heatmap.jpg')


@heatmap_bp.route('/heatmap_jobs/<job_id>/detections', methods=['POST'])
def receive_live_detections(job_id):
    from services import get_jobs_store
    jobs = get_jobs_store()
    if job_id not in jobs:
        return jsonify({'error': 'Job not found'}), 404
    try:
        data = request.get_json()
        detections = data.get('detections', [])
        if 'live_detections' not in jobs[job_id]:
            jobs[job_id]['live_detections'] = []
        jobs[job_id]['live_detections'].extend(detections)
        return jsonify({'success': True, 'count': len(detections)})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


def get_detections_logic(job_id, current_user=None):
    """Shared logic for getting detections"""
    # Validate user ownership if user is provided
    if current_user is not None:
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute('SELECT "user" FROM jobs WHERE job_id = %s', (job_id,))
            job_row = cur.fetchone()
            if not job_row:
                logger.error(f"Job {job_id} not found")
                return jsonify({"error": "Job not found"}), 404
            # Extract user from row (handles both tuple and dict-like results)
            job_user = job_row['user'] if isinstance(job_row, dict) else job_row[0]
            if job_user != current_user:
                logger.error(f"User {current_user} attempted to access job {job_id} owned by {job_user}")
                return jsonify({"error": "Unauthorized: Job not found or not authorized"}), 403
        except Exception as e:
            logger.error(f"Error validating job ownership: {e}")
            return jsonify({"error": "Error validating job ownership"}), 500
        finally:
            cur.close()
            conn.close()
    
    # Load detections from Supabase
    detections, fps = load_detections(job_id)
    if detections is None:
        logger.warning(f"Detections file not found for job {job_id}")
        return jsonify({"error": "Detections file not found"}), 404
    return jsonify({"detections": detections, "fps": fps}), 200

@heatmap_bp.route('/heatmap_jobs/<job_id>/detections', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def get_detections_from_json(job_id):
    current_user = get_jwt_identity()
    return get_detections_logic(job_id, current_user)


def get_heatmap_image_logic(job_id):
    """Shared logic for getting heatmap image"""
    # First check if job is completed
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT status FROM jobs WHERE job_id = %s", (job_id,))
    job_status = cur.fetchone()
    cur.close()
    conn.close()
    
    if not job_status:
        return jsonify({"error": "Job not found"}), 404
    
    if job_status[0] != 'completed':
        return jsonify({"error": f"Job not completed yet. Status: {job_status[0]}"}), 400
    
    supabase_path = f"{job_id}/video_heatmap.jpg"
    logger.info(f"Attempting to download heatmap image from Supabase: {supabase_path}")
    img_bytes = download_image_bytes_from_supabase(supabase_path)
    if img_bytes is None:
        logger.error(f"Heatmap image not found in Supabase: {supabase_path}")
        return jsonify({"error": "Result image file not found in Supabase"}), 404
    
    logger.info(f"Successfully downloaded heatmap image from Supabase: {supabase_path}")
    return Response(img_bytes, mimetype="image/jpeg")

@heatmap_bp.route('/heatmap_jobs/<job_id>/result/image', methods=['GET', 'OPTIONS'])
@cross_origin()
def get_heatmap_image(job_id):
    return get_heatmap_image_logic(job_id)


@heatmap_bp.route('/heatmap_jobs/<job_id>/export/csv', methods=['GET', 'OPTIONS'])
@cross_origin(expose_headers=['Content-Disposition'])
@jwt_required()
def export_heatmap_csv(job_id):
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        conn = None
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
            job_row = cur.fetchone()
            cur.close()
            
            if not job_row:
                return jsonify({"error": "Job not found"}), 404
            if job_row[6] != 'completed':
                return jsonify({"error": "Job not completed"}), 404
        finally:
            if conn:
                conn.close()

        start_datetime = request.args.get('start_datetime', '')
        end_datetime = request.args.get('end_datetime', '')
        area = request.args.get('area', 'all')
        start_time = request.args.get('start_time', type=float)
        end_time = request.args.get('end_time', type=float)

        detections, fps = load_detections(job_id)
        if detections is None:
            return jsonify({"error": "Detections file not found"}), 404
        if not detections:
            return jsonify({"error": "No detections data available"}), 404

        if start_time is not None and end_time is not None:
            detections = [
                det for det in detections
                if 'timestamp' in det and start_time <= det['timestamp'] <= end_time
            ]
            # Try to find the custom heatmap
            timestamp = request.args.get('timestamp')
            unique_id = request.args.get('uuid')
            
            from ..core.storage import list_files_in_supabase
            files = list_files_in_supabase(f"{job_id}")
            logger.info(f"Found files for CSV export: {files}")
            logger.info(f"Looking for timestamp={timestamp}, uuid={unique_id}, start_time={start_time}, end_time={end_time}")
            
            if timestamp and unique_id:
                # Try exact match first
                supabase_path = f"{job_id}/custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}_{timestamp}_{unique_id}.jpg"
                logger.info(f"Looking for specific custom heatmap: {supabase_path}")
            else:
                # Try to find most recent matching custom heatmap
                prefix = f"{job_id}/custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}_"
                logger.info(f"Searching for files with prefix: {prefix}")
                matching_files = [f for f in files if f.startswith(prefix)]
                logger.info(f"Matching custom heatmaps found: {matching_files}")
                
                if matching_files:
                    supabase_path = sorted(matching_files)[-1]  # Get most recent
                    logger.info(f"Using most recent custom heatmap: {supabase_path}")
                else:
                    logger.error(f"No custom heatmap found matching time range {start_time:.1f}-{end_time:.1f}, available files: {files[:10]}")
                    # Return helpful error with available files
                    return jsonify({
                        "error": f"No custom heatmap found for time range {start_time:.1f}-{end_time:.1f}", 
                        "available_files": files[:10],
                        "searched_prefix": prefix
                    }), 404
        else:
            # Standard heatmap path when no time range is specified
            supabase_path = f"{job_id}/video_heatmap.jpg"
            logger.info(f"Using standard heatmap path: {supabase_path}")
        
        heatmap_color = download_image_from_supabase(supabase_path)
        if heatmap_color is None:
            return jsonify({"error": "Heatmap not found in Supabase"}), 404
        if len(heatmap_color.shape) == 3:
            heatmap_gray = cv2.cvtColor(heatmap_color, cv2.COLOR_BGR2GRAY)
        else:
            heatmap_gray = heatmap_color

        analysis = analyze_heatmap(heatmap_gray, (1080, 1920), detections=detections, fps=fps)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Heatmap Analysis Report'])
        writer.writerow([])
        writer.writerow(['Date and Time Range'])
        writer.writerow(['Start:', start_datetime if start_datetime else 'Full video duration'])
        writer.writerow(['End:', end_datetime if end_datetime else 'Full video duration'])
        writer.writerow(['Area:', area])
        writer.writerow([])
        writer.writerow(['Total Visitors:', analysis['total_visitors']])
        writer.writerow([])
        writer.writerow(['Traffic Distribution'])
        writer.writerow(['High Traffic (%)', 'Medium Traffic (%)', 'Low Traffic (%)'])
        writer.writerow([
            analysis['areas']['high']['percentage'],
            analysis['areas']['medium']['percentage'],
            analysis['areas']['low']['percentage']
        ])
        writer.writerow([])
        writer.writerow(['Recommendations'])
        for rec in analysis['recommendations']:
            writer.writerow([rec])
        if not analysis['recommendations']:
            writer.writerow(['No recommendations available.'])
        writer.writerow([])
        writer.writerow(['Peak Hours'])
        if analysis['peak_hours']:
            writer.writerow(['Start Minute', 'End Minute', 'Detections'])
            for ph in analysis['peak_hours']:
                writer.writerow([ph['start_minute'], ph['end_minute'], ph['count']])
        else:
            writer.writerow(['No peak hours detected.'])
        writer.writerow([])
        writer.writerow(['Detections'])
        writer.writerow(['Frame', 'Track ID', 'X1', 'Y1', 'X2', 'Y2', 'Timestamp'])
        for det in detections:
            writer.writerow([
                det['frame'],
                det['track_id'],
                det['bbox'][0],
                det['bbox'][1],
                det['bbox'][2],
                det['bbox'][3],
                det.get('timestamp', 'N/A')
            ])
        output.seek(0)
        
        # Get the CSV data
        csv_data = output.getvalue()
        output.close()
        
        # Create a temporary file
        temp_csv = f'/tmp/heatmap_{job_id}.csv'
        with open(temp_csv, 'w', newline='', encoding='utf-8') as f:
            f.write(csv_data)
        
        # Return the file
        return send_file(
            temp_csv,
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'heatmap_{job_id}.csv'
        )
        
        return response
    except Exception as e:
        return jsonify({"error": f"Error generating CSV export: {str(e)}"}), 500


@heatmap_bp.route('/heatmap_jobs/<job_id>/export/pdf', methods=['GET'])
@cross_origin(expose_headers=['Content-Disposition'])
@jwt_required()
def export_heatmap_pdf(job_id):
    try:
        start_datetime = request.args.get('start_datetime', 'Full video duration')
        end_datetime = request.args.get('end_datetime', 'Full video duration')
        area = request.args.get('area', 'all')
        start_time = request.args.get('start_time', type=float)
        end_time = request.args.get('end_time', type=float)

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
        job_row = cur.fetchone()
        cur.close()
        conn.close()
        if not job_row:
            return jsonify({'error': 'Job not found'}), 404
        if job_row[6] != 'completed':
            return jsonify({'error': 'Job not completed'}), 404

        detections, fps = load_detections(job_id)
        if detections is None:
            return jsonify({'error': 'Detections file not found'}), 404

        if start_time is not None and end_time is not None:
            detections = [
                det for det in detections
                if 'timestamp' in det and start_time <= det['timestamp'] <= end_time
            ]
            timestamp = request.args.get('timestamp')
            unique_id = request.args.get('uuid')
            
            # Try to find the custom heatmap
            from ..core.storage import list_files_in_supabase
            files = list_files_in_supabase(f"{job_id}")
            logger.info(f"Found files for PDF export: {files}")
            
            if timestamp and unique_id:
                # Try exact match first
                supabase_path = f"{job_id}/custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}_{timestamp}_{unique_id}.jpg"
                logger.info(f"Looking for specific custom heatmap: {supabase_path}")
            else:
                # Try to find most recent matching custom heatmap
                prefix = f"{job_id}/custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}_"
                matching_files = [f for f in files if f.startswith(prefix)]
                logger.info(f"Matching custom heatmaps found: {matching_files}")
                
                if matching_files:
                    supabase_path = sorted(matching_files)[-1]  # Get most recent
                    logger.info(f"Using most recent custom heatmap: {supabase_path}")
                else:
                    logger.error(f"No custom heatmap found matching time range {start_time:.1f}-{end_time:.1f}")
                    return jsonify({"error": f"No custom heatmap found for the specified time range. Please generate a custom heatmap first."}), 404
        else:
            # Standard heatmap path when no time range is specified
            supabase_path = f"{job_id}/video_heatmap.jpg"
            logger.info(f"Using standard heatmap path: {supabase_path}")
        
        heatmap_color = download_image_from_supabase(supabase_path)
        if heatmap_color is None:
            return jsonify({'error': 'Heatmap not found in Supabase'}), 404
        if len(heatmap_color.shape) == 3:
            heatmap_gray = cv2.cvtColor(heatmap_color, cv2.COLOR_BGR2GRAY)
        else:
            heatmap_gray = heatmap_color

        analysis = analyze_heatmap(heatmap_gray, (1080, 1920), detections=detections, fps=fps)
        if not analysis:
            return jsonify({'error': 'Analysis not found'}), 404

        try:
            from reportlab.platypus import Image, Paragraph, Spacer, SimpleDocTemplate
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        except ImportError as e:
            logger.error(f"ReportLab import error: {str(e)}")
            return jsonify({'error': 'PDF generation library not available'}), 500

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=24, spaceAfter=30)
        elements.append(Paragraph(f"Heatmap Analysis Report - {job_row[2]}", title_style))
        date_style = ParagraphStyle('DateStyle', parent=styles['Normal'], fontSize=12, spaceAfter=20)
        elements.append(Paragraph(f"Date and Time Range:", date_style))
        elements.append(Paragraph(f"Start: {start_datetime}", date_style))
        elements.append(Paragraph(f"End: {end_datetime}", date_style))
        elements.append(Paragraph(f"Area: {area}", date_style))
        elements.append(Spacer(1, 20))

        _, img_encoded = cv2.imencode('.jpg', heatmap_color)
        img_bytes = img_encoded.tobytes()
        img_buffer = io.BytesIO(img_bytes)
        elements.append(Image(img_buffer, width=400, height=300))
        elements.append(Spacer(1, 20))

        elements.append(Paragraph("Analysis Results:", styles['Heading2']))
        elements.append(Paragraph(f"Total Visitors: {analysis['total_visitors']}", styles['Normal']))
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Traffic Distribution:", styles['Heading3']))
        elements.append(Paragraph(f"High Traffic Areas: {analysis['areas']['high']['percentage']}%", styles['Normal']))
        elements.append(Paragraph(f"Medium Traffic Areas: {analysis['areas']['medium']['percentage']}%", styles['Normal']))
        elements.append(Paragraph(f"Low Traffic Areas: {analysis['areas']['low']['percentage']}%", styles['Normal']))
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Recommendations:", styles['Heading3']))
        for rec in analysis['recommendations']:
            elements.append(Paragraph(f"• {rec}", styles['Normal']))

        elements.append(Paragraph("Peak Hours:", styles['Heading3']))
        for ph in analysis['peak_hours']:
            elements.append(Paragraph(f"• {ph['start_minute']}-{ph['end_minute']} minutes: {ph['count']} detections", styles['Normal']))

        try:
            # Create PDF in memory first
            doc.build(elements)
            pdf_data = buffer.getvalue()
            buffer.close()
            
            # Create a temporary file to store the PDF
            temp_pdf = f'/tmp/heatmap_{job_id}_report.pdf'
            with open(temp_pdf, 'wb') as f:
                f.write(pdf_data)
            
            # Return the file
            return send_file(
                temp_pdf,
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'heatmap_{job_id}_report.pdf'
            )
            
        except Exception as e:
            logger.error(f"Error in PDF generation: {str(e)}")
            if buffer:
                buffer.close()
            return jsonify({"error": "Failed to generate PDF"}), 500
    except Exception as e:
        logger.error(f"PDF export error for job {job_id}: {str(e)}")
        import traceback
        logger.error(f"PDF export traceback: {traceback.format_exc()}")
        return jsonify({'error': f'PDF generation failed: {str(e)}'}), 500


@heatmap_bp.route('/heatmap_jobs/<job_id>/custom_heatmap', methods=['POST'])
@jwt_required()
def generate_custom_heatmap(job_id):
    try:
        data = request.get_json()
        start_time = float(data.get('start_time'))
        end_time = float(data.get('end_time'))
        set_custom_progress(job_id, 0.0)
        import threading
        t = threading.Thread(target=run_custom_heatmap_job, args=(job_id, start_time, end_time, lambda p: set_custom_progress(job_id, p)))
        t.daemon = True
        t.start()
        return jsonify({"success": True, "message": "Custom heatmap generation started. Poll progress endpoint."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@heatmap_bp.route('/heatmap_jobs/<job_id>/custom_analysis', methods=['GET'])
@cross_origin()
def get_custom_analysis(job_id):
    """Get custom analysis data for a job"""
    try:
        start = request.args.get('start_time')
        end = request.args.get('end_time')
        timestamp = request.args.get('timestamp')
        unique_id = request.args.get('uuid')

        # Check if we have minimum required parameters
        if not (start and end):
            return jsonify({"error": "Missing start_time or end_time parameters"}), 400

        # If we have timestamp and uuid, use them for specific image
        if timestamp and unique_id:
            # Match the exact naming convention from video_jobs.py (line 378)
            supabase_path = f"{job_id}/custom_heatmap_{float(start):.1f}_{float(end):.1f}_{timestamp}_{unique_id}.jpg"
            logger.info(f"Looking for specific file: {supabase_path}")
        else:
            # Try listing to find matching files
            from ..core.storage import list_files_in_supabase
            files = list_files_in_supabase(f"{job_id}")
            logger.info(f"Found files in Supabase for {job_id}: {files}")
            
            # Match the exact naming convention with .1f precision
            prefix = f"{job_id}/custom_heatmap_{float(start):.1f}_{float(end):.1f}_"
            logger.info(f"Looking for files matching prefix: {prefix}")
            
            matching_files = [f for f in files if f.startswith(prefix)]
            logger.info(f"Matching files found: {matching_files}")
            
            if matching_files:
                supabase_path = sorted(matching_files)[-1]  # Get most recent
                logger.info(f"Selected most recent file: {supabase_path}")
            else:
                logger.error(f"No matching custom heatmap found for prefix: {prefix}")
                return jsonify({"error": "No matching custom heatmap found"}), 404

        # Get the heatmap image for analysis
        heatmap_color = download_image_from_supabase(supabase_path)
        if heatmap_color is None:
            return jsonify({"error": "Custom heatmap not found"}), 404
        
        # Convert to grayscale for analysis
        if len(heatmap_color.shape) == 3:
            heatmap_gray = cv2.cvtColor(heatmap_color, cv2.COLOR_BGR2GRAY)
        else:
            heatmap_gray = heatmap_color
        
        # Get detections for the time range
        detections, fps = load_detections(job_id)
        if detections is None:
            return jsonify({"error": "Detections not found"}), 404
        
        # Filter detections for the time range
        start_time = float(start)
        end_time = float(end)
        filtered_detections = [
            det for det in detections
            if 'timestamp' in det and start_time <= det['timestamp'] <= end_time
        ]
        
        # Run analysis
        analysis = analyze_heatmap(heatmap_gray, (1080, 1920), detections=filtered_detections, fps=fps)
        
        # Return JSON analysis data
        return jsonify(analysis)

    except Exception as e:
        logger.error(f"Error in get_custom_analysis: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@heatmap_bp.route('/heatmap_jobs/<job_id>/export/jpg', methods=['GET'])
@cross_origin(expose_headers=['Content-Disposition'])
def export_heatmap_jpg(job_id):
    try:
        start_time = request.args.get('start_time', type=float)
        end_time = request.args.get('end_time', type=float)
        timestamp = request.args.get('timestamp')
        unique_id = request.args.get('uuid')
        
        if start_time is not None and end_time is not None and timestamp and unique_id:
            supabase_path = f"{job_id}/custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}_{timestamp}_{unique_id}.jpg"
        else:
            supabase_path = f"{job_id}/video_heatmap.jpg"
            
        image_bytes = download_image_bytes_from_supabase(supabase_path)
        if not image_bytes:
            return jsonify({"error": "Heatmap image not found"}), 404
            
        return Response(
            image_bytes,
            mimetype='image/jpeg',
            headers={
                'Content-Disposition': f'attachment; filename=heatmap_{job_id}.jpg',
                'Access-Control-Expose-Headers': 'Content-Disposition'
            }
        )
    except Exception as e:
        logger.error(f"Error in export_heatmap_jpg: {e}")
        return jsonify({"error": str(e)}), 500

@heatmap_bp.route('/heatmap_jobs/<job_id>/custom_heatmap_image', methods=['GET', 'OPTIONS'])
@cross_origin()
def get_custom_heatmap_image(job_id):
    if request.method == 'OPTIONS':
        response = Response(status=200)
        response.headers.update({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        })
        return response
        
    start = request.args.get('start')
    end = request.args.get('end')
    timestamp = request.args.get('timestamp')
    unique_id = request.args.get('uuid')
    
    if not all([start, end]):
        return jsonify({"error": "Missing start or end parameters"}), 400
        
    # List all files in the job's folder to find the right one
    from ..core.storage import list_files_in_supabase
    files = list_files_in_supabase(f"{job_id}")
    
    if timestamp and unique_id:
        # Try exact match first
        supabase_path = f"{job_id}/custom_heatmap_{float(start):.1f}_{float(end):.1f}_{timestamp}_{unique_id}.jpg"
    else:
        # Try to find most recent matching file
        matching_files = [f for f in files if f.startswith(f"{job_id}/custom_heatmap_{float(start):.1f}_{float(end):.1f}_")]
        if matching_files:
            supabase_path = sorted(matching_files)[-1]  # Get most recent
        else:
            supabase_path = f"{job_id}/custom_heatmap_{float(start):.1f}_{float(end):.1f}.jpg"
    
    logger.info(f"Attempting to download: {supabase_path}")
    img_bytes = download_image_bytes_from_supabase(supabase_path)
    
    if img_bytes is None:
        return jsonify({
            "error": "Custom heatmap not found in Supabase",
            "path": supabase_path,
            "available_files": files
        }), 404
    
    # Return image bytes directly without saving to disk
    response = Response(
        img_bytes,
        mimetype="image/jpeg",
        headers={
            'Content-Disposition': f'inline; filename=heatmap_{job_id}.jpg',
            'Cache-Control': 'no-cache'
        }
    )
    
    return response


@heatmap_bp.route('/heatmap_jobs/<job_id>/custom_heatmap_progress')
def get_custom_heatmap_progress(job_id):
    progress = get_custom_progress(job_id)
    # Include the custom heatmap metadata if available
    from ..services.state import get_jobs_store
    jobs = get_jobs_store()
    meta = jobs.get(job_id, {}).get('custom_heatmap_meta', {})
    return jsonify({
        "progress": progress,
        "timestamp": meta.get('timestamp'),
        "uuid": meta.get('uuid')
    })


def get_heatmap_analysis_logic(job_id):
    """Shared logic for getting heatmap analysis"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
    job_row = cur.fetchone()
    cur.close()
    conn.close()
    if not job_row:
        return jsonify({"error": "Job not found"}), 404
    if job_row[6] != 'completed':
        return jsonify({"error": "Job not completed"}), 404

    from ..core.storage import download_image_from_supabase
    supabase_path = f"{job_id}/video_heatmap.jpg"
    img = download_image_from_supabase(supabase_path)
    if img is None:
        return jsonify({"error": "Heatmap file not found in Supabase"}), 404
    if len(img.shape) == 3:
        img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        img_gray = img
    
    # Try to load floorplan from local filesystem first, then from Supabase
    floorplan_filename = job_row[3]
    floorplan_path = os.path.join(UPLOAD_FOLDER, job_id, floorplan_filename)
    floorplan = cv2.imread(floorplan_path)
    
    if floorplan is None:
        # Try to load from Supabase
        logger.info(f"Floorplan not found locally at {floorplan_path}, trying Supabase...")
        try:
            floorplan_supabase_path = f"{job_id}/{floorplan_filename}"
            floorplan = download_image_from_supabase(floorplan_supabase_path)
            if floorplan is None:
                # If floorplan is still not found, use a default size for analysis
                logger.warning(f"Floorplan not found in Supabase either: {floorplan_supabase_path}. Using default dimensions.")
                # Use the heatmap image dimensions as fallback
                floorplan_height, floorplan_width = img_gray.shape[:2]
                logger.info(f"Using heatmap dimensions as floorplan fallback: {floorplan_width}x{floorplan_height}")
            else:
                logger.info(f"Successfully loaded floorplan from Supabase: {floorplan_supabase_path}")
        except Exception as e:
            logger.error(f"Error loading floorplan from Supabase: {e}")
            # Use heatmap dimensions as fallback
            floorplan_height, floorplan_width = img_gray.shape[:2]
            logger.info(f"Using heatmap dimensions as floorplan fallback: {floorplan_width}x{floorplan_height}")
    
    # If floorplan is still None, use heatmap dimensions
    if floorplan is None:
        floorplan_height, floorplan_width = img_gray.shape[:2]
        logger.info(f"Using heatmap dimensions as floorplan fallback: {floorplan_width}x{floorplan_height}")
    else:
        floorplan_height, floorplan_width = floorplan.shape[:2]
    
    detections, fps = load_detections(job_id)
    analysis = analyze_heatmap(img_gray, (floorplan_height, floorplan_width), detections=detections, fps=fps)
    return jsonify(analysis)

@heatmap_bp.route('/heatmap_jobs/<job_id>/analysis', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def get_heatmap_analysis(job_id):
    return get_heatmap_analysis_logic(job_id)
