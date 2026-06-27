"""Stripe webhook handler. Verifies signature, then routes by event type.

Source of truth for the user's plan — Checkout success alone is NOT enough,
because cards can fail later. We trust `customer.subscription.*` events.
"""

import os

import stripe
from fastapi import HTTPException, Request

from db import _client

STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# Stripe statuses that grant Premium access. Trialing counts (we don't run
# trials today, but if we ever do, the user should have access).
ACTIVE_STATUSES = {"active", "trialing"}


async def handle_stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="bad signature")
    except ValueError:
        raise HTTPException(status_code=400, detail="bad payload")

    etype = event["type"]
    data = event["data"]["object"]

    if etype == "checkout.session.completed":
        _on_checkout_completed(data)
    elif etype in (
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        _on_subscription_change(data)
    # Other events (invoice.*, payment_intent.*) we just ack — Stripe retries
    # the ones that matter via subscription.updated.

    return {"received": True}


def _on_checkout_completed(session: dict) -> None:
    """Stitch the Stripe customer back to our user_id and mark plan=premium.

    Subscription details are filled in by the subsequent subscription.created
    event — here we only need to link the customer to the user (via
    client_reference_id) so future subscription events resolve.
    """
    user_id = session.get("client_reference_id") or (
        session.get("metadata") or {}
    ).get("clerk_user_id")
    customer_id = session.get("customer")
    subscription_id = session.get("subscription")

    if not user_id or not customer_id:
        return  # malformed — nothing we can do

    _client().table("subscriptions").upsert(
        {
            "user_id": user_id,
            "stripe_customer_id": customer_id,
            "stripe_subscription_id": subscription_id,
            "status": "active",  # provisional; subscription.updated will confirm
        },
        on_conflict="user_id",
    ).execute()
    _client().table("users").update({"plan": "premium"}).eq("id", user_id).execute()


def _on_subscription_change(sub: dict) -> None:
    """Flip users.plan based on the subscription status."""
    customer_id = sub.get("customer")
    status = sub.get("status", "")
    subscription_id = sub.get("id")
    period_end = sub.get("current_period_end")  # unix ts

    # Look up the user via the customer_id we stored during checkout.
    row = (
        _client()
        .table("subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", customer_id)
        .execute()
    )
    if not row.data:
        return  # webhook for a customer we don't know — ignore
    user_id = row.data[0]["user_id"]

    update = {
        "user_id": user_id,
        "stripe_customer_id": customer_id,
        "stripe_subscription_id": subscription_id,
        "status": status,
    }
    if period_end:
        from datetime import datetime, timezone
        update["current_period_end"] = datetime.fromtimestamp(
            period_end, tz=timezone.utc
        ).isoformat()

    _client().table("subscriptions").upsert(update, on_conflict="user_id").execute()

    plan = "premium" if status in ACTIVE_STATUSES else "free"
    _client().table("users").update({"plan": plan}).eq("id", user_id).execute()
