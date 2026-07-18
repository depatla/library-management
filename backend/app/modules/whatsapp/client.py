"""Thin wrapper around the Twilio REST client for WhatsApp sends and Content API template lookup."""

import json
import re

from twilio.rest import Client


def _to_e164(phone: str) -> str:
    """Twilio's WhatsApp API requires E.164 (+<country code><number>). Student
    phone numbers are entered as bare 10-digit Indian mobile numbers with no
    country code — sending that as-is gets silently mis-parsed as a NANP (+1)
    number by Twilio, producing an undeliverable recipient (error 63024).
    Defaults bare 10-digit numbers to India (+91); anything already carrying
    a country code or a leading '+' is passed through unchanged."""
    digits = re.sub(r"\D", "", phone)
    if phone.strip().startswith("+"):
        return "+" + digits
    if len(digits) == 10:
        return "+91" + digits
    return "+" + digits


def send_whatsapp(
    *,
    account_sid: str,
    auth_token: str,
    whatsapp_number: str,
    to_phone: str,
    body: str | None = None,
    content_sid: str | None = None,
    content_variables: dict[str, str] | None = None,
    status_callback: str | None = None,
) -> str:
    """Sends a WhatsApp message via Twilio, returns the provider message SID.
    Raises `twilio.base.exceptions.TwilioRestException` on failure — callers
    translate that into domain exceptions or swallow it per the trigger type."""
    client = Client(account_sid, auth_token)
    kwargs = {"from_": f"whatsapp:{_to_e164(whatsapp_number)}", "to": f"whatsapp:{_to_e164(to_phone)}"}
    if status_callback:
        kwargs["status_callback"] = status_callback
    if content_sid:
        kwargs["content_sid"] = content_sid
        if content_variables:
            kwargs["content_variables"] = json.dumps(content_variables)
    else:
        kwargs["body"] = body
    message = client.messages.create(**kwargs)
    return message.sid


def _extract_body(types: dict | None) -> str:
    """`types` is keyed by content type, e.g. {'twilio/text': {'body': '...'}} —
    pull the body text from whichever content type is present."""
    if not types:
        return ""
    first = next(iter(types.values()), {})
    return first.get("body", "")


def list_content_templates(*, account_sid: str, auth_token: str) -> list[dict]:
    """Fetches every Content API template on the Twilio account, with its
    WhatsApp approval status, so staff can pick an approved SID from a
    dropdown instead of hand-copying it from the Twilio Console."""
    client = Client(account_sid, auth_token)
    items = client.content.v1.content_and_approvals.list(limit=100)
    return [
        {
            "sid": item.sid,
            "friendly_name": item.friendly_name,
            "language": item.language,
            "variables": item.variables or {},
            "body": _extract_body(item.types),
            "approval_status": ((item.approval_requests or {}).get("whatsapp") or {}).get("status"),
        }
        for item in items
    ]
