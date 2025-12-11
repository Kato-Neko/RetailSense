"""
Storage Manager - OOP wrapper for Supabase storage operations.
"""

import os
import json
import cv2
import numpy as np
from typing import Optional, List


class StorageManager:
    """Manages Supabase storage operations."""
    
    def __init__(self, supabase_client, logger):
        """Initialize the storage manager.
        
        Args:
            supabase_client: The Supabase client instance
            logger: The logger instance
        """
        self.supabase = supabase_client
        self.logger = logger
        self.bucket = "projectresults"
        self.logger.info("DEBUG: StorageManager.__init__ called")
        self.logger.info(f"DEBUG: StorageManager initialized with bucket='{self.bucket}', supabase_client={type(supabase_client).__name__}")
    
    def upload_and_remove_local(self, local_path: str, supabase_path: str, content_type: str) -> None:
        """Upload a local file to Supabase storage and remove the local file.
        
        Args:
            local_path: Path to the local file
            supabase_path: Path in Supabase storage
            content_type: MIME type of the file
        """
        try:
            with open(local_path, "rb") as f:
                self.logger.info(f"Uploading to Supabase storage: bucket={self.bucket} path={supabase_path}")
                self.supabase.storage.from_(self.bucket).upload(
                    supabase_path,
                    f,
                    {"content-type": content_type, "x-upsert": "true"}
                )
            os.remove(local_path)
            self.logger.info(f"Uploaded and removed local: {local_path} -> {self.bucket}/{supabase_path}")
        except Exception as e:
            self.logger.error(f"Failed to upload {local_path} to Supabase: {e}")
            raise
    
    def upload_json(self, data: dict, supabase_path: str) -> None:
        """Upload JSON data to Supabase storage.
        
        Args:
            data: Dictionary to serialize as JSON
            supabase_path: Path in Supabase storage
        """
        self.logger.info(f"DEBUG: upload_json called with supabase_path='{supabase_path}', bucket='{self.bucket}'")
        self.logger.info(f"DEBUG: Data keys: {list(data.keys()) if isinstance(data, dict) else 'N/A'}, data type: {type(data).__name__}")
        try:
            json_bytes = json.dumps(data).encode("utf-8")
            self.logger.info(f"DEBUG: Serialized JSON to {len(json_bytes)} bytes")
            resp = self.supabase.storage.from_(self.bucket).upload(
                supabase_path,
                json_bytes,
                {"content-type": "application/json", "x-upsert": "true"}
            )
            self.logger.info(f"DEBUG: Supabase upload_json response: {resp}")
            self.logger.info(f"DEBUG: Successfully uploaded JSON to Supabase: {self.bucket}/{supabase_path}")
        except Exception as e:
            # Log as much detail as possible from StorageApiError/httpx
            self.logger.error(f"DEBUG: Failed to upload JSON to Supabase: {type(e).__name__}: {e}")
            try:
                if hasattr(e, "args") and e.args:
                    self.logger.error(f"DEBUG: Exception args: {e.args}")
                if hasattr(e, "response"):
                    self.logger.error(f"DEBUG: Exception response: {getattr(e, 'response', None)}")
                if hasattr(e, "message"):
                    self.logger.error(f"DEBUG: Exception message: {getattr(e, 'message', None)}")
            except Exception:
                pass
            import traceback
            self.logger.error(f"DEBUG: Traceback:\n{traceback.format_exc()}")
            raise
    
    def upload_image(self, image_np: np.ndarray, supabase_path: str) -> None:
        """Upload an image (numpy array) to Supabase storage.
        
        Args:
            image_np: Image as numpy array
            supabase_path: Path in Supabase storage
        """
        success, img_encoded = cv2.imencode('.jpg', image_np)
        if not success:
            raise Exception("Failed to encode image to JPEG")
        img_bytes = img_encoded.tobytes()
        self.logger.info(f"Uploading image to Supabase storage: bucket={self.bucket} path={supabase_path}")
        self.supabase.storage.from_(self.bucket).upload(
            supabase_path,
            img_bytes,
            {"content-type": "image/jpg", "x-upsert": "true"}
        )
        self.logger.info(f"Uploaded image to Supabase: {self.bucket}/{supabase_path}")
    
    def download_json(self, supabase_path: str) -> Optional[dict]:
        """Download JSON data from Supabase storage.
        
        Args:
            supabase_path: Path in Supabase storage
            
        Returns:
            Dictionary with JSON data or None if failed/not found
        """
        self.logger.info(f"DEBUG: download_json called with supabase_path='{supabase_path}', bucket='{self.bucket}'")
        self.logger.info(f"DEBUG: Full path will be: {self.bucket}/{supabase_path}")
        try:
            # Try to download directly - get_public_url is unreliable for existence checks
            self.logger.info(f"DEBUG: Attempting to download file from {self.bucket}/{supabase_path}")
            res = None
            download_success = False
            
            try:
                res = self.supabase.storage.from_(self.bucket).download(supabase_path)
                self.logger.info(f"DEBUG: download() returned: {type(res)} (None={res is None})")
                if res is not None and len(res) > 0:
                    download_success = True
            except Exception as download_error:
                # Check if it's a 404/not found error
                error_str = str(download_error)
                error_type = type(download_error).__name__
                
                # Try to extract error information from various possible formats
                error_dict = None
                try:
                    # Supabase errors might have message attribute
                    if hasattr(download_error, 'message'):
                        error_dict = download_error.message
                    # Or args might contain dict
                    elif hasattr(download_error, 'args') and download_error.args:
                        error_dict = download_error.args[0] if isinstance(download_error.args[0], dict) else None
                    # Or it might be a dict-like object
                    elif isinstance(download_error, dict):
                        error_dict = download_error
                except Exception:
                    pass
                
                # Check for 404/not found
                is_404 = False
                if error_dict and isinstance(error_dict, dict):
                    status_code = error_dict.get('statusCode') or error_dict.get('status_code') or error_dict.get('code')
                    error_msg = str(error_dict.get('message', '') or error_dict.get('error', ''))
                    if status_code == 404 or 'not found' in error_msg.lower() or 'not_found' in error_msg.lower():
                        is_404 = True
                elif '404' in error_str or 'not found' in error_str.lower() or 'not_found' in error_str.lower():
                    is_404 = True
                
                if is_404:
                    self.logger.warning(f"DEBUG: File not found (404) via download() method, trying HTTP fallback for {self.bucket}/{supabase_path}")
                    # Try HTTP fallback using requests or httpx
                    try:
                        from ..core.config_manager import get_config_manager
                        config = get_config_manager()
                        supabase_url = config.supabase_url
                        supabase_key = config.supabase_key
                        
                        # Construct the storage API URL
                        storage_url = f"{supabase_url}/storage/v1/object/{self.bucket}/{supabase_path}"
                        self.logger.info(f"DEBUG: Trying HTTP fallback: {storage_url}")
                        
                        headers = {
                            "apikey": supabase_key,
                            "Authorization": f"Bearer {supabase_key}"
                        }
                        
                        # Try httpx first (used by supabase client), then requests
                        http_response = None
                        try:
                            import httpx
                            http_response = httpx.get(storage_url, headers=headers, timeout=30.0)
                        except ImportError:
                            try:
                                import requests
                                http_response = requests.get(storage_url, headers=headers, timeout=30.0)
                            except ImportError:
                                self.logger.warning(f"DEBUG: Neither httpx nor requests available for HTTP fallback")
                        
                        if http_response and http_response.status_code == 200:
                            res = http_response.content
                            download_success = True
                            self.logger.info(f"DEBUG: HTTP fallback successful, received {len(res)} bytes")
                        elif http_response:
                            self.logger.warning(f"DEBUG: HTTP fallback failed with status {http_response.status_code}: {http_response.text[:200] if hasattr(http_response, 'text') else str(http_response.content[:200])}")
                    except Exception as http_error:
                        self.logger.warning(f"DEBUG: HTTP fallback also failed: {type(http_error).__name__}: {http_error}")
                
                if not download_success:
                    # Log non-404 errors with full details
                    self.logger.error(f"DEBUG: Download error (not 404) for {self.bucket}/{supabase_path}: {error_type}: {error_str}")
                    if error_dict:
                        self.logger.error(f"DEBUG: Error dict: {error_dict}")
                    import traceback
                    self.logger.error(f"DEBUG: Traceback:\n{traceback.format_exc()}")
                    return None
            
            if not download_success or res is None or len(res) == 0:
                self.logger.warning(f"DEBUG: File download returned None or empty from Supabase at {self.bucket}/{supabase_path}")
                return None
            
            self.logger.info(f"DEBUG: Download successful, received {len(res)} bytes")
            try:
                decoded = res.decode('utf-8')
                self.logger.info(f"DEBUG: Decoded JSON string length: {len(decoded)} characters")
                parsed = json.loads(decoded)
                self.logger.info(f"DEBUG: JSON parsed successfully, type: {type(parsed)}, keys: {list(parsed.keys()) if isinstance(parsed, dict) else 'N/A'}")
                if isinstance(parsed, dict):
                    for key, value in parsed.items():
                        if isinstance(value, list):
                            self.logger.info(f"DEBUG: Key '{key}' contains list with {len(value)} items")
                        elif isinstance(value, (int, float)):
                            self.logger.info(f"DEBUG: Key '{key}' = {value}")
                        else:
                            self.logger.info(f"DEBUG: Key '{key}' = {type(value).__name__}")
                return parsed
            except json.JSONDecodeError as e:
                self.logger.error(f"DEBUG: Failed to parse JSON from Supabase at {self.bucket}/{supabase_path}: {e}")
                self.logger.error(f"DEBUG: JSON decode error at line {e.lineno}, column {e.colno}: {e.msg}")
                self.logger.error(f"DEBUG: First 500 chars of response: {decoded[:500] if 'decoded' in locals() else 'N/A'}")
                return None
        except Exception as e:
            # Catch any other exceptions that weren't caught in inner try block
            error_str = str(e)
            error_type = type(e).__name__
            self.logger.error(f"DEBUG: Unexpected exception in download_json for {self.bucket}/{supabase_path}: {error_type}: {error_str}")
            import traceback
            self.logger.error(f"DEBUG: Full traceback:\n{traceback.format_exc()}")
            return None
    
    def download_image(self, supabase_path: str) -> Optional[np.ndarray]:
        """Download an image from Supabase storage.
        
        Args:
            supabase_path: Path in Supabase storage
            
        Returns:
            Image as numpy array or None if failed
        """
        self.logger.info(f"DEBUG: download_image called with supabase_path='{supabase_path}', bucket='{self.bucket}'")
        self.logger.info(f"DEBUG: Full path will be: {self.bucket}/{supabase_path}")
        
        try:
            # Try to download directly
            self.logger.info(f"DEBUG: Attempting to download image from {self.bucket}/{supabase_path}")
            res = None
            download_success = False
            
            try:
                res = self.supabase.storage.from_(self.bucket).download(supabase_path)
                self.logger.info(f"DEBUG: download() returned: {type(res)} (None={res is None})")
                if res is not None and len(res) > 0:
                    download_success = True
            except Exception as download_error:
                # Check if it's a 404/not found error
                error_str = str(download_error)
                error_type = type(download_error).__name__
                
                # Try to extract error information
                error_dict = None
                try:
                    if hasattr(download_error, 'message'):
                        error_dict = download_error.message
                    elif hasattr(download_error, 'args') and download_error.args:
                        error_dict = download_error.args[0] if isinstance(download_error.args[0], dict) else None
                    elif isinstance(download_error, dict):
                        error_dict = download_error
                except Exception:
                    pass
                
                # Check for 404/not found
                is_404 = False
                if error_dict and isinstance(error_dict, dict):
                    status_code = error_dict.get('statusCode') or error_dict.get('status_code') or error_dict.get('code')
                    error_msg = str(error_dict.get('message', '') or error_dict.get('error', ''))
                    if status_code == 404 or 'not found' in error_msg.lower() or 'not_found' in error_msg.lower():
                        is_404 = True
                elif '404' in error_str or 'not found' in error_str.lower() or 'not_found' in error_str.lower():
                    is_404 = True
                
                if is_404:
                    self.logger.warning(f"DEBUG: Image not found (404) via download() method, trying HTTP fallback for {self.bucket}/{supabase_path}")
                    # Try HTTP fallback
                    try:
                        from ..core.config_manager import get_config_manager
                        config = get_config_manager()
                        supabase_url = config.supabase_url
                        supabase_key = config.supabase_key
                        
                        # Construct the storage API URL
                        storage_url = f"{supabase_url}/storage/v1/object/{self.bucket}/{supabase_path}"
                        self.logger.info(f"DEBUG: Trying HTTP fallback for image: {storage_url}")
                        
                        headers = {
                            "apikey": supabase_key,
                            "Authorization": f"Bearer {supabase_key}"
                        }
                        
                        # Try httpx first (used by supabase client), then requests
                        http_response = None
                        try:
                            import httpx
                            http_response = httpx.get(storage_url, headers=headers, timeout=30.0)
                        except ImportError:
                            try:
                                import requests
                                http_response = requests.get(storage_url, headers=headers, timeout=30.0)
                            except ImportError:
                                self.logger.warning(f"DEBUG: Neither httpx nor requests available for HTTP fallback")
                        
                        if http_response and http_response.status_code == 200:
                            res = http_response.content
                            download_success = True
                            self.logger.info(f"DEBUG: HTTP fallback successful for image, received {len(res)} bytes")
                        elif http_response:
                            self.logger.warning(f"DEBUG: HTTP fallback failed with status {http_response.status_code}: {http_response.text[:200] if hasattr(http_response, 'text') else str(http_response.content[:200])}")
                    except Exception as http_error:
                        self.logger.warning(f"DEBUG: HTTP fallback also failed: {type(http_error).__name__}: {http_error}")
                
                if not download_success:
                    self.logger.error(f"DEBUG: Download error (not 404) for {self.bucket}/{supabase_path}: {error_type}: {error_str}")
                    if error_dict:
                        self.logger.error(f"DEBUG: Error dict: {error_dict}")
                    import traceback
                    self.logger.error(f"DEBUG: Traceback:\n{traceback.format_exc()}")
                    return None
            
            if not download_success or res is None or len(res) == 0:
                self.logger.warning(f"DEBUG: Image download returned None or empty from Supabase at {self.bucket}/{supabase_path}")
                return None
            
            self.logger.info(f"DEBUG: Image download successful, received {len(res)} bytes")
            try:
                file_bytes = np.frombuffer(res, np.uint8)
                img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
                if img is None:
                    self.logger.error(f"DEBUG: Failed to decode image from Supabase at {self.bucket}/{supabase_path}")
                    return None
                self.logger.info(f"DEBUG: Image decoded successfully, shape: {img.shape}")
                return img
            except Exception as e:
                self.logger.error(f"DEBUG: Failed to process image data from Supabase at {self.bucket}/{supabase_path}: {e}")
                import traceback
                self.logger.error(f"DEBUG: Traceback:\n{traceback.format_exc()}")
                return None
        except Exception as e:
            self.logger.error(f"DEBUG: Unexpected exception in download_image for {self.bucket}/{supabase_path}: {type(e).__name__}: {e}")
            import traceback
            self.logger.error(f"DEBUG: Full traceback:\n{traceback.format_exc()}")
            return None
    
    def check_file_exists(self, supabase_path: str) -> bool:
        """Check if a file exists in Supabase storage.
        
        Args:
            supabase_path: Path in Supabase storage
            
        Returns:
            True if file exists, False otherwise
        """
        self.logger.info(f"DEBUG: check_file_exists called with supabase_path='{supabase_path}', bucket='{self.bucket}'")
        try:
            self.logger.info(f"DEBUG: Checking if file exists in Supabase: {self.bucket}/{supabase_path}")
            # Try to get the file's metadata - this is faster than listing
            info = self.supabase.storage.from_(self.bucket).get_public_url(supabase_path)
            self.logger.info(f"DEBUG: get_public_url returned: {info} (type: {type(info).__name__}, truthy: {bool(info)})")
            if info:
                self.logger.info(f"DEBUG: File exists in Supabase: {self.bucket}/{supabase_path}")
                return True
            self.logger.info(f"DEBUG: File does not exist in Supabase: {self.bucket}/{supabase_path}")
            return False
        except Exception as e:
            self.logger.error(f"DEBUG: Error checking file existence in Supabase: {type(e).__name__}: {e}")
            import traceback
            self.logger.error(f"DEBUG: Traceback:\n{traceback.format_exc()}")
            return False
    
    def list_files(self, prefix: str = "") -> List[str]:
        """List files in Supabase storage.
        
        Args:
            prefix: Optional prefix to filter files (folder path)
            
        Returns:
            List of file names (full paths)
        """
        self.logger.info(f"DEBUG: list_files called with prefix='{prefix}', bucket='{self.bucket}'")
        try:
            self.logger.info(f"DEBUG: Listing files in Supabase bucket {self.bucket} with prefix: {prefix}")
            
            # Supabase list() with a prefix returns files in that folder
            # If prefix is a folder (like job_id), it returns files in that folder
            # The 'name' field might be just the filename or the full path
            files = self.supabase.storage.from_(self.bucket).list(prefix)
            self.logger.info(f"DEBUG: list() returned: {type(files).__name__}, length: {len(files) if hasattr(files, '__len__') else 'N/A'}")
            
            file_names = []
            if files:
                for item in files:
                    # Handle both dict-like and object-like responses
                    if isinstance(item, dict):
                        name = item.get('name', '')
                        # Check if it's metadata (file) or id (folder)
                        # Files have 'metadata', folders might not
                        is_file = 'metadata' in item or 'id' in item
                    else:
                        name = getattr(item, 'name', '')
                        is_file = hasattr(item, 'metadata') or hasattr(item, 'id')
                    
                    if name:
                        # If prefix was provided and name doesn't start with it, construct full path
                        if prefix and not name.startswith(prefix):
                            # Name is likely just the filename, need to prepend prefix
                            if '/' not in name:  # It's just a filename
                                full_path = f"{prefix}/{name}" if prefix else name
                            else:
                                # Name already has path, use as-is
                                full_path = name
                        elif prefix and name.startswith(prefix):
                            # Name already includes prefix
                            full_path = name
                        else:
                            # No prefix or name is already full path
                            full_path = name
                        
                        # Only include files, not folders
                        if is_file:
                            file_names.append(full_path)
                            self.logger.info(f"DEBUG: Found file: '{full_path}'")
            
            self.logger.info(f"DEBUG: Found {len(file_names)} files: {file_names[:10]}{'...' if len(file_names) > 10 else ''}")
            return file_names
        except Exception as e:
            self.logger.error(f"DEBUG: Failed to list files in Supabase at {self.bucket}/{prefix}: {type(e).__name__}: {e}")
            import traceback
            self.logger.error(f"DEBUG: Traceback:\n{traceback.format_exc()}")
            return []
    
    def download_image_bytes(self, supabase_path: str) -> Optional[bytes]:
        """Download image as raw bytes from Supabase storage.
        
        Args:
            supabase_path: Path in Supabase storage
            
        Returns:
            Image bytes or None if failed
        """
        self.logger.info(f"DEBUG: download_image_bytes called with supabase_path='{supabase_path}', bucket='{self.bucket}'")
        try:
            res = None
            download_success = False
            
            try:
                res = self.supabase.storage.from_(self.bucket).download(supabase_path)
                self.logger.info(f"DEBUG: download() returned: {type(res)} (None={res is None})")
                if res is not None and len(res) > 0:
                    download_success = True
            except Exception as download_error:
                error_str = str(download_error)
                error_type = type(download_error).__name__
                
                # Extract error info
                error_dict = None
                try:
                    if hasattr(download_error, 'message'):
                        error_dict = download_error.message
                    elif hasattr(download_error, 'args') and download_error.args:
                        error_dict = download_error.args[0] if isinstance(download_error.args[0], dict) else None
                except Exception:
                    pass
                
                # Check for 404
                is_404 = False
                if error_dict and isinstance(error_dict, dict):
                    status_code = error_dict.get('statusCode') or error_dict.get('status_code') or error_dict.get('code')
                    error_msg = str(error_dict.get('message', '') or error_dict.get('error', ''))
                    if status_code == 404 or 'not found' in error_msg.lower() or 'not_found' in error_msg.lower():
                        is_404 = True
                elif '404' in error_str or 'not found' in error_str.lower() or 'not_found' in error_str.lower():
                    is_404 = True
                
                if is_404:
                    self.logger.warning(f"DEBUG: Image bytes not found (404) via download(), trying HTTP fallback for {self.bucket}/{supabase_path}")
                    # Try HTTP fallback
                    try:
                        from ..core.config_manager import get_config_manager
                        config = get_config_manager()
                        supabase_url = config.supabase_url
                        supabase_key = config.supabase_key
                        
                        storage_url = f"{supabase_url}/storage/v1/object/{self.bucket}/{supabase_path}"
                        self.logger.info(f"DEBUG: Trying HTTP fallback for image bytes: {storage_url}")
                        
                        headers = {
                            "apikey": supabase_key,
                            "Authorization": f"Bearer {supabase_key}"
                        }
                        
                        http_response = None
                        try:
                            import httpx
                            http_response = httpx.get(storage_url, headers=headers, timeout=30.0)
                        except ImportError:
                            try:
                                import requests
                                http_response = requests.get(storage_url, headers=headers, timeout=30.0)
                            except ImportError:
                                self.logger.warning(f"DEBUG: Neither httpx nor requests available for HTTP fallback")
                        
                        if http_response and http_response.status_code == 200:
                            res = http_response.content
                            download_success = True
                            self.logger.info(f"DEBUG: HTTP fallback successful for image bytes, received {len(res)} bytes")
                        elif http_response:
                            self.logger.warning(f"DEBUG: HTTP fallback failed with status {http_response.status_code}")
                    except Exception as http_error:
                        self.logger.warning(f"DEBUG: HTTP fallback also failed: {type(http_error).__name__}: {http_error}")
                
                if not download_success:
                    self.logger.error(f"DEBUG: Download error for image bytes: {error_type}: {error_str}")
                    return None
            
            if not download_success or res is None or len(res) == 0:
                self.logger.warning(f"DEBUG: Image bytes download returned None or empty from Supabase at {self.bucket}/{supabase_path}")
                return None
            
            self.logger.info(f"DEBUG: Image bytes download successful, received {len(res)} bytes")
            return res
        except Exception as e:
            self.logger.error(f"DEBUG: Failed to download image bytes from Supabase at {self.bucket}/{supabase_path}: {type(e).__name__}: {e}")
            import traceback
            self.logger.error(f"DEBUG: Traceback:\n{traceback.format_exc()}")
            return None

def get_signed_url(supabase_path: str, expires_in: int = 3600) -> Optional[str]:
    """Generate a signed URL for a file in Supabase storage.

    Args:
        supabase_path: Path in Supabase storage (e.g., 'job_id/filename.jpg')
        expires_in: Expiration time in seconds for the signed URL

    Returns:
        Signed URL string or None if generation failed
    """
    manager = get_storage_manager()
    manager.logger.info(f"DEBUG: get_signed_url called for {supabase_path}, expires_in={expires_in}")
    try:
        # supabase-py create_signed_url usually returns a dict with 'signedURL'
        result = manager.supabase.storage.from_(manager.bucket).create_signed_url(supabase_path, expires_in)
        manager.logger.info(f"DEBUG: create_signed_url result: {result}")
        if isinstance(result, dict):
            # common keys
            return result.get('signedURL') or result.get('signed_url') or result.get('signedUrl')
        # If client returns a tuple or string, try to handle
        if isinstance(result, (list, tuple)) and len(result) > 0:
            return result[0]
        if isinstance(result, str):
            return result
    except Exception as e:
        manager.logger.error(f"DEBUG: Failed to generate signed URL for {supabase_path}: {e}")
        import traceback
        manager.logger.error(f"DEBUG: Traceback:\n{traceback.format_exc()}")
    return None

# Global instance
_storage_manager = None


def get_storage_manager() -> StorageManager:
    """Get the global storage manager instance."""
    global _storage_manager
    if _storage_manager is None:
        from .config_manager import get_config_manager
        from supabase import create_client

        config = get_config_manager()
        config.logger.info("DEBUG: Creating new StorageManager instance (dedicated service client)")

        # Always use a fresh service-role client for storage to avoid auth session
        # mutations (e.g., login flows) downgrading the token and tripping RLS.
        service_supabase = create_client(config.supabase_url, config.supabase_key)

        _storage_manager = StorageManager(service_supabase, config.logger)
        config.logger.info("DEBUG: StorageManager instance created successfully")
    else:
        _storage_manager.logger.info("DEBUG: Returning existing StorageManager instance")
    return _storage_manager


# Legacy exports for backward compatibility
def upload_to_supabase_and_remove_local(local_path, supabase_path, content_type):
    """Legacy function for backward compatibility."""
    manager = get_storage_manager()
    return manager.upload_and_remove_local(local_path, supabase_path, content_type)


def upload_json_to_supabase(data, supabase_path):
    """Legacy function for backward compatibility."""
    manager = get_storage_manager()
    return manager.upload_json(data, supabase_path)


def upload_image_to_supabase(image_np, supabase_path):
    """Legacy function for backward compatibility."""
    manager = get_storage_manager()
    return manager.upload_image(image_np, supabase_path)


def download_json_from_supabase(supabase_path):
    """Legacy function for backward compatibility."""
    manager = get_storage_manager()
    manager.logger.info(f"DEBUG: download_json_from_supabase called with path='{supabase_path}'")
    result = manager.download_json(supabase_path)
    manager.logger.info(f"DEBUG: download_json_from_supabase returning: {type(result).__name__} (None={result is None})")
    return result


def download_image_from_supabase(supabase_path):
    """Legacy function for backward compatibility."""
    manager = get_storage_manager()
    return manager.download_image(supabase_path)


def check_file_exists_in_supabase(supabase_path):
    """Legacy function for backward compatibility."""
    manager = get_storage_manager()
    return manager.check_file_exists(supabase_path)


def list_files_in_supabase(prefix=""):
    """Legacy function for backward compatibility."""
    manager = get_storage_manager()
    return manager.list_files(prefix)


def download_image_bytes_from_supabase(supabase_path):
    """Legacy function for backward compatibility."""
    manager = get_storage_manager()
    return manager.download_image_bytes(supabase_path)

