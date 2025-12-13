import os
import smtplib
from email.message import EmailMessage


class NotificationService:
    """Service for sending notifications via email."""
    
    def __init__(self):
        """Initialize the notification service."""
        self.gmail_user = os.getenv('GMAIL_USER')
        self.gmail_pass = os.getenv('GMAIL_PASS')
    
    def send_otp_email_gmail(self, to_email: str, otp: str, username: str = "User") -> None:
        """Send OTP email via Gmail.
        
        Args:
            to_email: Recipient email address
            otp: One-time password code
            username: Optional username for personalization
            
        Raises:
            Exception: If Gmail credentials are not set
        """
        if not self.gmail_user or not self.gmail_pass:
            raise Exception('GMAIL_USER and GMAIL_PASS must be set in environment')

        msg = EmailMessage()
        msg['Subject'] = 'Your RetailSense OTP Code'
        msg['From'] = self.gmail_user
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
            smtp.login(self.gmail_user, self.gmail_pass)
            smtp.send_message(msg)


# Global instance
_notification_service = None


def get_notification_service() -> NotificationService:
    """Get the global notification service instance."""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service


# Legacy function for backward compatibility
def send_otp_email_gmail(to_email: str, otp: str, username: str = "User") -> None:
    """Legacy function for backward compatibility."""
    return get_notification_service().send_otp_email_gmail(to_email, otp, username)
