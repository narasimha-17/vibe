import asyncio
import logging
import smtplib
from email.message import EmailMessage

from fastapi import HTTPException

from app.core.config import get_settings

logger = logging.getLogger("vibe.mailer")
settings = get_settings()


def _send_sync(msg: EmailMessage) -> None:
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        if settings.smtp_starttls:
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password or "")
        server.send_message(msg)


async def send_email(to: str, subject: str, text: str, html: str | None = None) -> bool:
    """Returns True if delivered by SMTP, False if SMTP isn't configured (message is logged instead)."""
    if not settings.smtp_configured:
        logger.warning("SMTP not configured - email to %s not sent.\nSubject: %s\n%s", to, subject, text)
        return False

    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    try:
        await asyncio.to_thread(_send_sync, msg)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to send email to %s", to)
        raise HTTPException(status_code=502, detail="We couldn't send the email. Please try again shortly.") from exc
    return True
