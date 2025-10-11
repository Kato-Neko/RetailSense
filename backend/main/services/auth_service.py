"""
AuthService class for handling authentication operations.
Centralizes all authentication-related functionality.
"""

import os
import logging
import random
import string
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple

from flask_jwt_extended import create_access_token
from ..core.config import supabase
from ..core.security import hash_password, verify_password
from .notifications import send_otp_email_gmail
import pytz


class AuthService:
    """Handles authentication operations."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def register_user(self, username: str, email: str, password: str) -> Tuple[bool, str]:
        """
        Register a new user.
        Returns (success, message/error)
        """
        try:
            # Check if username already exists
            existing_user = supabase.table('users').select('username').eq('username', username).execute()
            if existing_user.data:
                return False, "Username already exists"
            
            # Create user in Supabase Auth
            response = supabase.auth.sign_up({"email": email, "password": password})
            if not response.user:
                error_msg = getattr(response, 'error', 'Registration failed')
                return False, f"Registration failed: {error_msg}"
            
            # Store user data in our users table
            password_hash = hash_password(password)
            supabase.table('users').insert({
                'id': response.user.id,
                'username': username,
                'email': email,
                'password_hash': password_hash
            }).execute()
            
            return True, "Registration successful"
            
        except Exception as e:
            self.logger.error(f"Error during registration: {str(e)}")
            return False, f"Error: {str(e)}"
    
    def login_user(self, email: str, password: str) -> Tuple[bool, str, Optional[str]]:
        """
        Authenticate user login.
        Returns (success, message/error, access_token)
        """
        try:
            response = supabase.auth.sign_in_with_password({"email": email, "password": password})
            if response.user:
                access_token = create_access_token(
                    identity=response.user.id, 
                    expires_delta=timedelta(days=1)
                )
                return True, "Login successful", access_token
            else:
                return False, "Invalid credentials", None
                
        except Exception as e:
            self.logger.error(f"Error during login: {str(e)}")
            return False, f"Error: {str(e)}", None
    
    def get_user_info(self, user_id: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        """
        Get user information by ID.
        Returns (success, message/error, user_data)
        """
        try:
            user_data = supabase.table('users').select('username, email, created_at').eq('id', user_id).execute()
            if user_data.data:
                user = user_data.data[0]
                return True, "User found", {
                    "username": user['username'],
                    "email": user['email'],
                    "created_at": user['created_at']
                }
            return False, "User not found", None
            
        except Exception as e:
            self.logger.error(f"Database error: {str(e)}")
            return False, f"Database error: {str(e)}", None
    
    def update_username(self, user_id: str, new_username: str) -> Tuple[bool, str]:
        """
        Update user's username.
        Returns (success, message/error)
        """
        try:
            # Check if username already exists
            existing = supabase.table('users').select('username').eq('username', new_username).execute()
            if existing.data:
                return False, "Username already exists"
            
            # Update username
            update_response = supabase.table('users').update({'username': new_username}).eq('id', user_id).execute()
            if update_response.data:
                return True, "Username updated successfully"
            else:
                return False, "Failed to update username in Supabase."
                
        except Exception as e:
            return False, f"Supabase error: {str(e)}"
    
    def change_password(self, user_id: str, current_password: str, new_password: str) -> Tuple[bool, str]:
        """
        Change user's password.
        Returns (success, message/error)
        """
        try:
            if len(new_password) < 6:
                return False, "New password must be at least 6 characters long"
            
            # Get user email
            user_row = supabase.table('users').select('email').eq('id', user_id).execute()
            if not user_row.data:
                return False, "User not found"
            
            email = user_row.data[0]['email']
            
            # Verify current password
            login_resp = supabase.auth.sign_in_with_password({"email": email, "password": current_password})
            if not login_resp.user:
                return False, "Current password is incorrect"
            
            # Update password
            update_resp = supabase.auth.update_user({"password": new_password})
            if update_resp.user:
                return True, "Password updated successfully"
            else:
                return False, "Failed to update password in Supabase."
                
        except Exception as e:
            return False, f"Supabase error: {str(e)}"
    
    def forgot_password(self, email: str) -> Tuple[bool, str]:
        """
        Initiate password reset process.
        Returns (success, message/error)
        """
        try:
            # Check if user exists
            user_row = supabase.table('users').select('id, username').eq('email', email).execute()
            if not user_row.data:
                return False, "No account found with this email."
            
            # Send reset email
            resp = supabase.auth.reset_password_for_email(email)
            if hasattr(resp, 'error') and resp.error:
                return False, str(resp.error)
            
            return True, "A reset link has been sent to your email."
            
        except Exception as e:
            return False, f"Error: {str(e)}"
    
    def request_otp(self, email: str) -> Tuple[bool, str]:
        """
        Request OTP for password reset.
        Returns (success, message/error)
        """
        try:
            # Check if user exists
            user_row = supabase.table('users').select('id, username').eq('email', email).execute()
            if not user_row.data:
                return False, "No account found with this email."
            
            username = user_row.data[0]['username']
            
            # Generate OTP
            otp = ''.join(random.choices(string.digits, k=6))
            ph_tz = pytz.timezone('Asia/Manila')
            expires_at = datetime.now(ph_tz) + timedelta(minutes=5)
            expires_at_naive = expires_at.replace(tzinfo=None)
            
            # Store OTP in database
            supabase.table('password_reset_otps').delete().eq('email', email).execute()
            supabase.table('password_reset_otps').insert({
                'email': email,
                'otp': otp,
                'expires_at': expires_at_naive.isoformat()
            }).execute()
            
            # Send OTP email
            send_otp_email_gmail(email, otp, username=username)
            
            return True, "OTP sent to your email."
            
        except Exception as e:
            return False, f"Failed to send OTP email: {str(e)}"
    
    def verify_otp(self, email: str, otp: str, new_password: str = None) -> Tuple[bool, str]:
        """
        Verify OTP and optionally reset password.
        Returns (success, message/error)
        """
        try:
            # Get OTP record
            otp_row = supabase.table('password_reset_otps').select('*').eq('email', email).eq('otp', otp).execute()
            if not otp_row.data:
                return False, "Invalid OTP."
            
            otp_data = otp_row.data[0]
            
            # Check if OTP has expired
            ph_tz = pytz.timezone('Asia/Manila')
            now_naive = datetime.now(ph_tz).replace(tzinfo=None)
            expires_at_naive = datetime.fromisoformat(otp_data['expires_at']).replace(tzinfo=None)
            if now_naive > expires_at_naive:
                return False, "OTP has expired."
            
            # If new_password is provided, update password
            if new_password:
                user_row = supabase.table('users').select('id').eq('email', email).execute()
                if not user_row.data:
                    return False, "User not found."
                
                update_resp = supabase.auth.admin.update_user_by_id(user_row.data[0]['id'], {"password": new_password})
                if hasattr(update_resp, 'user') and update_resp.user:
                    supabase.table('password_reset_otps').delete().eq('email', email).execute()
                    return True, "Password updated successfully."
                else:
                    return False, "Failed to update password."
            else:
                # Just verify OTP without changing password
                return True, "OTP verified successfully."
                
        except Exception as e:
            return False, f"Error: {str(e)}"


# Singleton instance for global access
auth_service = AuthService()
