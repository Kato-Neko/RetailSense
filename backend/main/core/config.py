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
load_dotenv()

# Configure logging
log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
logging.basicConfig(level=getattr(logging, log_level, logging.INFO))
logger = logging.getLogger(__name__)

# Debug: Print all environment variables
print("=== ENVIRONMENT VARIABLES DEBUG ===")
all_env_vars = dict(os.environ)
supabase_vars = {k: v for k, v in all_env_vars.items() if 'SUPABASE' in k}
print(f"Found {len(supabase_vars)} Supabase variables:")
for key, value in supabase_vars.items():
    if 'KEY' in key:
        print(f"{key}: {'***' if value else 'None'}")
    else:
        print(f"{key}: {value}")

# Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
# Prefer service role key if available, otherwise use regular key
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

print(f"SUPABASE_URL: {SUPABASE_URL}")
print(f"SUPABASE_KEY: {'***' if SUPABASE_KEY else 'None'}")
print(f"Using service key: {bool(os.getenv('SUPABASE_SERVICE_KEY'))}")

# Validate required environment variables
if not SUPABASE_URL:
    logger.error("SUPABASE_URL environment variable is missing or empty")
    raise ValueError("SUPABASE_URL environment variable is required")

if not SUPABASE_KEY:
    logger.error("SUPABASE_KEY or SUPABASE_SERVICE_KEY environment variable is missing or empty")
    raise ValueError("SUPABASE_KEY or SUPABASE_SERVICE_KEY environment variable is required")

# Create supabase client only if variables are present
logger.info("Creating Supabase client...")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
logger.info("Supabase client created successfully")

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