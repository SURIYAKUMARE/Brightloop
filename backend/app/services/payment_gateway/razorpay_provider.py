import hmac
import hashlib
import time
import uuid
from decimal import Decimal
from typing import Dict, Any, Optional
from app.services.payment_gateway.base import PaymentGatewayProvider

class RazorpayProvider(PaymentGatewayProvider):
    """
    Razorpay Gateway Integration with Sandbox Mock Engine and HMAC-SHA256 signature verification.
    """

    def __init__(self, key_id: str, key_secret: str, webhook_secret: str, mode: str = "sandbox"):
        self.key_id = key_id
        self.key_secret = key_secret
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
        Creates a Razorpay order. In sandbox mode, generates a verified order payload
        with standard paise conversion (1 INR = 100 paise).
        """
        amount_in_subunits = int(amount * 100)
        order_id = f"order_rzp_{uuid.uuid4().hex[:14]}"

        # In production, this would call razorpay client: client.order.create(...)
        # In sandbox mode, it returns the compliant contract structure.
        return {
            "order_id": order_id,
            "amount": amount,
            "amount_subunits": amount_in_subunits,
            "currency": currency,
            "provider": "razorpay",
            "invoice_id": invoice_id,
            "invoice_number": invoice_number,
            "customer_name": customer_name,
            "customer_email": customer_email,
            "publishable_key": self.key_id,
            "notes": {
                "invoice_id": str(invoice_id),
                "invoice_number": invoice_number,
                "environment": self.mode
            }
        }

    def generate_payment_signature(self, order_id: str, payment_id: str) -> str:
        """Helper to generate valid Razorpay checkout HMAC-SHA256 signature."""
        msg = f"{order_id}|{payment_id}".encode("utf-8")
        return hmac.new(self.key_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    def verify_payment_signature(
        self,
        order_id: str,
        payment_id: str,
        signature: Optional[str]
    ) -> bool:
        """
        Verify Razorpay client-side signature:
        HMAC-SHA256(order_id + '|' + payment_id, secret) == signature
        """
        if not signature:
            return False
        expected_sig = self.generate_payment_signature(order_id, payment_id)
        return hmac.compare_digest(expected_sig, signature)

    def generate_webhook_signature(self, raw_body: str) -> str:
        """Helper to calculate HMAC-SHA256 signature for Razorpay webhook simulation."""
        return hmac.new(
            self.webhook_secret.encode("utf-8"),
            raw_body.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

    def verify_webhook_signature(
        self,
        raw_body: str,
        signature_header: str
    ) -> bool:
        """
        Verifies X-Razorpay-Signature header against body HMAC.
        """
        if not signature_header:
            return False
        expected_sig = self.generate_webhook_signature(raw_body)
        return hmac.compare_digest(expected_sig, signature_header)

    def parse_webhook_event(
        self,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Normalizes Razorpay webhook payload into standard application event.
        Supported events:
        - payment.captured
        - payment.failed
        - order.paid
        """
        event_name = payload.get("event", "unknown")
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        order_entity = payload.get("payload", {}).get("order", {}).get("entity", {})

        notes = payment_entity.get("notes") or order_entity.get("notes") or {}
        invoice_id_str = notes.get("invoice_id")
        invoice_id = int(invoice_id_str) if invoice_id_str and invoice_id_str.isdigit() else None

        amount_paise = payment_entity.get("amount") or order_entity.get("amount") or 0
        amount = Decimal(str(amount_paise)) / Decimal("100.00")
        currency = payment_entity.get("currency") or "INR"

        order_id = payment_entity.get("order_id") or order_entity.get("id") or f"order_unknown"
        payment_id = payment_entity.get("id") or f"pay_rzp_{uuid.uuid4().hex[:12]}"
        status = payment_entity.get("status")

        success = (event_name in ["payment.captured", "order.paid"] and status in ["captured", "paid", None])

        return {
            "provider": "razorpay",
            "event_type": event_name,
            "success": success,
            "invoice_id": invoice_id,
            "order_id": order_id,
            "payment_id": payment_id,
            "amount": amount,
            "currency": currency,
            "transaction_reference": f"RZP-{payment_id}",
            "method": payment_entity.get("method", "upi"),
            "failure_reason": payment_entity.get("error_description") if not success else None
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
        Constructs a realistic Razorpay webhook JSON payload for sandbox testing.
        """
        order_id = f"order_rzp_{uuid.uuid4().hex[:12]}"
        payment_id = f"pay_rzp_{uuid.uuid4().hex[:12]}"
        amount_paise = int(amount * 100)
        is_success = event_type in ["payment.captured", "order.paid"]

        return {
            "entity": "event",
            "account_id": "acc_brightloop_test",
            "event": event_type,
            "contains": ["payment", "order"],
            "payload": {
                "payment": {
                    "entity": {
                        "id": payment_id,
                        "entity": "payment",
                        "amount": amount_paise,
                        "currency": currency,
                        "status": "captured" if is_success else "failed",
                        "order_id": order_id,
                        "method": "upi",
                        "description": f"Payment for Invoice {invoice_number}",
                        "notes": {
                            "invoice_id": str(invoice_id),
                            "invoice_number": invoice_number
                        },
                        "error_code": None if is_success else "BAD_REQUEST_ERROR",
                        "error_description": None if is_success else "Payment was declined by issuing bank",
                        "created_at": int(time.time())
                    }
                },
                "order": {
                    "entity": {
                        "id": order_id,
                        "entity": "order",
                        "amount": amount_paise,
                        "currency": currency,
                        "status": "paid" if is_success else "attempted",
                        "notes": {
                            "invoice_id": str(invoice_id),
                            "invoice_number": invoice_number
                        }
                    }
                }
            },
            "created_at": int(time.time())
        }
