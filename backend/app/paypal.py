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


# PayPal products: the AI referee, plus the coin bundles. Cosmetics (buzzers,
# avatar packs) are bought with COINS now, not PayPal, so they are not here.
PRODUCTS = {
    "ai": {"env": "PENNEER_PRICE", "default": "3.99", "desc": "Pen Neer scheidsrechter"},
    "coins100": {"env": "PENNEER_COINS100_PRICE", "default": "0.99", "desc": "Pen Neer 100 coins"},
    "coins300": {"env": "PENNEER_COINS300_PRICE", "default": "2.49", "desc": "Pen Neer 300 coins"},
    "coins500": {"env": "PENNEER_COINS500_PRICE", "default": "3.99", "desc": "Pen Neer 500 coins"},
    "coins1000": {"env": "PENNEER_COINS1000_PRICE", "default": "6.99", "desc": "Pen Neer 1000 coins"},
    "coins1800": {"env": "PENNEER_COINS1800_PRICE", "default": "11.99", "desc": "Pen Neer 1800 coins"},
    "coins3000": {"env": "PENNEER_COINS3000_PRICE", "default": "17.99", "desc": "Pen Neer 3000 coins"},
    "coins5000": {"env": "PENNEER_COINS5000_PRICE", "default": "27.99", "desc": "Pen Neer 5000 coins"},
    "coins8000": {"env": "PENNEER_COINS8000_PRICE", "default": "39.99", "desc": "Pen Neer 8000 coins"},
    "coins12000": {"env": "PENNEER_COINS12000_PRICE", "default": "54.99", "desc": "Pen Neer 12000 coins"},
    "cash100": {"env": "PENNEER_CASH100_PRICE", "default": "1.99", "desc": "Pen Neer 100 cash"},
    "cash250": {"env": "PENNEER_CASH250_PRICE", "default": "3.99", "desc": "Pen Neer 250 cash"},
    "cash600": {"env": "PENNEER_CASH600_PRICE", "default": "7.99", "desc": "Pen Neer 600 cash"},
    "cash1200": {"env": "PENNEER_CASH1200_PRICE", "default": "13.99", "desc": "Pen Neer 1200 cash"},
    "cash2000": {"env": "PENNEER_CASH2000_PRICE", "default": "21.99", "desc": "Pen Neer 2000 cash"},
    "cash3500": {"env": "PENNEER_CASH3500_PRICE", "default": "34.99", "desc": "Pen Neer 3500 cash"},
    "cash5500": {"env": "PENNEER_CASH5500_PRICE", "default": "49.99", "desc": "Pen Neer 5500 cash"},
    "cash8000": {"env": "PENNEER_CASH8000_PRICE", "default": "69.99", "desc": "Pen Neer 8000 cash"},
    "cash12000": {"env": "PENNEER_CASH12000_PRICE", "default": "94.99", "desc": "Pen Neer 12000 cash"},
}
# Twee ladders van negen. Coins zijn de dagelijkse munt, cash de zeldzame, dus
# cash kost per stuk meer. De eerste zes tonen de STAPEL en de laatste drie de
# ZAK: de zak is de grote koop, en dat verschil moet je aan de tegel zien
# zonder de cijfers te lezen.
COIN_BUNDLES = [("coins100", 100), ("coins300", 300), ("coins500", 500), ("coins1000", 1000), ("coins1800", 1800), ("coins3000", 3000), ("coins5000", 5000), ("coins8000", 8000), ("coins12000", 12000)]
CASH_BUNDLES = [("cash100", 100), ("cash250", 250), ("cash600", 600), ("cash1200", 1200), ("cash2000", 2000), ("cash3500", 3500), ("cash5500", 5500), ("cash8000", 8000), ("cash12000", 12000)]
BUNDLES = (
    [("coins%d" % n, n, 0) for n in [100, 300, 500, 1000, 1800, 3000, 5000, 8000, 12000]]
    + [("cash%d" % n, 0, n) for n in [100, 250, 600, 1200, 2000, 3500, 5500, 8000, 12000]]
)


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
        "currency": currency(),
        "env": _env(),
        # coin bundles: [{product, coins, price}] in display order
        "bundles": [{"product": pid, "coins": n, "price": price(pid)} for pid, n in COIN_BUNDLES],
        # negen coins en negen cash, elk met hun eigen prijs
        "coin_bundles": [{"product": pid, "coins": n, "price": price(pid)} for pid, n in COIN_BUNDLES],
        "cash_bundles": [{"product": pid, "cash": n, "price": price(pid)} for pid, n in CASH_BUNDLES],
        "producten": [
            {"product": pid, "coins": c, "cash": k, "price": price(pid)} for pid, c, k in BUNDLES
        ],
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
