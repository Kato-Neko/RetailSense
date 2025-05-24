# auth.py
import datetime
import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from supabase import create_client
import logging
from utils import hash_password  # Assuming hash_password is in utils.py
from dotenv import load_dotenv
import random
import string
from datetime import datetime, timedelta, timezone
import smtplib
from email.message import EmailMessage
import pytz  # Add this import for timezone handling

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
            access_token = create_access_token(identity=response.user.id, expires_delta=timedelta(days=1))
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
        # Check if new username already exists in Supabase
        existing = supabase.table('users').select('username').eq('username', new_username).execute()
        if existing.data:
            return jsonify({"error": "Username already exists"}), 400
        # Update username in Supabase
        update_response = supabase.table('users').update({'username': new_username}).eq('id', user_id).execute()
        if update_response.data:
            return jsonify({
                "message": "Username updated successfully",
                "username": new_username
            })
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
        # Get user email from users table
        user_row = supabase.table('users').select('email').eq('id', user_id).execute()
        if not user_row.data:
            return jsonify({"error": "User not found"}), 404
        email = user_row.data[0]['email']
        # Try to sign in with current password to verify
        login_resp = supabase.auth.sign_in_with_password({"email": email, "password": current_password})
        if not login_resp.user:
            return jsonify({"error": "Current password is incorrect"}), 400
        # Update password in Supabase Auth
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
        # Check if email exists in users table
        user_row = supabase.table('users').select('id').eq('email', email).execute()
        if not user_row.data:
            return jsonify({'error': 'No account found with this email.'}), 404
        resp = supabase.auth.reset_password_for_email(email)
        if hasattr(resp, 'error') and resp.error:
            return jsonify({'error': str(resp.error)}), 400
        return jsonify({'message': 'A reset link has been sent to your email.'})
    except Exception as e:
        return jsonify({'error': f'Error: {str(e)}'}), 500

def send_otp_email_gmail(to_email, otp):
    gmail_user = os.getenv('GMAIL_USER')
    gmail_pass = os.getenv('GMAIL_PASS')
    if not gmail_user or not gmail_pass:
        raise Exception('GMAIL_USER and GMAIL_PASS must be set in environment')

    # Fetch username for personalization
    user_row = supabase.table('users').select('username').eq('email', to_email).execute()
    username = user_row.data[0]['username'] if user_row.data else "User"

    msg = EmailMessage()
    msg['Subject'] = 'Your RetailSense OTP Code'
    msg['From'] = gmail_user
    msg['To'] = to_email
    msg.set_content(
        f"""Hello and good day to you, {username}.

We are RetailSense, an application dedicated to providing intelligent retail analytics and insights.
We have received a request to reset the password for your account associated with this email address.

Your One-Time Password (OTP) is: {otp}

Please do not share this code with anyone. This code will expire in 5 minutes.
If you did not request this password reset, please ignore this email or contact our support team.

Thank you,
The RetailSense Team
"""
    )
    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
        smtp.login(gmail_user, gmail_pass)
        smtp.send_message(msg)

@auth_bp.route('/api/request-otp', methods=['POST'])
def request_otp():
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    # Check if user exists
    user_row = supabase.table('users').select('id').eq('email', email).execute()
    if not user_row.data:
        return jsonify({'error': 'No account found with this email.'}), 404
    # Generate 6-digit OTP
    otp = ''.join(random.choices(string.digits, k=6))
    # Use Philippines local time (UTC+8), but store as naive (no tzinfo)
    ph_tz = pytz.timezone('Asia/Manila')
    expires_at = datetime.now(ph_tz) + timedelta(minutes=5)
    expires_at_naive = expires_at.replace(tzinfo=None)
    # Store OTP in table (delete old OTPs for this email first)
    supabase.table('password_reset_otps').delete().eq('email', email).execute()
    supabase.table('password_reset_otps').insert({
        'email': email,
        'otp': otp,
        'expires_at': expires_at_naive.isoformat()
    }).execute()
    try:
        send_otp_email_gmail(email, otp)
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
    # Get OTP row
    otp_row = supabase.table('password_reset_otps').select('*').eq('email', email).eq('otp', otp).execute()
    if not otp_row.data:
        return jsonify({'error': 'Invalid OTP.'}), 400
    otp_data = otp_row.data[0]
    # Compare using naive local time (Philippines)
    ph_tz = pytz.timezone('Asia/Manila')
    now_naive = datetime.now(ph_tz).replace(tzinfo=None)
    expires_at_naive = datetime.fromisoformat(otp_data['expires_at']).replace(tzinfo=None)
    if now_naive > expires_at_naive:
        return jsonify({'error': 'OTP has expired.'}), 400
    # Update password in Supabase Auth
    try:
        user_row = supabase.table('users').select('id').eq('email', email).execute()
        if not user_row.data:
            return jsonify({'error': 'User not found.'}), 404
        # Use Supabase Admin API to update password
        update_resp = supabase.auth.admin.update_user_by_id(user_row.data[0]['id'], {"password": new_password})
        if hasattr(update_resp, 'user') and update_resp.user:
            # Delete OTP after use
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
    # Get OTP row
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