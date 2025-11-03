import os
import smtplib
from email.message import EmailMessage
class EmailNotificationService:
    """Sends email notifications (e.g., OTP) via Gmail SMTP."""

    def send_otp_email_gmail(self, to_email: str, otp: str, username: str = "User") -> None:
        gmail_user = os.getenv('GMAIL_USER')
        gmail_pass = os.getenv('GMAIL_PASS')
        if not gmail_user or not gmail_pass:
            raise Exception('GMAIL_USER and GMAIL_PASS must be set in environment')

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


# Backward-compatible function wrapper
_email_service_singleton = EmailNotificationService()


def send_otp_email_gmail(to_email: str, otp: str, username: str = "User") -> None:
    return _email_service_singleton.send_otp_email_gmail(to_email, otp, username)
