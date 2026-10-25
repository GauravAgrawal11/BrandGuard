"""
BrandGuard Multi-Channel Notification Dispatcher
Handles In-App, Email, and Slack alerts for governance actions,
exception requests, compliance clearances, and blast-radius re-audits.
"""
import json
import logging
from typing import Dict, Any, Optional
import urllib.request
import urllib.error
from django.conf import settings
from django.core.mail import send_mail
from governance.models import Notification, BrandGuardUser

logger = logging.getLogger(__name__)

SLACK_CHANNEL_NAME = getattr(settings, 'BRANDGUARD_SLACK_CHANNEL', '#brand-governance')
DEFAULT_FROM_EMAIL = getattr(settings, 'DEFAULT_FROM_EMAIL', 'compliance@brandguard.internal')


def get_notification_integrations_status() -> Dict[str, Any]:
    """Returns current operational status of all notification channels."""
    slack_webhook = getattr(settings, 'BRANDGUARD_SLACK_WEBHOOK_URL', '')
    email_configured = bool(getattr(settings, 'EMAIL_HOST', '')) or settings.DEBUG

    return {
        "in_app": {
            "enabled": True,
            "status": "OPERATIONAL",
            "description": "Real-time in-app badge & dropdown notifications"
        },
        "email": {
            "enabled": True,
            "configured": bool(email_configured),
            "from_email": DEFAULT_FROM_EMAIL,
            "status": "OPERATIONAL" if email_configured else "SIMULATED",
            "description": "SMTP outbound transactional alerts"
        },
        "slack": {
            "enabled": True,
            "configured": bool(slack_webhook),
            "webhook_configured": bool(slack_webhook),
            "target_channel": SLACK_CHANNEL_NAME,
            "status": "OPERATIONAL" if slack_webhook else "SIMULATED",
            "description": "Slack incoming webhooks with Block Kit formatted interactive alerts"
        }
    }


def dispatch_notification(
    recipient: BrandGuardUser,
    title: str,
    message: str,
    notification_type: str = 'INFO',
    link_url: str = '',
    metadata: Optional[Dict[str, Any]] = None,
    send_email: bool = True,
    send_slack: bool = True
) -> Dict[str, Any]:
    """
    Dispatches a multi-channel notification:
    1. In-App Notification (database record)
    2. Email Notification (via Django mailer)
    3. Slack Webhook Notification (or simulated payload logging)
    """
    results = {
        "notification_id": None,
        "in_app": False,
        "email": False,
        "slack": False,
        "recipient": recipient.username,
        "notification_type": notification_type
    }

    # 1. In-App Notification
    try:
        notif = Notification.objects.create(
            recipient=recipient,
            title=title,
            message=message,
            notification_type=notification_type,
            link_url=link_url
        )
        results["notification_id"] = str(notif.id)
        results["in_app"] = True
    except Exception as e:
        logger.error(f"[NOTIF ERROR] In-App notification failed: {e}")

    # 2. Email Notification
    if send_email and recipient.email:
        try:
            subject = f"[BrandGuard] {title}"
            body = (
                f"Hello {recipient.get_full_name() or recipient.username},\n\n"
                f"{message}\n\n"
                f"Action Link: {link_url if link_url else 'https://brandguard.internal'}\n\n"
                f"---\n"
                f"BrandGuard Marketing Compiler & Governance Engine\n"
                f"Notice: Brand-compliance cleared. Not a substitute for formal legal review."
            )
            send_mail(
                subject=subject,
                message=body,
                from_email=DEFAULT_FROM_EMAIL,
                recipient_list=[recipient.email],
                fail_silently=True
            )
            results["email"] = True
        except Exception as e:
            logger.warning(f"[EMAIL NOTIF WARNING] Could not send email to {recipient.email}: {e}")
            results["email"] = "SIMULATED_LOGGED"
    else:
        results["email"] = "SKIPPED_NO_EMAIL"

    # 3. Slack Webhook Notification
    if send_slack:
        slack_result = _send_slack_alert(title, message, notification_type, link_url, recipient)
        results["slack"] = slack_result

    return results


def _send_slack_alert(title: str, message: str, notification_type: str, link_url: str, recipient: BrandGuardUser) -> Any:
    """Sends or simulates Slack incoming webhook alert."""
    webhook_url = getattr(settings, 'BRANDGUARD_SLACK_WEBHOOK_URL', '')

    severity_emoji = {
        'EXCEPTION_PENDING': ':warning:',
        'EXCEPTION_APPROVED': ':white_check_mark:',
        'EXCEPTION_REJECTED': ':x:',
        'FACT_EXPIRING': ':hourglass_flowing_sand:',
        'BULK_REAUDIT': ':recycle:',
        'STAMP_APPROVED': ':shield:',
        'INFO': ':information_source:'
    }.get(notification_type, ':bell:')

    slack_payload = {
        "channel": SLACK_CHANNEL_NAME,
        "text": f"{severity_emoji} *[BrandGuard]* {title}",
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{severity_emoji} {title}",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{message}\n*Target User:* @{recipient.username} ({recipient.role})"
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": "🛡️ *BrandGuard Governance* · _Brand-compliance cleared. Not a substitute for formal legal review._"
                    }
                ]
            }
        ]
    }

    if webhook_url:
        try:
            req = urllib.request.Request(
                webhook_url,
                data=json.dumps(slack_payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status in (200, 204):
                    return True
        except Exception as e:
            logger.warning(f"[SLACK WEBHOOK ERROR] Webhook dispatch to {webhook_url} failed: {e}")
            return f"FAILED: {e}"

    # Simulated Slack delivery (logged cleanly)
    logger.info(f"[SLACK SIMULATED DISPATCH] Channel: {SLACK_CHANNEL_NAME} | Payload: {title} -> {message}")
    return "SIMULATED_OK"
