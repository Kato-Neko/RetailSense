"""
utils.py
Shared utility functions for the backend (e.g., password hashing).
"""

import hashlib
import secrets

def hash_password(password):
    """Hash a password using SHA-256 with a random salt."""
    salt = secrets.token_hex(16)
    hash_obj = hashlib.sha256((password + salt).encode())
    return f"{salt}${hash_obj.hexdigest()}"

def verify_password(stored_password, provided_password):
    """Verify a password against its hash."""
    salt, hash_value = stored_password.split('$')
    hash_obj = hashlib.sha256((provided_password + salt).encode())
    return hash_obj.hexdigest() == hash_value 