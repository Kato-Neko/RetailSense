from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..services.auth_service import auth_service

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    
    if not all([username, password, email]):
        return jsonify({"error": "Missing required fields"}), 400
    
    success, message = auth_service.register_user(username, email, password)
    
    if success:
        return jsonify({"success": True, "message": message}), 201
    else:
        status_code = 409 if "already exists" in message else 500
        return jsonify({"error": message}), status_code


@auth_bp.route('/api/login', methods=['POST'])
def login_api():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400
    
    success, message, access_token = auth_service.login_user(email, password)
    
    if success:
        return jsonify({"success": True, "message": message, "access_token": access_token}), 200
    else:
        status_code = 401 if "Invalid credentials" in message else 500
        return jsonify({"error": message}), status_code


@auth_bp.route('/api/logout', methods=['POST'])
def logout_api():
    return jsonify({"success": True, "message": "Logged out successfully"})


@auth_bp.route('/api/user', methods=['GET'])
@jwt_required()
def get_user_info():
    current_user_uid = get_jwt_identity()
    if not current_user_uid:
        return jsonify({"error": "Not logged in"}), 401
    
    success, message, user_data = auth_service.get_user_info(current_user_uid)
    
    if success:
        return jsonify(user_data)
    else:
        status_code = 404 if "not found" in message.lower() else 500
        return jsonify({"error": message}), status_code


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
    
    success, message = auth_service.update_username(user_id, new_username)
    
    if success:
        return jsonify({"message": message, "username": new_username})
    else:
        status_code = 400 if "already exists" in message else 500
        return jsonify({"error": message}), status_code


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
    
    success, message = auth_service.change_password(user_id, current_password, new_password)
    
    if success:
        return jsonify({"message": message})
    else:
        status_code = 400 if any(keyword in message.lower() for keyword in ["incorrect", "required", "characters"]) else 500
        return jsonify({"error": message}), status_code


@auth_bp.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    success, message = auth_service.forgot_password(email)
    
    if success:
        return jsonify({'message': message})
    else:
        status_code = 404 if "not found" in message.lower() else 500
        return jsonify({'error': message}), status_code


@auth_bp.route('/api/request-otp', methods=['POST'])
def request_otp():
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    success, message = auth_service.request_otp(email)
    
    if success:
        return jsonify({'message': message}), 200
    else:
        status_code = 404 if "not found" in message.lower() else 500
        return jsonify({'error': message}), status_code


@auth_bp.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    email = data.get('email')
    otp = data.get('otp')
    new_password = data.get('new_password')
    
    if not all([email, otp, new_password]):
        return jsonify({'error': 'Email, OTP, and new password are required.'}), 400
    
    success, message = auth_service.verify_otp(email, otp, new_password)
    
    if success:
        return jsonify({'message': message})
    else:
        status_code = 400 if any(keyword in message.lower() for keyword in ["invalid", "expired", "required"]) else 500
        return jsonify({'error': message}), status_code


@auth_bp.route('/api/verify-otp-only', methods=['POST'])
def verify_otp_only():
    data = request.get_json()
    email = data.get('email')
    otp = data.get('otp')
    
    if not all([email, otp]):
        return jsonify({'error': 'Email and OTP are required.'}), 400
    
    success, message = auth_service.verify_otp(email, otp)
    
    if success:
        return jsonify({'success': True}), 200
    else:
        status_code = 400 if any(keyword in message.lower() for keyword in ["invalid", "expired", "required"]) else 500
        return jsonify({'error': message}), status_code
