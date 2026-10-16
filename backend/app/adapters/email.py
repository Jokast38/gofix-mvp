import asyncio
import smtplib
from abc import ABC, abstractmethod
from email.message import EmailMessage
from email.utils import formataddr

from app.core.logging import get_logger

log = get_logger("email")


class EmailAdapter(ABC):
    @abstractmethod
    async def send(self, to: str, subject: str, body: str) -> bool: ...


class ConsoleEmailAdapter(EmailAdapter):
    async def send(self, to, subject, body):
        log.info("email_console", extra={"ctx": {"to": to, "subject": subject, "body": body}})
        return True


class SmtpEmailAdapter(EmailAdapter):
    def __init__(self, cfg: dict):
        self.host, self.port = cfg["host"], int(cfg["port"])
        self.user, self.password = cfg.get("username") or None, cfg.get("password")
        self.security = cfg.get("security") or ("ssl" if self.port == 465 else "starttls")
        self.sender = formataddr((cfg.get("from_name") or "", cfg["from_email"]))
        self.reply_to = cfg.get("reply_to") or None

    def _send(self, msg):
        if self.security == "ssl":  # implicit TLS (SMTPS, port 465), common with hosted mailboxes
            with smtplib.SMTP_SSL(self.host, self.port, timeout=15) as s:
                if self.user:
                    s.login(self.user, self.password)
                s.send_message(msg)
            return
        with smtplib.SMTP(self.host, self.port, timeout=15) as s:
            if self.security == "starttls":
                s.starttls()
            if self.user:
                s.login(self.user, self.password)
            s.send_message(msg)

    async def send(self, to, subject, body):
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = self.sender, to, subject
        if self.reply_to:
            msg["Reply-To"] = self.reply_to
        msg.set_content(body)
        await asyncio.to_thread(self._send, msg)
        return True


class ConfiguredEmailAdapter(EmailAdapter):
    """Reads the configuration in force (back-office, else .env) at each send: changes apply without a restart."""

    async def send(self, to, subject, body):
        from app.services import email_config

        cfg = await email_config.effective()
        if cfg["provider"] == "smtp" and email_config.smtp_complete(cfg):
            return await SmtpEmailAdapter(cfg["smtp"]).send(to, subject, body)
        if cfg["provider"] == "smtp":
            log.error("email_smtp_incomplete")
        return await ConsoleEmailAdapter().send(to, subject, body)


def get_email_adapter() -> EmailAdapter:
    return ConfiguredEmailAdapter()
