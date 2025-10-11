"""
Central configuration for the backend.
Initializes environment variables, logging, Supabase client, and common constants.
"""

import os
import logging
from dotenv import load_dotenv
from supabase import create_client, Client
import pytz
from dateutil import parser

# Load environment variables from .env file
# Look for .env file in the main directory
main_dir = os.path.dirname(os.path.dirname(__file__))
env_path = os.path.join(main_dir, '.env')
load_dotenv(env_path)

# Configure logging
log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
logging.basicConfig(level=getattr(logging, log_level, logging.INFO))
logger = logging.getLogger(__name__)

# Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Folders and allowed extensions
UPLOAD_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../project_uploads'))
RESULTS_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../project_results'))
ALLOWED_EXTENSIONS_VIDEO = {'mp4', 'avi', 'mov'}
ALLOWED_EXTENSIONS_IMAGE = {'png', 'jpg', 'jpeg'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

# Timezone utilities
manila = pytz.timezone('Asia/Manila')

def to_manila_iso(dt):
    """Convert a datetime or ISO string to Manila timezone ISO string."""
    if not dt:
        return ''
    if isinstance(dt, str):
        dt = parser.parse(dt)
    if dt.tzinfo is None:
        # Assume naive datetimes are already in Asia/Manila
        dt = manila.localize(dt)
    return dt.isoformat()

