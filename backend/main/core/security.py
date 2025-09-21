import hashlib
import secrets


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hash_obj = hashlib.sha256((password + salt).encode())
    return f"{salt}${hash_obj.hexdigest()}"


def verify_password(stored_password: str, provided_password: str) -> bool:
    salt, hash_value = stored_password.split('$')
    hash_obj = hashlib.sha256((provided_password + salt).encode())
    return hash_obj.hexdigest() == hash_value

