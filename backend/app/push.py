"""Pen Neer — Web Push (real notifications while the app is CLOSED).

The in-app "meldingen" were local Notification API calls: they only fire while
a page is open. This module is the missing server half: browsers register a
PushSubscription (endpoint + keys), we store it per account, and events (invite,
challenge, friend request, DM) are pushed through the browser vendor's push
service so the phone shows them with the app closed.

VAPID keys identify this server to the push services. If PENNEER_VAPID_PRIVATE
/ PENNEER_VAPID_PUBLIC are not set as env, a key pair is generated ONCE and
persisted in the database (persistent volume), so prod needs zero config.

iOS note: web push on iPhone requires the PWA to be installed on the home
screen (iOS 16.4+) and permission granted from that installed app.

pywebpush is synchronous; sends run in a thread executor and are best-effort.
Expired subscriptions (404/410) are pruned automatically.
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
from typing import Optional

from .db import get_db

SUBJECT = os.environ.get("PENNEER_VAPID_SUBJECT", "mailto:kream.art@gmail.com")

_keys: Optional[tuple[str, str]] = None  # (private_pem_or_der, public_b64url)


def _generate_keys() -> tuple[str, str]:
    """Generate a fresh VAPID P-256 key pair. Returns (private_pem, public_b64url)."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    priv = ec.generate_private_key(ec.SECP256R1())
    priv_pem = priv.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    pub_raw = priv.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    pub_b64 = base64.urlsafe_b64encode(pub_raw).decode().rstrip("=")
    return priv_pem, pub_b64


def keys() -> tuple[str, str]:
    """The server's VAPID (private, public) pair: env > db > freshly generated."""
    global _keys
    if _keys:
        return _keys
    env_priv = (os.environ.get("PENNEER_VAPID_PRIVATE") or "").strip()
    env_pub = (os.environ.get("PENNEER_VAPID_PUBLIC") or "").strip()
    if env_priv and env_pub:
        _keys = (env_priv, env_pub)
        return _keys
    db = get_db()
    priv, pub = db.meta_get("vapid_private"), db.meta_get("vapid_public")
    if not (priv and pub):
        priv, pub = _generate_keys()
        db.meta_set("vapid_private", priv)
        db.meta_set("vapid_public", pub)
        print("[penneer] VAPID-sleutels gegenereerd en opgeslagen in de database", flush=True)
    _keys = (priv, pub)
    return _keys


def public_key() -> str:
    return keys()[1]


def available() -> bool:
    try:
        import pywebpush  # noqa: F401
        return True
    except Exception:
        return False


def _send_sync(sub: dict, payload: str, private_key: str) -> Optional[int]:
    """Send one push. Returns an HTTP-ish status; 404/410 mean the subscription
    is dead and should be pruned."""
    from pywebpush import WebPushException, webpush

    try:
        webpush(
            subscription_info={
                "endpoint": sub["endpoint"],
                "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
            },
            data=payload,
            vapid_private_key=private_key,
            vapid_claims={"sub": SUBJECT},
            ttl=3600,
        )
        return 201
    except WebPushException as exc:
        return exc.response.status_code if exc.response is not None else None
    except Exception:
        return None


async def notify(user_id: str, title: str, body: str, tag: str = "penneer") -> None:
    """Best-effort push to every device of `user_id`. Never raises."""
    if not available():
        return
    db = get_db()
    subs = db.push_subs_of(user_id)
    if not subs:
        return
    private_key, _ = keys()
    payload = json.dumps({"title": title, "body": body, "tag": tag, "url": "/"})
    loop = asyncio.get_running_loop()
    for sub in subs:
        try:
            status = await loop.run_in_executor(None, _send_sync, sub, payload, private_key)
            if status in (404, 410):
                db.push_unsubscribe(sub["endpoint"])
        except Exception:
            pass
