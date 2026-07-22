"""Pen Neer — PayPal Orders v2 (server-side create + capture).

The shop sells ONE thing: unlocking the AI referee for a single account. The
flow is a top-level redirect so the mobile PWA needs no PayPal JS SDK:

  1. create_order(user_id)  -> approve_url  (user is sent to PayPal)
  2. PayPal redirects back to  /?paypal=<order_id>  after approval
  3. capture_order(order_id) -> {status, amount, currency, custom_id}

Security notes (the money-critical bits):
  * The amount is fixed HERE, server-side (PRICE/CURRENCY env). The client never
    sends a price, so it cannot be tampered with.
  * The buyer's account id is baked into the order as `custom_id` at create time
    (from the authenticated bearer token), so capture unlocks exactly the payer.
  * The caller must verify status == "COMPLETED" and that the captured amount
    matches the configured price before unlocking (see main.py).

Config (env):
  PAYPAL_CLIENT_ID / PAYPAL_SECRET   REST app credentials (required)
  PAYPAL_ENV                         "live" (default) | "sandbox"
  PENNEER_PRICE                      unit price, e.g. "3.99" (default)
  PENNEER_CURRENCY                   ISO code, e.g. "EUR" (default)
  PENNEER_BASE_URL                   return/cancel origin (default prod URL)
"""
from __future__ import annotations

import base64
import os
from typing import Optional

BASE_URL = os.environ.get("PENNEER_BASE_URL", "https://penneer.artnomad.nl")
TIMEOUT_S = 15.0


def _env() -> str:
    return (os.environ.get("PAYPAL_ENV") or "live").strip().lower()


def api_base() -> str:
    return "https://api-m.sandbox.paypal.com" if _env() == "sandbox" else "https://api-m.paypal.com"


def _client_id() -> str:
    return (os.environ.get("PAYPAL_CLIENT_ID") or "").strip()


def _secret() -> str:
    return (os.environ.get("PAYPAL_SECRET") or "").strip()


# The shop's products: what each sells + its price env + default + description.
PRODUCTS = {
    "ai": {"env": "PENNEER_PRICE", "default": "3.99", "desc": "Pen Neer AI-scheidsrechter"},
    "avatars": {"env": "PENNEER_AVATARS_PRICE", "default": "2.99", "desc": "Pen Neer Premium avatars"},
}


def price(product: str = "ai") -> str:
    # PayPal wants a fixed 2-decimal string.
    p = PRODUCTS.get(product, PRODUCTS["ai"])
    try:
        return f"{float(os.environ.get(p['env'], p['default'])):.2f}"
    except ValueError:
        return p["default"]


def currency() -> str:
    return (os.environ.get("PENNEER_CURRENCY") or "EUR").strip().upper()


def configured() -> bool:
    return bool(_client_id() and _secret())


def status() -> dict:
    return {
        "enabled": configured(),
        "price": price("ai"),  # kept for older clients
        "ai_price": price("ai"),
        "avatars_price": price("avatars"),
        "currency": currency(),
        "env": _env(),
    }


async def _token(client) -> Optional[str]:
    creds = base64.b64encode(f"{_client_id()}:{_secret()}".encode()).decode()
    resp = await client.post(
        f"{api_base()}/v1/oauth2/token",
        headers={"Authorization": f"Basic {creds}", "Content-Type": "application/x-www-form-urlencoded"},
        content="grant_type=client_credentials",
    )
    resp.raise_for_status()
    return resp.json().get("access_token")


async def create_order(user_id: str, product: str = "ai") -> Optional[dict]:
    """Create an order for one `product` unlock tied to `user_id`. Returns
    {"order_id", "approve_url"} or None on any failure."""
    if not configured() or not user_id:
        return None
    if product not in PRODUCTS:
        product = "ai"
    try:
        import httpx
    except Exception:
        return None
    # PayPal redirects the buyer back to return_url with ?token=<order_id>
    # (and &PayerID=...) appended, so the SPA reads `paypal=return` + `token`.
    # custom_id carries BOTH the buyer and the product ("uid|product") so the
    # capture unlocks exactly the right thing for exactly the payer.
    body = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "custom_id": f"{user_id}|{product}",
                "description": PRODUCTS[product]["desc"],
                "amount": {"currency_code": currency(), "value": price(product)},
            }
        ],
        "application_context": {
            "brand_name": "Pen Neer",
            "user_action": "PAY_NOW",
            "shipping_preference": "NO_SHIPPING",
            "return_url": f"{BASE_URL}/?paypal=return",
            "cancel_url": f"{BASE_URL}/?paypal=cancel",
        },
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            tok = await _token(client)
            if not tok:
                return None
            resp = await client.post(
                f"{api_base()}/v2/checkout/orders",
                headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()
            oid = data.get("id")
            approve = next(
                (l.get("href") for l in data.get("links", []) if l.get("rel") in ("approve", "payer-action")),
                None,
            )
            if not oid or not approve:
                return None
            return {"order_id": oid, "approve_url": approve}
    except Exception:
        return None


async def capture_order(order_id: str) -> Optional[dict]:
    """Capture an approved order. Returns a normalized dict:
    {"status", "amount", "currency", "custom_id"} or None on failure."""
    if not configured() or not order_id:
        return None
    try:
        import httpx
    except Exception:
        return None
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            tok = await _token(client)
            if not tok:
                return None
            resp = await client.post(
                f"{api_base()}/v2/checkout/orders/{order_id}/capture",
                headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
            )
            # 201 = captured now; 422 UNPROCESSABLE often means already captured.
            if resp.status_code not in (200, 201, 422):
                return None
            data = resp.json()
            return _normalize(data)
    except Exception:
        return None


async def get_order(order_id: str) -> Optional[dict]:
    """Read an order without capturing (used to reconcile an already-captured
    order after a 422). Returns the same normalized dict as capture_order."""
    if not configured() or not order_id:
        return None
    try:
        import httpx
    except Exception:
        return None
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            tok = await _token(client)
            if not tok:
                return None
            resp = await client.get(
                f"{api_base()}/v2/checkout/orders/{order_id}",
                headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
            )
            resp.raise_for_status()
            return _normalize(resp.json())
    except Exception:
        return None


def _normalize(data: dict) -> dict:
    """Pull status/amount/currency/custom_id out of an order or capture body,
    tolerating both the create-order and capture-order response shapes."""
    pu = (data.get("purchase_units") or [{}])[0]
    custom_id = pu.get("custom_id")
    amount = None
    currency_code = None
    captures = (pu.get("payments") or {}).get("captures") or []
    if captures:
        # When a capture exists, ITS status is the truth. An eCheck/on-hold
        # payment yields order-level COMPLETED with capture status PENDING and
        # may still bounce, so the order-level field must never promote it.
        cap = captures[0]
        completed = cap.get("status") == "COMPLETED"
        amt = cap.get("amount") or {}
        amount = amt.get("value")
        currency_code = amt.get("currency_code")
        custom_id = cap.get("custom_id") or custom_id
    else:
        # No capture at all -> nothing was paid, whatever the order says.
        completed = False
        amt = pu.get("amount") or {}
        amount = amt.get("value")
        currency_code = amt.get("currency_code")
    # The order-level status must NEVER leak through as "COMPLETED" when the
    # capture itself is not: report the capture's own status in that case.
    if completed:
        status_str = "COMPLETED"
    elif captures:
        status_str = captures[0].get("status") or "UNKNOWN"
    else:
        status_str = data.get("status") or "UNKNOWN"
        if status_str == "COMPLETED":
            status_str = "NOT_CAPTURED"
    return {
        "status": status_str,
        "amount": amount,
        "currency": currency_code,
        "custom_id": custom_id,
    }
