"""
Configuration Manager - OOP wrapper for configuration.
"""

import os
import logging
from dotenv import load_dotenv
from supabase import create_client, Client
import pytz
from dateutil import parser
from pathlib import Path


class ConfigManager:
    """Manages application configuration and Supabase client."""
    
    def __init__(self):
        """Initialize the configuration manager."""
        load_dotenv()
        
        # Configure logging
        self.log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
        logging.basicConfig(level=getattr(logging, self.log_level, logging.INFO))
        self.logger = logging.getLogger(__name__)
        
        # Debug: Print all environment variables
        self._print_debug_info()
        
        # Supabase configuration
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
        
        # Validate required environment variables
        self._validate_config()
        
        # Create Supabase client
        self.supabase = self._create_supabase_client()
        
        # Folders and allowed extensions
        self.upload_folder = self._get_upload_folder()
        self.results_folder = self._get_results_folder()
        self.allowed_extensions_video = {'mp4', 'avi', 'mov'}
        self.allowed_extensions_image = {'png', 'jpg', 'jpeg'}
        
        # Create directories
        os.makedirs(self.upload_folder, exist_ok=True)
        os.makedirs(self.results_folder, exist_ok=True)
        
        # Timezone
        self.manila = pytz.timezone('Asia/Manila')
    
    def _print_debug_info(self):
        """Print debug information about environment variables."""
        print("=== ENVIRONMENT VARIABLES DEBUG ===")
        all_env_vars = dict(os.environ)
        supabase_vars = {k: v for k, v in all_env_vars.items() if 'SUPABASE' in k}
        print(f"Found {len(supabase_vars)} Supabase variables:")
        for key, value in supabase_vars.items():
            if 'KEY' in key:
                print(f"{key}: {'***' if value else 'None'}")
            else:
                print(f"{key}: {value}")
    
    def _validate_config(self):
        """Validate required configuration."""
        if not self.supabase_url:
            self.logger.error("SUPABASE_URL environment variable is missing or empty")
            raise ValueError("SUPABASE_URL environment variable is required")
        
        if not self.supabase_key:
            self.logger.error("SUPABASE_KEY or SUPABASE_SERVICE_KEY environment variable is missing or empty")
            raise ValueError("SUPABASE_KEY or SUPABASE_SERVICE_KEY environment variable is required")
    
    def _create_supabase_client(self) -> Client:
        """Create and return Supabase client."""
        self.logger.info("Creating Supabase client...")
        supabase_client = create_client(self.supabase_url, self.supabase_key)
        self.logger.info("Supabase client created successfully")
        
        print(f"SUPABASE_URL: {self.supabase_url}")
        print(f"SUPABASE_KEY: {'***' if self.supabase_key else 'None'}")
        print(f"Using service key: {bool(os.getenv('SUPABASE_SERVICE_KEY'))}")
        
        return supabase_client
    
    def _get_upload_folder(self) -> str:
        """Get absolute path to upload folder."""
        return os.path.abspath(
            os.path.join(os.path.dirname(__file__), '../../../project_uploads')
        )
    
    def _get_results_folder(self) -> str:
        """Get absolute path to results folder."""
        return os.path.abspath(
            os.path.join(os.path.dirname(__file__), '../../../project_results')
        )
    
    def to_manila_iso(self, dt):
        """Convert a datetime or ISO string to Manila timezone ISO string."""
        if not dt:
            return ''
        if isinstance(dt, str):
            dt = parser.parse(dt)
        if dt.tzinfo is None:
            # Assume naive datetimes are already in Asia/Manila
            dt = self.manila.localize(dt)
        return dt.isoformat()


# Global instance
_config_manager = None


def get_config_manager() -> ConfigManager:
    """Get the global configuration manager instance."""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager


# Legacy exports for backward compatibility
def get_logger():
    """Get the logger from config manager."""
    return get_config_manager().logger


def get_supabase():
    """Get the Supabase client from config manager."""
    return get_config_manager().supabase


# Export constants for backward compatibility
@property
def SUPABASE_URL():
    return get_config_manager().supabase_url


@property
def SUPABASE_KEY():
    return get_config_manager().supabase_key


@property
def UPLOAD_FOLDER():
    return get_config_manager().upload_folder


@property
def RESULTS_FOLDER():
    return get_config_manager().results_folder


@property
def ALLOWED_EXTENSIONS_VIDEO():
    return get_config_manager().allowed_extensions_video


@property
def ALLOWED_EXTENSIONS_IMAGE():
    return get_config_manager().allowed_extensions_image


@property
def logger():
    return get_config_manager().logger


@property
def supabase():
    return get_config_manager().supabase

