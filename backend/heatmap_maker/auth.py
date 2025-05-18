# auth.py
import datetime
import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from supabase import create_client
import logging
from utils import hash_password  # Assuming hash_password is in utils.py
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize Supabase client
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase = create_client(url, key)

# Create a Blueprint for authentication
auth_bp = Blueprint('auth', __name__)

# Configure logging
logger = logging.getLogger(__name__)

@auth_bp.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    
    # Check for missing fields
    if not all([username, password, email]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        # Check if the username already exists
        existing_user = supabase.table('users').select('username').eq('username', username).execute()
        logger.debug(f"Existing user check: {existing_user.data}")
        if existing_user.data:
            return jsonify({"error": "Username already exists"}), 409

        # Use Supabase to create a new user
        response = supabase.auth.sign_up({
            "email": email,
            "password": password
        })
        
        logger.debug(f"Supabase response: {response}")  
        
        if response.user:  # Access the user attribute directly
            # Store the user info in Supabase, including the UID
            password_hash = hash_password(password)
            supabase.table('users').insert({
                'id': response.user.id,  # Store the UID here
                'username': username,
                'email': email,
                'password_hash': password_hash
            }).execute()

            return jsonify({"success": True, "message": "Registration successful"}), 201
        else:
            logger.error(f"Supabase error: {response.error}")
            return jsonify({"error": response.error}), 400
            
    except Exception as e:
        logger.error(f"Error during registration: {str(e)}")
        return jsonify({"error": f"Error: {str(e)}"}), 500

@auth_bp.route('/api/login', methods=['POST'])
def login_api():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    try:
        # Use Supabase to log in the user
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        logger.debug(f"Supabase login response: {response}")

        if response.user:  # Check if the user exists
            # Set a longer expiration time (e.g., 1 day)
            access_token = create_access_token(identity=response.user.id, expires_delta=datetime.timedelta(days=1))
            logger.debug(f"Access Token: {access_token}")  # Log the token
            return jsonify({"success": True, "message": "Login successful", "access_token": access_token}), 200
        else:
            logger.error(f"Login failed: {response.error}")
            return jsonify({"error": "Invalid credentials"}), 401
    except Exception as e:
        logger.error(f"Error during login: {str(e)}")
        return jsonify({"error": f"Error: {str(e)}"}), 500

@auth_bp.route('/api/logout', methods=['POST'])
def logout_api():
    # With JWT, logout is handled client-side by deleting the token
    return jsonify({"success": True, "message": "Logged out successfully"})

@auth_bp.route('/api/user', methods=['GET'])
@jwt_required()
def get_user_info():
    logger.debug("Accessing /api/user endpoint")
    current_user_uid = get_jwt_identity()  # Get the UID from the token
    logger.debug(f"Current user UID from JWT: {current_user_uid}")
    
    if not current_user_uid:
        return jsonify({"error": "Not logged in"}), 401
    
    # Query the users table using the UID
    try:
        user_data = supabase.table('users').select('username, email, created_at').eq('id', current_user_uid).execute()
        if user_data.data:
            user = user_data.data[0]  # Assuming the user data is returned as a list
            return jsonify({
                "username": user['username'],
                "email": user['email'],
                "created_at": user['created_at']
            })
        return jsonify({"error": "User not found"}), 404
    except Exception as e:
        logger.error(f"Database error: {str(e)}")
        return jsonify({"error": f"Database error: {str(e)}"}), 500