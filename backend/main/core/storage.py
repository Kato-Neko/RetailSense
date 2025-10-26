"""
Supabase Storage helpers: upload and download JSON and images.
"""

import os
import json
import cv2
import numpy as np
from .config import supabase, logger


def upload_to_supabase_and_remove_local(local_path, supabase_path, content_type):
    try:
        bucket = "projectresults"
        with open(local_path, "rb") as f:
            supabase.storage.from_(bucket).upload(supabase_path, f, {"content-type": content_type})
        os.remove(local_path)
        logger.info(f"Uploaded and removed local: {local_path} -> {bucket}/{supabase_path}")
    except Exception as e:
        logger.error(f"Failed to upload {local_path} to Supabase: {e}")
        raise


def upload_json_to_supabase(data, supabase_path):
    bucket = "projectresults"
    json_bytes = json.dumps(data).encode("utf-8")
    supabase.storage.from_(bucket).upload(
        supabase_path,
        json_bytes,
        {"content-type": "application/json"}
    )
    logger.info(f"Uploaded JSON to Supabase: {bucket}/{supabase_path}")


def upload_image_to_supabase(image_np, supabase_path):
    bucket = "projectresults"
    success, img_encoded = cv2.imencode('.jpg', image_np)
    if not success:
        raise Exception("Failed to encode image to JPEG")
    img_bytes = img_encoded.tobytes()
    supabase.storage.from_(bucket).upload(
        supabase_path,
        img_bytes,
        {"content-type": "image/jpg"}
    )
    logger.info(f"Uploaded image to Supabase: {bucket}/{supabase_path}")


def download_json_from_supabase(supabase_path):
    bucket = "projectresults"
    try:
        # First check if the file exists
        try:
            info = supabase.storage.from_(bucket).get_public_url(supabase_path)
            if not info:
                logger.warning(f"File not found in Supabase at {bucket}/{supabase_path}")
                return None
        except Exception as e:
            logger.warning(f"Error checking file existence in Supabase at {bucket}/{supabase_path}: {e}")
            return None

        res = supabase.storage.from_(bucket).download(supabase_path)
        if res is None:
            logger.warning(f"File download returned None from Supabase at {bucket}/{supabase_path}")
            return None
        
        try:
            return json.loads(res.decode('utf-8'))
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from Supabase at {bucket}/{supabase_path}: {e}")
            return None
    except Exception as e:
        logger.error(f"Failed to download JSON from Supabase at {bucket}/{supabase_path}: {e}")
        return None


def download_image_from_supabase(supabase_path):
    bucket = "projectresults"
    try:
        # First check if the file exists
        try:
            info = supabase.storage.from_(bucket).get_public_url(supabase_path)
            if not info:
                logger.warning(f"Image not found in Supabase at {bucket}/{supabase_path}")
                return None
        except Exception as e:
            logger.warning(f"Error checking image existence in Supabase at {bucket}/{supabase_path}: {e}")
            return None

        res = supabase.storage.from_(bucket).download(supabase_path)
        if res is None:
            logger.warning(f"Image download returned None from Supabase at {bucket}/{supabase_path}")
            return None
        
        try:
            file_bytes = np.frombuffer(res, np.uint8)
            img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            if img is None:
                logger.error(f"Failed to decode image from Supabase at {bucket}/{supabase_path}")
                return None
            return img
        except Exception as e:
            logger.error(f"Failed to process image data from Supabase at {bucket}/{supabase_path}: {e}")
            return None
    except Exception as e:
        logger.error(f"Failed to download image from Supabase at {bucket}/{supabase_path}: {e}")
        return None


def list_files_in_supabase(prefix=""):
    bucket = "projectresults"
    try:
        files = supabase.storage.from_(bucket).list(prefix)
        return [f['name'] for f in files]
    except Exception as e:
        logger.error(f"Failed to list files in Supabase at {bucket}/{prefix}: {e}")
        return []

def download_image_bytes_from_supabase(supabase_path):
    bucket = "projectresults"
    try:
        # First check if the file exists
        try:
            info = supabase.storage.from_(bucket).get_public_url(supabase_path)
            if not info:
                logger.warning(f"File not found in Supabase at {bucket}/{supabase_path}")
                return None
        except Exception as e:
            logger.warning(f"Error checking file existence in Supabase at {bucket}/{supabase_path}: {e}")
            return None

        res = supabase.storage.from_(bucket).download(supabase_path)
        if res is None:
            logger.warning(f"File download returned None from Supabase at {bucket}/{supabase_path}")
            return None
        return res
    except Exception as e:
        logger.error(f"Failed to download image bytes from Supabase at {bucket}/{supabase_path}: {e}")
        return None

