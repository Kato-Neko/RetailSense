#!/usr/bin/env python3
"""
Run script for the RetailSense backend Flask application.
This script properly sets up the Python path and runs the app as a module.
"""

import sys
import os
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Import and run the app
from main.app import app

if __name__ == '__main__':
    # Set environment variables if not already set
    if not os.getenv('FLASK_SECRET_KEY'):
        os.environ['FLASK_SECRET_KEY'] = 'supersecretkey'
    if not os.getenv('JWT_SECRET_KEY'):
        os.environ['JWT_SECRET_KEY'] = 'superjwtsecretkey'
    
    # Run the Flask app
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    port = int(os.getenv('PORT', 5000))
    
    print(f"Starting RetailSense backend on port {port}")
    print(f"Debug mode: {debug_mode}")
    
    app.run(host='0.0.0.0', port=port, debug=debug_mode)

