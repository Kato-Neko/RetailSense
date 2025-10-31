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
        json_bytes = json.dumps(data).encode("utf-8")
        self.logger.info(f"Uploading JSON to Supabase storage: bucket={self.bucket} path={supabase_path}")
        self.supabase.storage.from_(self.bucket).upload(
            supabase_path,
            json_bytes,
            {"content-type": "application/json", "x-upsert": "true"}
        )
        self.logger.info(f"Uploaded JSON to Supabase: {self.bucket}/{supabase_path}")
    
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
            Dictionary with JSON data or None if failed
        """
        try:
            # First check if the file exists
            try:
                info = self.supabase.storage.from_(self.bucket).get_public_url(supabase_path)
                if not info:
                    self.logger.warning(f"File not found in Supabase at {self.bucket}/{supabase_path}")
                    return None
            except Exception as e:
                self.logger.warning(f"Error checking file existence in Supabase at {self.bucket}/{supabase_path}: {e}")
                return None

            res = self.supabase.storage.from_(self.bucket).download(supabase_path)
            if res is None:
                self.logger.warning(f"File download returned None from Supabase at {self.bucket}/{supabase_path}")
                return None
            
            try:
                return json.loads(res.decode('utf-8'))
            except json.JSONDecodeError as e:
                self.logger.error(f"Failed to parse JSON from Supabase at {self.bucket}/{supabase_path}: {e}")
                return None
        except Exception as e:
            self.logger.error(f"Failed to download JSON from Supabase at {self.bucket}/{supabase_path}: {e}")
            return None
    
    def download_image(self, supabase_path: str) -> Optional[np.ndarray]:
        """Download an image from Supabase storage.
        
        Args:
            supabase_path: Path in Supabase storage
            
        Returns:
            Image as numpy array or None if failed
        """
        try:
            # First check if the file exists
            try:
                info = self.supabase.storage.from_(self.bucket).get_public_url(supabase_path)
                if not info:
                    self.logger.warning(f"Image not found in Supabase at {self.bucket}/{supabase_path}")
                    return None
            except Exception as e:
                self.logger.warning(f"Error checking image existence in Supabase at {self.bucket}/{supabase_path}: {e}")
                return None

            res = self.supabase.storage.from_(self.bucket).download(supabase_path)
            if res is None:
                self.logger.warning(f"Image download returned None from Supabase at {self.bucket}/{supabase_path}")
                return None
            
            try:
                file_bytes = np.frombuffer(res, np.uint8)
                img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
                if img is None:
                    self.logger.error(f"Failed to decode image from Supabase at {self.bucket}/{supabase_path}")
                    return None
                return img
            except Exception as e:
                self.logger.error(f"Failed to process image data from Supabase at {self.bucket}/{supabase_path}: {e}")
                return None
        except Exception as e:
            self.logger.error(f"Failed to download image from Supabase at {self.bucket}/{supabase_path}: {e}")
            return None
    
    def check_file_exists(self, supabase_path: str) -> bool:
        """Check if a file exists in Supabase storage.
        
        Args:
            supabase_path: Path in Supabase storage
            
        Returns:
            True if file exists, False otherwise
        """
        try:
            self.logger.info(f"Checking if file exists in Supabase: {self.bucket}/{supabase_path}")
            # Try to get the file's metadata - this is faster than listing
            info = self.supabase.storage.from_(self.bucket).get_public_url(supabase_path)
            if info:
                self.logger.info(f"File exists in Supabase: {self.bucket}/{supabase_path}")
                return True
            return False
        except Exception as e:
            self.logger.error(f"Error checking file existence in Supabase: {e}")
            return False
    
    def list_files(self, prefix: str = "") -> List[str]:
        """List files in Supabase storage.
        
        Args:
            prefix: Optional prefix to filter files
            
        Returns:
            List of file names
        """
        try:
            self.logger.info(f"Listing files in Supabase bucket {self.bucket} with prefix: {prefix}")
            files = self.supabase.storage.from_(self.bucket).list(prefix)
            file_names = [f['name'] for f in files]
            self.logger.info(f"Found {len(file_names)} files: {file_names}")
            return file_names
        except Exception as e:
            self.logger.error(f"Failed to list files in Supabase at {self.bucket}/{prefix}: {e}")
            return []
    
    def download_image_bytes(self, supabase_path: str) -> Optional[bytes]:
        """Download image as raw bytes from Supabase storage.
        
        Args:
            supabase_path: Path in Supabase storage
            
        Returns:
            Image bytes or None if failed
        """
        try:
            # First check if the file exists
            try:
                info = self.supabase.storage.from_(self.bucket).get_public_url(supabase_path)
                if not info:
                    self.logger.warning(f"File not found in Supabase at {self.bucket}/{supabase_path}")
                    return None
            except Exception as e:
                self.logger.warning(f"Error checking file existence in Supabase at {self.bucket}/{supabase_path}: {e}")
                return None

            res = self.supabase.storage.from_(self.bucket).download(supabase_path)
            if res is None:
                self.logger.warning(f"File download returned None from Supabase at {self.bucket}/{supabase_path}")
                return None
            return res
        except Exception as e:
            self.logger.error(f"Failed to download image bytes from Supabase at {self.bucket}/{supabase_path}: {e}")
            return None


# Global instance
_storage_manager = None


def get_storage_manager() -> StorageManager:
    """Get the global storage manager instance."""
    global _storage_manager
    if _storage_manager is None:
        from .config_manager import get_config_manager
        config = get_config_manager()
        _storage_manager = StorageManager(config.supabase, config.logger)
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
    return manager.download_json(supabase_path)


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

