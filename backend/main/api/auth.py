import os
import logging
import random
import string
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from ..core.config import supabase
from ..core.security import hash_password
from ..services.notifications import send_otp_email_gmail
import pytz

auth_bp = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)


@auth_bp.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    if not all([username, password, email]):
        return jsonify({"error": "Missing required fields"}), 400
    try:
        # Check if username already exists
        existing_username = supabase.table('users').select('username').eq('username', username).execute()
        if existing_username.data:
            return jsonify({"error": "Username already exists"}), 409
        
        # Check if email already exists in users table
        existing_email = supabase.table('users').select('email').eq('email', email).execute()
        if existing_email.data:
            return jsonify({"error": "Email already registered"}), 409
        
        # Try to sign up with Supabase Auth
        response = supabase.auth.sign_up({"email": email, "password": password})
        
        # Check if Supabase Auth sign up failed (e.g., email already exists in auth)
        if hasattr(response, 'error') and response.error:
            error_message = str(response.error.message) if hasattr(response.error, 'message') else str(response.error)
            logger.error(f"Supabase Auth error: {error_message}")
            return jsonify({"error": f"Registration failed: {error_message}"}), 400
        
        if response.user:
            password_hash = hash_password(password)
            supabase.table('users').insert({
                'id': response.user.id,
                'username': username,
                'email': email,
                'password_hash': password_hash
            }).execute()
            return jsonify({"success": True, "message": "Registration successful"}), 201
        else:
            return jsonify({"error": "Registration failed"}), 400
    except Exception as e:
        logger.error(f"Error during registration: {str(e)}")
        return jsonify({"error": f"Error: {str(e)}"}), 500


@auth_bp.route('/api/login', methods=['POST'])
def login_api():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    # Debug logging
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key_exists = bool(os.getenv('SUPABASE_KEY'))
    logger.info(f"SUPABASE_URL: {supabase_url}")
    logger.info(f"SUPABASE_KEY exists: {supabase_key_exists}")
    
    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400
    
    # First, check if the email exists in the users table
    email_exists = False
    try:
        user_check = supabase.table('users').select('email').eq('email', email).execute()
        email_exists = bool(user_check.data and len(user_check.data) > 0)
    except Exception as e:
        logger.error(f"Error checking email existence: {str(e)}")
        # If we can't check, we'll assume email might exist and let Supabase auth determine
        
    try:
        # Test if supabase client is working
        logger.info("Attempting Supabase auth...")
        response = supabase.auth.sign_in_with_password({"email": email, "password": password})
        
        # Check if Supabase returned an error in the response
        if hasattr(response, 'error') and response.error:
            error_message = str(response.error).lower()
            logger.info(f"Supabase auth error in response: {error_message}")
            # Authentication failed - determine which credential is wrong
            if not email_exists:
                return jsonify({"error": "Incorrect email"}), 401
            else:
                return jsonify({"error": "Incorrect password"}), 401
        
        # Check if user exists in response
        if response.user:
            access_token = create_access_token(identity=response.user.id, expires_delta=timedelta(days=1))
            return jsonify({"success": True, "message": "Login successful", "access_token": access_token}), 200
        else:
            # If we get here, authentication failed (no user in response)
            if not email_exists:
                return jsonify({"error": "Incorrect email"}), 401
            else:
                return jsonify({"error": "Incorrect password"}), 401
                
    except Exception as e:
        error_str = str(e).lower()
        logger.error(f"Exception during login: {str(e)}")
        logger.error(f"Exception type: {type(e).__name__}")
        
        # Check various error attributes that Supabase might use
        error_message = ""
        if hasattr(e, 'message'):
            error_message = str(e.message).lower()
        elif hasattr(e, 'msg'):
            error_message = str(e.msg).lower()
        elif hasattr(e, 'args') and len(e.args) > 0:
            error_message = str(e.args[0]).lower()
        
        # Check for authentication-related errors
        auth_keywords = ['invalid login', 'invalid credentials', 'email not confirmed', 
                        'wrong password', 'incorrect password', 'authentication', 
                        'unauthorized', 'invalid_grant', 'invalid_request']
        
        is_auth_error = any(keyword in error_message for keyword in auth_keywords) or \
                       any(keyword in error_str for keyword in auth_keywords)
        
        if is_auth_error:
            # Authentication failed - determine which credential is wrong
            if not email_exists:
                return jsonify({"error": "Incorrect email"}), 401
            else:
                return jsonify({"error": "Incorrect password"}), 401
        
        # For any other exception during auth, assume it's an auth failure
        # and determine based on email existence
        logger.error(f"Unexpected error during login, treating as auth failure")
        if not email_exists:
            return jsonify({"error": "Incorrect email"}), 401
        else:
            return jsonify({"error": "Incorrect password"}), 401


@auth_bp.route('/api/logout', methods=['POST'])
def logout_api():
    return jsonify({"success": True, "message": "Logged out successfully"})


@auth_bp.route('/api/user', methods=['GET'])
@jwt_required()
def get_user_info():
    current_user_uid = get_jwt_identity()
    if not current_user_uid:
        return jsonify({"error": "Not logged in"}), 401
    try:
        user_data = supabase.table('users').select('username, email, created_at').eq('id', current_user_uid).execute()
        if user_data.data:
            user = user_data.data[0]
            return jsonify({"username": user['username'], "email": user['email'], "created_at": user['created_at']})
        return jsonify({"error": "User not found"}), 404
    except Exception as e:
        logger.error(f"Database error: {str(e)}")
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@auth_bp.route('/api/user/username', methods=['PUT'])
@jwt_required()
def update_username():
    user_id = get_jwt_identity()
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    data = request.get_json()
    new_username = data.get('username')
    if not new_username:
        return jsonify({"error": "New username is required"}), 400
    try:
        existing = supabase.table('users').select('username').eq('username', new_username).execute()
        if existing.data:
            return jsonify({"error": "Username already exists"}), 400
        update_response = supabase.table('users').update({'username': new_username}).eq('id', user_id).execute()
        if update_response.data:
            return jsonify({"message": "Username updated successfully", "username": new_username})
        else:
            return jsonify({"error": "Failed to update username in Supabase."}), 500
    except Exception as e:
        return jsonify({"error": f"Supabase error: {str(e)}"}), 500


@auth_bp.route('/api/user/password', methods=['PUT'])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    if not current_password or not new_password:
        return jsonify({"error": "Current and new password are required"}), 400
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters long"}), 400
    try:
        user_row = supabase.table('users').select('email').eq('id', user_id).execute()
        if not user_row.data:
            return jsonify({"error": "User not found"}), 404
        email = user_row.data[0]['email']
        login_resp = supabase.auth.sign_in_with_password({"email": email, "password": current_password})
        if not login_resp.user:
            return jsonify({"error": "Current password is incorrect"}), 400
        update_resp = supabase.auth.update_user({"password": new_password})
        if update_resp.user:
            return jsonify({"message": "Password updated successfully"})
        else:
            return jsonify({"error": "Failed to update password in Supabase."}), 500
    except Exception as e:
        return jsonify({"error": f"Supabase error: {str(e)}"}), 500


@auth_bp.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    try:
        user_row = supabase.table('users').select('id, username').eq('email', email).execute()
        if not user_row.data:
            return jsonify({'error': 'No account found with this email.'}), 404
        username = user_row.data[0]['username']
        resp = supabase.auth.reset_password_for_email(email)
        if hasattr(resp, 'error') and resp.error:
            return jsonify({'error': str(resp.error)}), 400
        return jsonify({'message': 'A reset link has been sent to your email.'})
    except Exception as e:
        return jsonify({'error': f'Error: {str(e)}'}), 500


@auth_bp.route('/api/request-otp', methods=['POST'])
def request_otp():
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    user_row = supabase.table('users').select('id, username').eq('email', email).execute()
    if not user_row.data:
        return jsonify({'error': 'No account found with this email.'}), 404
    otp = ''.join(random.choices(string.digits, k=6))
    ph_tz = pytz.timezone('Asia/Manila')
    expires_at = datetime.now(ph_tz) + timedelta(minutes=5)
    expires_at_naive = expires_at.replace(tzinfo=None)
    supabase.table('password_reset_otps').delete().eq('email', email).execute()
    supabase.table('password_reset_otps').insert({
        'email': email,
        'otp': otp,
        'expires_at': expires_at_naive.isoformat()
    }).execute()
    try:
        send_otp_email_gmail(email, otp, username=user_row.data[0]['username'])
    except Exception as e:
        return jsonify({'error': f'Failed to send OTP email: {str(e)}'}), 500
    return jsonify({'message': 'OTP sent to your email.'}), 200


@auth_bp.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    email = data.get('email')
    otp = data.get('otp')
    new_password = data.get('new_password')
    if not all([email, otp, new_password]):
        return jsonify({'error': 'Email, OTP, and new password are required.'}), 400
    otp_row = supabase.table('password_reset_otps').select('*').eq('email', email).eq('otp', otp).execute()
    if not otp_row.data:
        return jsonify({'error': 'Invalid OTP.'}), 400
    otp_data = otp_row.data[0]
    ph_tz = pytz.timezone('Asia/Manila')
    now_naive = datetime.now(ph_tz).replace(tzinfo=None)
    expires_at_naive = datetime.fromisoformat(otp_data['expires_at']).replace(tzinfo=None)
    if now_naive > expires_at_naive:
        return jsonify({'error': 'OTP has expired.'}), 400
    try:
        user_row = supabase.table('users').select('id').eq('email', email).execute()
        if not user_row.data:
            return jsonify({'error': 'User not found.'}), 404
        update_resp = supabase.auth.admin.update_user_by_id(user_row.data[0]['id'], {"password": new_password})
        if hasattr(update_resp, 'user') and update_resp.user:
            supabase.table('password_reset_otps').delete().eq('email', email).execute()
            return jsonify({'message': 'Password updated successfully.'})
        else:
            return jsonify({'error': 'Failed to update password.'}), 500
    except Exception as e:
        return jsonify({'error': f'Error: {str(e)}'}), 500


@auth_bp.route('/api/verify-otp-only', methods=['POST'])
def verify_otp_only():
    data = request.get_json()
    email = data.get('email')
    otp = data.get('otp')
    if not all([email, otp]):
        return jsonify({'error': 'Email and OTP are required.'}), 400
    otp_row = supabase.table('password_reset_otps').select('*').eq('email', email).eq('otp', otp).execute()
    if not otp_row.data:
        return jsonify({'error': 'Invalid OTP.'}), 400
    otp_data = otp_row.data[0]
    ph_tz = pytz.timezone('Asia/Manila')
    now_naive = datetime.now(ph_tz).replace(tzinfo=None)
    expires_at_naive = datetime.fromisoformat(otp_data['expires_at']).replace(tzinfo=None)
    if now_naive > expires_at_naive:
        return jsonify({'error': 'OTP has expired.'}), 400
    return jsonify({'success': True}), 200