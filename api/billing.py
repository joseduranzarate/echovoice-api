"""Stripe billing — Checkout + Customer Portal session creation.

Webhook handler lives in `webhooks.py` (separate to make the verify-then-route
boundary obvious). All DB writes funnel through `db.py` helpers.
"""

import os
from typing import Optional

import stripe

from db import _client

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")

STRIPE_PRICE_PREMIUM = os.environ.get("STRIPE_PRICE_PREMIUM", "")

# Where Stripe sends users after Checkout. The frontend's success page reads
# session_id from the URL to display a confirmation; the webhook is the
# source of truth for actually flipping the plan.
WEB_URL = os.environ.get("WEB_URL", "http://localhost:3001")


def _get_or_create_customer(user_id: str, email: Optional[str] = None) -> str:
    """Return the Stripe customer_id for this user, creating it if needed.

    Stored in the `subscriptions` table, which already has a one-row-per-user
    shape. We create the row on first-checkout so users without a sub never
    occupy space.
    """
    row = (
        _client()
        .table("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user_id)
        .execute()
    )
    if row.data and row.data[0]["stripe_customer_id"]:
        return row.data[0]["stripe_customer_id"]

    customer = stripe.Customer.create(
        email=email,
        metadata={"clerk_user_id": user_id},
    )

    # Upsert — status starts as 'incomplete' until the webhook flips it.
    _client().table("subscriptions").upsert(
        {
            "user_id": user_id,
            "stripe_customer_id": customer.id,
            "status": "incomplete",
        },
        on_conflict="user_id",
    ).execute()

    return customer.id


def create_checkout_session(user_id: str, email: Optional[str] = None) -> str:
    """Return the Stripe-hosted Checkout URL."""
    customer_id = _get_or_create_customer(user_id, email)

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": STRIPE_PRICE_PREMIUM, "quantity": 1}],
        success_url=f"{WEB_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{WEB_URL}/paywall",
        client_reference_id=user_id,
        metadata={"clerk_user_id": user_id},
    )
    return session.url


def create_portal_session(user_id: str) -> str:
    """Return the Stripe Customer Portal URL for managing/cancelling."""
    row = (
        _client()
        .table("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    customer_id = row.data["stripe_customer_id"]
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{WEB_URL}/settings",
    )
    return session.url
