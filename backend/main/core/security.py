import hashlib
import secrets


class SecurityManager:
    """Manages security operations like password hashing and verification."""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password with a random salt.
        
        Args:
            password: The password to hash
            
        Returns:
            String in format "salt$hash"
        """
        salt = secrets.token_hex(16)
        hash_obj = hashlib.sha256((password + salt).encode())
        return f"{salt}${hash_obj.hexdigest()}"
    
    @staticmethod
    def verify_password(stored_password: str, provided_password: str) -> bool:
        """Verify a password against a stored hash.
        
        Args:
            stored_password: The stored password hash (format: "salt$hash")
            provided_password: The password to verify
            
        Returns:
            True if password matches, False otherwise
        """
        salt, hash_value = stored_password.split('$')
        hash_obj = hashlib.sha256((provided_password + salt).encode())
        return hash_obj.hexdigest() == hash_value


# Global instance
_security_manager = None


def get_security_manager() -> SecurityManager:
    """Get the global security manager instance."""
    global _security_manager
    if _security_manager is None:
        _security_manager = SecurityManager()
    return _security_manager


# Legacy functions for backward compatibility
def hash_password(password: str) -> str:
    """Legacy function for backward compatibility."""
    return SecurityManager.hash_password(password)


def verify_password(stored_password: str, provided_password: str) -> bool:
    """Legacy function for backward compatibility."""
    return SecurityManager.verify_password(stored_password, provided_password)

