from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Dict, Any, Optional

class PaymentGatewayProvider(ABC):
    """
    Abstract interface for payment gateway providers (Razorpay, Stripe).
    Ensures unified contract for order creation, payment verification, and webhook handling.
    """

    @abstractmethod
    def create_order(
        self,
        invoice_id: int,
        invoice_number: str,
        amount: Decimal,
        currency: str,
        customer_name: str,
        customer_email: str
    ) -> Dict[str, Any]:
        """Create a payment order/intent with the gateway."""
        pass

    @abstractmethod
    def verify_payment_signature(
        self,
        order_id: str,
        payment_id: str,
        signature: Optional[str]
    ) -> bool:
        """Verify client-side checkout signature."""
        pass

    @abstractmethod
    def verify_webhook_signature(
        self,
        raw_body: str,
        signature_header: str
    ) -> bool:
        """Verify gateway webhook payload authenticity via HMAC-SHA256."""
        pass

    @abstractmethod
    def parse_webhook_event(
        self,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Standardize webhook payload into uniform event structure:
        {
            "event_type": str,
            "success": bool,
            "invoice_id": Optional[int],
            "order_id": str,
            "payment_id": str,
            "amount": Decimal,
            "currency": str,
            "transaction_reference": str,
            "failure_reason": Optional[str]
        }
        """
        pass
