"""
Central configuration for the backend.
Initializes environment variables, logging, Supabase client, and common constants.
"""

from .config_manager import get_config_manager

# Initialize config manager
_config = get_config_manager()

# Export all the configuration for backward compatibility
logger = _config.logger
supabase = _config.supabase
UPLOAD_FOLDER = _config.upload_folder
RESULTS_FOLDER = _config.results_folder
ALLOWED_EXTENSIONS_VIDEO = _config.allowed_extensions_video
ALLOWED_EXTENSIONS_IMAGE = _config.allowed_extensions_image

# Export convenience function
to_manila_iso = _config.to_manila_iso