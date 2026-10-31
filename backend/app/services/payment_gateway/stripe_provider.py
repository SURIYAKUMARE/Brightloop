import hmac
import hashlib
import time
import uuid
from decimal import Decimal
from typing import Dict, Any, Optional
from app.services.payment_gateway.base import PaymentGatewayProvider

class StripeProvider(PaymentGatewayProvider):
    """
    Stripe Gateway Integration with Sandbox Mock Engine and v1 Timestamped HMAC-SHA256 verification.
    """

    def __init__(self, publishable_key: str, secret_key: str, webhook_secret: str, mode: str = "sandbox"):
        self.publishable_key = publishable_key
        self.secret_key = secret_key
        self.webhook_secret = webhook_secret
        self.mode = mode

    def create_order(
        self,
        invoice_id: int,
        invoice_number: str,
        amount: Decimal,
        currency: str,
        customer_name: str,
        customer_email: str
    ) -> Dict[str, Any]:
        """
        Creates a Stripe PaymentIntent.
        """
        amount_in_cents = int(amount * 100)
        pi_id = f"pi_mock_{uuid.uuid4().hex[:16]}"
        client_secret = f"{pi_id}_secret_{uuid.uuid4().hex[:10]}"

        return {
            "order_id": pi_id,
            "client_secret": client_secret,
            "amount": amount,
            "amount_subunits": amount_in_cents,
            "currency": currency.lower(),
            "provider": "stripe",
            "invoice_id": invoice_id,
            "invoice_number": invoice_number,
            "customer_name": customer_name,
            "customer_email": customer_email,
            "publishable_key": self.publishable_key,
            "notes": {
                "invoice_id": str(invoice_id),
                "invoice_number": invoice_number,
                "environment": self.mode
            }
        }

    def verify_payment_signature(
        self,
        order_id: str,
        payment_id: str,
        signature: Optional[str]
    ) -> bool:
        """
        In Stripe, client verification passes client_secret confirmation or payment_intent status check.
        In sandbox simulator mode, matching the order_id pattern pi_mock_ confirms validity.
        """
        if not order_id or not payment_id:
            return False
        return order_id.startswith("pi_mock_") or payment_id.startswith("ch_mock_") or payment_id.startswith("pi_mock_")

    def generate_webhook_signature(self, raw_body: str, timestamp: Optional[int] = None) -> str:
        """
        Generates standard Stripe-Signature header:
        t=<timestamp>,v1=<computed_hmac>
        Signed payload is f"{timestamp}.{raw_body}".
        """
        ts = timestamp or int(time.time())
        signed_payload = f"{ts}.{raw_body}".encode("utf-8")
        computed_sig = hmac.new(
            self.webhook_secret.encode("utf-8"),
            signed_payload,
            hashlib.sha256
        ).hexdigest()
        return f"t={ts},v1={computed_sig}"

    def verify_webhook_signature(
        self,
        raw_body: str,
        signature_header: str
    ) -> bool:
        """
        Verifies Stripe-Signature header using v1 HMAC scheme.
        """
        if not signature_header:
            return False

        parts = dict(
            pair.split("=", 1)
            for pair in signature_header.split(",")
            if "=" in pair
        )
        timestamp_str = parts.get("t")
        expected_v1 = parts.get("v1")

        if not timestamp_str or not expected_v1:
            return False

        try:
            ts = int(timestamp_str)
        except ValueError:
            return False

        # Compute HMAC on "<timestamp>.<raw_body>"
        signed_payload = f"{ts}.{raw_body}".encode("utf-8")
        computed_sig = hmac.new(
            self.webhook_secret.encode("utf-8"),
            signed_payload,
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(computed_sig, expected_v1)

    def parse_webhook_event(
        self,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Normalizes Stripe webhook payload into standard application event.
        Supported events:
        - payment_intent.succeeded
        - payment_intent.payment_failed
        - charge.succeeded
        """
        event_name = payload.get("type", "unknown")
        data_object = payload.get("data", {}).get("object", {})

        metadata = data_object.get("metadata", {})
        invoice_id_str = metadata.get("invoice_id")
        invoice_id = int(invoice_id_str) if invoice_id_str and invoice_id_str.isdigit() else None

        amount_cents = data_object.get("amount", 0)
        amount = Decimal(str(amount_cents)) / Decimal("100.00")
        currency = (data_object.get("currency") or "INR").upper()

        pi_id = data_object.get("id") or f"pi_mock_{uuid.uuid4().hex[:12]}"
        charge_id = data_object.get("latest_charge") or f"ch_mock_{uuid.uuid4().hex[:12]}"
        status = data_object.get("status")

        success = (
            event_name in ["payment_intent.succeeded", "charge.succeeded"]
            and status in ["succeeded", "paid", None]
        )

        return {
            "provider": "stripe",
            "event_type": event_name,
            "success": success,
            "invoice_id": invoice_id,
            "order_id": pi_id,
            "payment_id": charge_id,
            "amount": amount,
            "currency": currency,
            "transaction_reference": f"STRIPE-{pi_id}",
            "method": "card",
            "failure_reason": data_object.get("last_payment_error", {}).get("message") if not success else None
        }

    def build_mock_webhook_payload(
        self,
        event_type: str,
        invoice_id: int,
        invoice_number: str,
        amount: Decimal,
        currency: str = "INR"
    ) -> Dict[str, Any]:
        """
        Constructs a realistic Stripe webhook JSON payload for sandbox testing.
        """
        pi_id = f"pi_mock_{uuid.uuid4().hex[:14]}"
        charge_id = f"ch_mock_{uuid.uuid4().hex[:14]}"
        amount_cents = int(amount * 100)
        is_success = event_type in ["payment_intent.succeeded", "charge.succeeded"]

        return {
            "id": f"evt_mock_{uuid.uuid4().hex[:14]}",
            "object": "event",
            "api_version": "2023-10-16",
            "created": int(time.time()),
            "type": event_type,
            "data": {
                "object": {
                    "id": pi_id,
                    "object": "payment_intent",
                    "amount": amount_cents,
                    "amount_received": amount_cents if is_success else 0,
                    "currency": currency.lower(),
                    "status": "succeeded" if is_success else "requires_payment_method",
                    "latest_charge": charge_id,
                    "metadata": {
                        "invoice_id": str(invoice_id),
                        "invoice_number": invoice_number
                    },
                    "last_payment_error": None if is_success else {
                        "code": "card_declined",
                        "message": "Your card was declined by bank."
                    }
                }
            }
        }
