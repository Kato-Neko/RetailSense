from flask import Blueprint, request, jsonify, send_file, Response, send_from_directory
from flask_cors import cross_origin
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import io
import csv
import cv2
import psycopg2.extras

from ..core.config import RESULTS_FOLDER, UPLOAD_FOLDER, logger
from ..core.config import to_manila_iso
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


def get_detections_logic(job_id):
    """Shared logic for getting detections"""
    detections, fps = load_detections(job_id)
    if detections is None:
        return jsonify({"error": "Detections file not found"}), 404
    return jsonify({"detections": detections, "fps": fps}), 200

@heatmap_bp.route('/heatmap_jobs/<job_id>/detections', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def get_detections_from_json(job_id):
    return get_detections_logic(job_id)


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
    
    # Check for cached analysis first
    from ..core.storage_manager import download_json_from_supabase, upload_json_to_supabase
    cache_path = f"{job_id}/analysis_cache.json"
    
    use_ai = os.getenv('USE_AI_RECOMMENDATIONS', 'false').lower() == 'true'
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    # STEP 1: Check for cached AI analysis
    # Always use cached AI analysis if available (only bypass for rule-based cache or manual refresh)
    if not force_refresh:
        try:
            cached_analysis = download_json_from_supabase(cache_path)
            if cached_analysis:
                cache_source = cached_analysis.get('recommendations_source')
                
                # If cache has AI-generated recommendations → always use it
                if cache_source == 'ai' and cached_analysis.get('recommendations_provider'):
                    logger.info(f"Using cached AI analysis for job {job_id} (source: {cached_analysis.get('recommendations_provider')})")
                    return jsonify(cached_analysis)
                
                # If cache has rule-based recommendations and AI is enabled → skip cache to retry AI
                # This allows retrying AI when quota resets, rather than using stale rule-based cache
                if use_ai and cache_source == 'rule':
                    logger.info(f"Cache contains rule-based recommendations for job {job_id}, skipping cache to retry AI")
                # If AI is disabled, rule-based cache is fine to use
                elif not use_ai:
                    logger.info(f"Using cached analysis for job {job_id} (AI disabled)")
                    return jsonify(cached_analysis)
        except Exception as e:
            logger.warning(f"Could not load cached analysis for job {job_id}: {e}")
    
    # STEP 2: No valid cache found, run fresh analysis
    logger.info(f"Running fresh analysis for job {job_id}")
    detections, fps = load_detections(job_id)
    analysis = analyze_heatmap(img_gray, (floorplan_height, floorplan_width), detections=detections, fps=fps)
    
    # STEP 3: Cache result only if AI recommendations were successfully generated
    # This ensures:
    # - AI analysis is cached and reused for future requests
    # - Rule-based fallback is NOT cached, allowing AI to retry on next request
    should_cache = False
    if use_ai:
        # Only cache if AI successfully generated recommendations
        if analysis.get('recommendations_source') == 'ai' and analysis.get('recommendations_provider'):
            should_cache = True
            logger.info(f"AI recommendations generated for job {job_id}, caching for future use")
        else:
            should_cache = False
            logger.info(f"AI failed or quota exceeded for job {job_id}, using rule-based fallback (not caching to allow retry)")
    else:
        # If AI is disabled, always cache (rule-based is the expected result)
        should_cache = True
        logger.info(f"AI disabled for job {job_id}, caching rule-based recommendations")
    
    if should_cache:
        try:
            upload_json_to_supabase(analysis, cache_path)
            logger.info(f"Successfully cached analysis for job {job_id}")
        except Exception as e:
            logger.warning(f"Could not cache analysis for job {job_id}: {e}")
            # Continue anyway - caching is optional
    
    return jsonify(analysis)

@heatmap_bp.route('/heatmap_jobs/<job_id>/analysis', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def get_heatmap_analysis(job_id):
    return get_heatmap_analysis_logic(job_id)


@heatmap_bp.route('/heatmap_jobs/<job_id>/live/heatmap', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def get_live_heatmap_image(job_id):
    """Get the current live heatmap image"""
    try:
        supabase_path = f"{job_id}/live_heatmap.jpg"
        logger.info(f"Attempting to download live heatmap image from Supabase: {supabase_path}")
        img_bytes = download_image_bytes_from_supabase(supabase_path)
        if img_bytes is None:
            logger.warning(f"Live heatmap image not found in Supabase: {supabase_path}")
            return jsonify({"error": "Live heatmap not available yet"}), 404
        
        logger.info(f"Successfully downloaded live heatmap image from Supabase: {supabase_path}")
        return Response(img_bytes, mimetype="image/jpeg")
    except Exception as e:
        logger.error(f"Error getting live heatmap: {e}")
        return jsonify({"error": str(e)}), 500


@heatmap_bp.route('/heatmap_jobs/<job_id>/live/floorplan', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def get_live_floorplan_image(job_id):
    """Get the saved floorplan (first frame) for a live job"""
    try:
        supabase_path = f"{job_id}/floorplan_{job_id}.jpg"
        logger.info(f"Attempting to download live floorplan image from Supabase: {supabase_path}")
        img_bytes = download_image_bytes_from_supabase(supabase_path)
        if img_bytes is None:
            logger.warning(f"Live floorplan image not found in Supabase: {supabase_path}")
            return jsonify({"error": "Floorplan not available yet"}), 404
        return Response(img_bytes, mimetype="image/jpeg")
    except Exception as e:
        logger.error(f"Error getting live floorplan: {e}")
        return jsonify({"error": str(e)}), 500


@heatmap_bp.route('/heatmap_jobs/<job_id>/live/feed', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def get_live_camera_feed(job_id):
    """Get the current live camera feed frame (single frame)"""
    try:
        from ..services.live_stream import get_latest_frame, get_live_job_processor
        
        # Check if processor exists and is running
        processor = get_live_job_processor(job_id)
        if not processor:
            logger.warning(f"No processor found for job {job_id}")
            frame_bytes = None
        elif not processor.is_running:
            logger.warning(f"Processor for job {job_id} is not running")
            frame_bytes = None
        else:
            frame_bytes = get_latest_frame(job_id)
        
        if frame_bytes is None:
            # Return a placeholder image with message
            import cv2
            import numpy as np
            placeholder = np.zeros((480, 640, 3), dtype=np.uint8)
            # Add text message
            cv2.putText(placeholder, 'Waiting for frames...', (50, 200), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            if processor and not processor.is_running:
                cv2.putText(placeholder, 'Stream not running', (50, 250), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            _, buffer = cv2.imencode('.jpg', placeholder, [cv2.IMWRITE_JPEG_QUALITY, 85])
            return Response(
                buffer.tobytes(),
                mimetype="image/jpeg",
                headers={
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'X-Frame-Status': 'placeholder'
                }
            )
        
        return Response(
            frame_bytes,
            mimetype="image/jpeg",
            headers={
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'X-Frame-Status': 'live'
            }
        )
    except Exception as e:
        logger.error(f"Error getting live feed: {e}", exc_info=True)
        # Return error as image to prevent network errors
        try:
            import cv2
            import numpy as np
            error_img = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(error_img, 'Error loading feed', (50, 200), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            cv2.putText(error_img, str(e)[:50], (50, 250), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            _, buffer = cv2.imencode('.jpg', error_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
            return Response(
                buffer.tobytes(),
                mimetype="image/jpeg",
                headers={
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'X-Frame-Status': 'error'
                }
            )
        except Exception as e2:
            logger.error(f"Error creating error image: {e2}")
            return jsonify({"error": str(e)}), 500


@heatmap_bp.route('/heatmap_jobs/live/debug', methods=['GET'])
@cross_origin()
@jwt_required()
def debug_live_jobs():
    """Debug endpoint to list all live jobs and their processors"""
    try:
        from ..services.state import get_jobs_store
        jobs = get_jobs_store()
        result = {}
        for job_id, job_data in jobs.items():
            if job_data.get('job_type') == 'live':
                processor = job_data.get('processor')
                result[job_id] = {
                    'status': job_data.get('status'),
                    'message': job_data.get('message'),
                    'has_processor': processor is not None,
                    'is_running': processor.is_running if processor else False,
                    'has_frame': None
                }
                if processor:
                    try:
                        with processor.latest_frame_lock:
                            result[job_id]['has_frame'] = processor.latest_frame is not None
                    except:
                        result[job_id]['has_frame'] = False
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@heatmap_bp.route('/heatmap_jobs/<job_id>/live/stream', methods=['GET', 'OPTIONS'])
@cross_origin()
def get_live_camera_stream(job_id):
    """MJPEG stream endpoint - browser compatible streaming
    Note: JWT check is done manually to avoid issues with streaming"""
    if request.method == 'OPTIONS':
        # Let Flask-CORS handle OPTIONS requests
        response = Response(status=200)
        return response
    
    # Manual JWT check for streaming compatibility
    # Note: img tags cannot send Authorization headers, so we check query params
    # This is a relaxed check - for production, consider using a more secure approach
    auth_header = request.headers.get('Authorization', '')
    token_param = request.args.get('token')
    token_header = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else None
    token = token_param or token_header
    
    # Basic token validation - at minimum, ensure a token is present
    if not token:
        logger.warning("No token provided for stream")
        return jsonify({"error": "Unauthorized"}), 401
    
    # For now, we'll allow the stream if a token is present
    # In production, you should add proper JWT verification here
    # The job_id itself provides some security as it's unique per user
    
    try:
        from ..services.live_stream import get_live_job_processor
        
        processor = get_live_job_processor(job_id)
        
        # Add detailed logging
        if not processor:
            logger.warning(f"Processor not found for job {job_id}")
            # Try to get processor from jobs store directly for debugging
            from ..services.state import get_jobs_store
            jobs = get_jobs_store()
            logger.warning(f"Available jobs: {list(jobs.keys())}")
            if job_id in jobs:
                logger.warning(f"Job {job_id} found in store with keys: {list(jobs[job_id].keys())}")
        elif not processor.is_running:
            logger.warning(f"Processor exists but is_running={processor.is_running} for job {job_id}")
            # Check if latest_frame exists even if not running
            with processor.latest_frame_lock:
                has_frame = processor.latest_frame is not None
            logger.info(f"Processor has frame: {has_frame}")
        else:
            logger.info(f"Processor found and running for job {job_id}")
            with processor.latest_frame_lock:
                has_frame = processor.latest_frame is not None
            logger.info(f"Processor has frame: {has_frame}")
        
        # If processor doesn't exist, return error
        if not processor:
            def generate_error():
                import cv2
                import numpy as np
                error_img = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(error_img, 'Stream not available', (50, 200), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                _, buffer = cv2.imencode('.jpg', error_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            
            response = Response(
                generate_error(),
                mimetype='multipart/x-mixed-replace; boundary=frame',
                headers={
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            )
            return response
        
        def generate():
            import cv2
            import time
            import numpy as np
            last_frame_time = 0
            frame_interval = 1.0 / 5.0  # 5 FPS for MJPEG stream
            consecutive_errors = 0
            max_errors = 10
            
            # Stream while processor exists (not just while running, to show last frame)
            while True:
                try:
                    current_time = time.time()
                    if current_time - last_frame_time < frame_interval:
                        time.sleep(0.05)  # Small sleep to prevent CPU overload
                        continue
                    
                    # Re-check processor exists (it might have been removed)
                    if not processor:
                        error_img = np.zeros((480, 640, 3), dtype=np.uint8)
                        cv2.putText(error_img, 'Stream ended', (50, 200),
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                        _, buffer = cv2.imencode('.jpg', error_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
                        yield (b'--frame\r\n'
                               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
                        break
                    
                    # Get latest frame
                    frame = None
                    try:
                        with processor.latest_frame_lock:
                            if processor.latest_frame is not None:
                                frame = processor.latest_frame.copy()
                    except Exception as e:
                        logger.error(f"Error accessing latest_frame: {e}")
                        frame = None
                    
                    if frame is None:
                        # No frame available yet - send placeholder with status info
                        placeholder_img = np.zeros((480, 640, 3), dtype=np.uint8)
                        if processor:
                            if processor.is_running:
                                status_text = 'Waiting for frames...'
                                color = (255, 255, 255)
                            else:
                                status_text = 'Stream paused'
                                color = (255, 255, 0)
                        else:
                            status_text = 'No processor'
                            color = (0, 0, 255)
                        
                        cv2.putText(placeholder_img, status_text, (50, 200),
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                        
                        # If we've been waiting a while, add helpful message
                        if time.time() - last_frame_time > 5:
                            cv2.putText(placeholder_img, 'Check RTSP connection', (50, 240),
                                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                        
                        _, placeholder_buffer = cv2.imencode('.jpg', placeholder_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
                        yield (b'--frame\r\n'
                               b'Content-Type: image/jpeg\r\n\r\n' + placeholder_buffer.tobytes() + b'\r\n')
                        last_frame_time = current_time
                        consecutive_errors = 0
                        time.sleep(0.5)  # Wait longer if no frames
                        continue
                    
                    # Encode frame as JPEG
                    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    frame_bytes = buffer.tobytes()
                    
                    # Yield frame in MJPEG format
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                    
                    last_frame_time = current_time
                    consecutive_errors = 0
                    
                except Exception as e:
                    consecutive_errors += 1
                    logger.error(f"Error generating MJPEG frame (error {consecutive_errors}/{max_errors}): {e}")
                    
                    if consecutive_errors >= max_errors:
                        # Too many errors, send error frame and stop
                        try:
                            error_img = np.zeros((480, 640, 3), dtype=np.uint8)
                            cv2.putText(error_img, 'Stream error', (50, 200),
                                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                            _, buffer = cv2.imencode('.jpg', error_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
                            yield (b'--frame\r\n'
                                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
                        except:
                            pass
                        break
                    
                    time.sleep(0.1)
                    
        response = Response(
            generate(),
            mimetype='multipart/x-mixed-replace; boundary=frame',
            headers={
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        )
        return response
        
    except Exception as e:
        logger.error(f"Error starting MJPEG stream: {e}", exc_info=True)
        # Return error as image stream to prevent browser errors
        try:
            import cv2
            import numpy as np
            error_img = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(error_img, 'Stream error', (50, 200), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            cv2.putText(error_img, str(e)[:50], (50, 250), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            _, buffer = cv2.imencode('.jpg', error_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
            
            def generate_error_stream():
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            
            return Response(
                generate_error_stream(),
                mimetype='multipart/x-mixed-replace; boundary=frame',
                headers={
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
            )
        except Exception as e2:
            logger.error(f"Error creating error stream: {e2}")
            return jsonify({"error": str(e)}), 500


@heatmap_bp.route('/heatmap_jobs/<job_id>/live/status', methods=['GET', 'OPTIONS'])
@cross_origin()
@jwt_required()
def get_live_job_status(job_id):
    """Get status of a live streaming job"""
    try:
        current_user = get_jwt_identity()

        # Always get processor status first to ensure fast response
        from ..services.live_stream import get_live_job_processor
        processor = get_live_job_processor(job_id)
        is_running = processor.is_running if processor else False
        frame_count = processor.frame_count if processor else 0
        heatmap_last_updated = None
        heatmap_interval_seconds = None
        floorplan_present = False
        if processor:
            try:
                heatmap_last_updated = processor.last_heatmap_update
                heatmap_interval_seconds = getattr(processor, 'heatmap_update_interval', None)
                import os
                floorplan_present = bool(processor.floorplan_path and os.path.exists(processor.floorplan_path))
            except Exception:
                heatmap_last_updated = None
                heatmap_interval_seconds = None
                floorplan_present = False

        # Try to augment with DB data, but do not block longer than a short timeout
        job_row = None
        db_unavailable = False
        try:
            conn = get_db_connection()
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                # Set a short statement timeout (PostgreSQL) to avoid long hangs
                try:
                    cur.execute("SET LOCAL statement_timeout = 3000")
                except Exception:
                    pass

                cur.execute("SELECT * FROM jobs WHERE job_id = %s", (job_id,))
                job_row = cur.fetchone()
        except Exception:
            # Database unavailable/slow; proceed with processor-only data
            db_unavailable = True

        if not job_row and not processor:
            return jsonify({"error": "Job not found"}), 404

        # Authorization check only if we had DB data
        if job_row and job_row['user'] != current_user:
            return jsonify({"error": "Unauthorized"}), 403

        # Defaults when DB is unavailable
        status_val = 'live' if is_running else 'connecting' if processor else 'unknown'
        message_val = 'Streaming' if is_running else 'Connecting...' if processor else 'N/A'
        camera_name_val = None
        rtsp_url_val = None
        is_live_val = True if processor else False
        created_at_val = None
        updated_at_val = None

        if job_row:
            status_val = job_row['status']
            message_val = job_row['message']
            camera_name_val = job_row.get('camera_name')
            rtsp_url_val = job_row.get('rtsp_url')
            is_live_val = job_row.get('is_live', is_live_val)
            created_at_val = to_manila_iso(job_row['created_at']) if job_row['created_at'] else None
            updated_at_val = to_manila_iso(job_row['updated_at']) if job_row['updated_at'] else None

        response_data = {
            "job_id": job_id,
            "status": status_val,
            "message": message_val,
            "camera_name": camera_name_val,
            "rtsp_url": rtsp_url_val,
            "is_live": is_live_val,
            "is_running": is_running,
            "frame_count": frame_count,
            "created_at": created_at_val,
            "updated_at": updated_at_val,
            "heatmap_last_updated": heatmap_last_updated,
            "heatmap_interval_seconds": heatmap_interval_seconds,
            "floorplan_present": floorplan_present,
            "db_unavailable": db_unavailable
        }

        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Error getting live job status: {e}", exc_info=True)
        return jsonify({"error": f"Server error: {str(e)}"}), 500