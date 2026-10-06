from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth.deps import get_current_user
from app.core.config import get_settings
from app.models.models import User

router = APIRouter(prefix="/billing", tags=["billing"])
settings = get_settings()


@router.get("/status")
async def billing_status():
    return {"configured": settings.billing_configured, "price_id_pro": settings.stripe_price_id_pro}


@router.post("/checkout-session")
async def create_checkout_session(user: User = Depends(get_current_user)):
    if not settings.billing_configured:
        raise HTTPException(status_code=501, detail="Billing isn't configured yet (missing STRIPE_SECRET_KEY)")

    import stripe

    stripe.api_key = settings.stripe_secret_key
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": settings.stripe_price_id_pro, "quantity": 1}],
        success_url=f"{settings.web_base_url}/dashboard/settings?upgraded=1",
        cancel_url=f"{settings.web_base_url}/dashboard/settings",
        customer_email=user.email,
    )
    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    if not settings.billing_configured:
        raise HTTPException(status_code=501, detail="Billing isn't configured yet")

    import stripe

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except (ValueError, stripe.error.SignatureVerificationError) as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook signature") from exc

    # TODO: on `checkout.session.completed`, mark the corresponding User.plan = "pro".
    _ = event
    return {"received": True}
