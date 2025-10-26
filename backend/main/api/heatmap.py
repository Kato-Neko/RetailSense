from flask import Blueprint, request, jsonify, send_file, Response, send_from_directory
from flask_cors import cross_origin
from flask_jwt_extended import jwt_required
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
@cross_origin()
@jwt_required()
def export_heatmap_csv(job_id):
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
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
            # Get the stored custom heatmap path
            cur = conn.cursor()
            try:
                cur.execute("SELECT custom_heatmap_path FROM jobs WHERE job_id = %s", (job_id,))
                result = cur.fetchone()
                if result and result[0]:
                    supabase_path = result[0]
                else:
                    supabase_path = f"{job_id}/custom_heatmap_default.jpg"
            finally:
                cur.close()
        else:
            supabase_path = f"{job_id}/video_heatmap.jpg"
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
        
        # Save to a temporary file
        temp_csv = os.path.join(os.path.dirname(__file__), f'temp_{job_id}.csv')
        with open(temp_csv, 'w', newline='', encoding='utf-8') as f:
            f.write(output.getvalue())
        output.close()
        
        response = send_file(
            temp_csv,
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'heatmap_{job_id}.csv'
        )
        
        @response.call_on_close
        def cleanup():
            try:
                if os.path.exists(temp_csv):
                    os.remove(temp_csv)
            except:
                pass
        
        return response
    except Exception as e:
        return jsonify({"error": f"Error generating CSV export: {str(e)}"}), 500


@heatmap_bp.route('/heatmap_jobs/<job_id>/export/pdf', methods=['GET'])
@cross_origin()
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
        if start_time is not None and end_time is not None:
            timestamp = request.args.get('timestamp')
            unique_id = request.args.get('uuid')
            import time, uuid
            ts = str(int(time.time()))
            uid = str(uuid.uuid4())[:8]
            supabase_path = f"{job_id}/custom_heatmap_{float(start_time):.1f}_{float(end_time):.1f}_{ts}_{uid}.jpg"
            return jsonify({'timestamp': ts, 'uuid': uid}), 200
        else:
            supabase_path = f"{job_id}/video_heatmap.jpg"
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
            doc.build(elements)
            buffer.seek(0)
            
            # Create a new memory buffer for the response
            response_buffer = io.BytesIO(buffer.getvalue())
            buffer.close()
            response_buffer.seek(0)
            
            # Create the response
            response = send_file(
                response_buffer,
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'heatmap_{job_id}_report.pdf'
            )
            
            response.headers.update({
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Content-Type': 'application/pdf',
                'Content-Disposition': f'attachment; filename=heatmap_{job_id}_report.pdf'
            })
            
            # Schedule file deletion after response is sent
            @response.call_on_close
            def cleanup():
                try:
                    response_buffer.close()
                except:
                    pass
                    
            return response
            
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
    
    # Save the image to a temporary file
    temp_jpg = os.path.join(os.path.dirname(__file__), f'temp_{job_id}.jpg')
    with open(temp_jpg, 'wb') as f:
        f.write(img_bytes)
    
    response = send_file(
        temp_jpg,
        mimetype="image/jpeg",
        as_attachment=True,
        download_name=f"heatmap_{job_id}.jpg"
    )
    
    @response.call_on_close
    def cleanup():
        try:
            if os.path.exists(temp_jpg):
                os.remove(temp_jpg)
        except:
            pass
    
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
