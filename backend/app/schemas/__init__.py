from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime
from decimal import Decimal

# ----------------- AUTH & USER SCHEMAS -----------------
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "customer"  # admin, staff, customer
    phone: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    phone: Optional[str] = None

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    email: EmailStr
    new_password: str

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    status: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    customer_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# ----------------- PRODUCT & VARIANT SCHEMAS -----------------
class ProductVariantBase(BaseModel):
    name: str
    sku: str
    additional_price: Decimal = Decimal("0.00")
    status: str = "active"

class ProductVariantCreate(ProductVariantBase):
    pass

class ProductVariantOut(ProductVariantBase):
    id: int
    product_id: int
    created_at: datetime
    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    product_type: str = "recurring_service"
    sku: str
    sales_price: Decimal = Decimal("0.00")
    cost_price: Decimal = Decimal("0.00")
    image_url: Optional[str] = None
    notes: Optional[str] = None
    status: str = "active"

class ProductCreate(ProductBase):
    variants: Optional[List[ProductVariantCreate]] = []

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    product_type: Optional[str] = None
    sales_price: Optional[Decimal] = None
    cost_price: Optional[Decimal] = None
    image_url: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class ProductOut(ProductBase):
    id: int
    variants: List[ProductVariantOut] = []
    created_at: datetime
    updated_at: datetime
    version: int
    class Config:
        from_attributes = True

# ----------------- PLAN SCHEMAS -----------------
class PlanBase(BaseModel):
    name: str
    product_id: int
    billing_interval: str = "monthly"  # daily, weekly, monthly, yearly
    base_price: Decimal = Decimal("0.00")
    min_quantity: int = 1
    max_quantity: int = 1000
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    description: Optional[str] = None
    auto_close: bool = False
    allow_early_closure: bool = True
    allow_pause: bool = True
    allow_renewal: bool = True
    status: str = "active"

class PlanCreate(PlanBase):
    pass

class PlanUpdate(BaseModel):
    name: Optional[str] = None
    billing_interval: Optional[str] = None
    base_price: Optional[Decimal] = None
    min_quantity: Optional[int] = None
    max_quantity: Optional[int] = None
    description: Optional[str] = None
    auto_close: Optional[bool] = None
    allow_early_closure: Optional[bool] = None
    allow_pause: Optional[bool] = None
    allow_renewal: Optional[bool] = None
    status: Optional[str] = None

class PlanOut(PlanBase):
    id: int
    product_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# ----------------- CUSTOMER SCHEMAS -----------------
class CustomerBase(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    company_name: Optional[str] = None
    tax_id: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    currency: str = "INR"
    notes: Optional[str] = None
    status: str = "active"

class CustomerCreate(CustomerBase):
    user_id: Optional[int] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    tax_id: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class CustomerOut(CustomerBase):
    id: int
    user_id: Optional[int] = None
    outstanding_balance: Decimal
    created_at: datetime
    updated_at: datetime
    version: int
    class Config:
        from_attributes = True

# ----------------- TAX & DISCOUNT SCHEMAS -----------------
class TaxRuleCreate(BaseModel):
    name: str
    rate_percentage: Decimal
    is_compound: bool = False
    tax_type: str = "gst"
    is_active: bool = True

class TaxRuleOut(TaxRuleCreate):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class DiscountRuleCreate(BaseModel):
    code: str
    name: str
    discount_type: str = "percentage"  # percentage, fixed
    value: Decimal
    min_purchase_amount: Decimal = Decimal("0.00")
    min_quantity: int = 1
    start_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    max_usage_count: int = 100
    product_id: Optional[int] = None
    subscription_wide: bool = True
    is_active: bool = True

class DiscountRuleOut(DiscountRuleCreate):
    id: int
    current_usage_count: int
    created_at: datetime
    class Config:
        from_attributes = True

# ----------------- QUOTATION SCHEMAS -----------------
class QuotationItemCreate(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    plan_id: Optional[int] = None
    description: str
    quantity: int = 1
    unit_price: Decimal
    tax_rate: Decimal = Decimal("0.00")
    discount_amount: Decimal = Decimal("0.00")

class QuotationItemOut(QuotationItemCreate):
    id: int
    total_price: Decimal
    class Config:
        from_attributes = True

class QuotationCreate(BaseModel):
    customer_id: int
    template_id: Optional[int] = None
    valid_until: datetime
    items: List[QuotationItemCreate]
    notes: Optional[str] = None
    terms: Optional[str] = None

class QuotationOut(BaseModel):
    id: int
    quotation_number: str
    customer_id: int
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    status: str
    valid_until: datetime
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    notes: Optional[str] = None
    terms: Optional[str] = None
    items: List[QuotationItemOut] = []
    created_at: datetime
    updated_at: datetime
    version: int
    class Config:
        from_attributes = True

# ----------------- SUBSCRIPTION SCHEMAS -----------------
class SubscriptionItemCreate(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    description: str
    quantity: int = 1
    unit_price: Decimal
    tax_rate: Decimal = Decimal("0.00")
    discount_amount: Decimal = Decimal("0.00")

class SubscriptionItemOut(SubscriptionItemCreate):
    id: int
    total_price: Decimal
    class Config:
        from_attributes = True

class SubscriptionTimelineOut(BaseModel):
    id: int
    event_type: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    description: str
    performed_by_name: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class SubscriptionCreate(BaseModel):
    customer_id: int
    plan_id: Optional[int] = None
    quotation_id: Optional[int] = None
    start_date: datetime
    billing_interval: str = "monthly"
    payment_terms: str = "immediate"
    auto_renew: bool = True
    allow_pause: bool = True
    allow_early_closure: bool = True
    discount_code: Optional[str] = None
    items: List[SubscriptionItemCreate]
    notes: Optional[str] = None

class SubscriptionUpdate(BaseModel):
    plan_id: Optional[int] = None
    status: Optional[str] = None
    auto_renew: Optional[bool] = None
    notes: Optional[str] = None

class SubscriptionAction(BaseModel):
    action: str  # confirm, pause, resume, cancel, close, renew, upgrade
    reason: Optional[str] = None
    new_plan_id: Optional[int] = None

class SubscriptionOut(BaseModel):
    id: int
    subscription_number: str
    customer_id: int
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    plan_id: Optional[int] = None
    plan_name: Optional[str] = None
    status: str
    start_date: datetime
    expiry_date: Optional[datetime] = None
    current_period_start: datetime
    current_period_end: datetime
    next_billing_date: datetime
    billing_interval: str
    payment_terms: str
    auto_renew: bool
    allow_pause: bool
    allow_early_closure: bool
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    currency: str
    notes: Optional[str] = None
    items: List[SubscriptionItemOut] = []
    timeline: List[SubscriptionTimelineOut] = []
    created_at: datetime
    updated_at: datetime
    version: int
    class Config:
        from_attributes = True

# ----------------- INVOICE SCHEMAS -----------------
class InvoiceItemCreate(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    description: str
    quantity: int = 1
    unit_price: Decimal
    tax_rate: Decimal = Decimal("0.00")
    discount_amount: Decimal = Decimal("0.00")

class InvoiceItemOut(InvoiceItemCreate):
    id: int
    total_price: Decimal
    class Config:
        from_attributes = True

class InvoiceCreate(BaseModel):
    customer_id: int
    subscription_id: Optional[int] = None
    invoice_date: datetime
    due_date: datetime
    period_start: datetime
    period_end: datetime
    items: List[InvoiceItemCreate]
    notes: Optional[str] = None

class InvoiceOut(BaseModel):
    id: int
    invoice_number: str
    customer_id: int
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    company_name: Optional[str] = None
    tax_id: Optional[str] = None
    billing_address: Optional[str] = None
    subscription_id: Optional[int] = None
    subscription_number: Optional[str] = None
    status: str
    invoice_date: datetime
    due_date: datetime
    period_start: datetime
    period_end: datetime
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    notes: Optional[str] = None
    items: List[InvoiceItemOut] = []
    created_at: datetime
    updated_at: datetime
    version: int
    class Config:
        from_attributes = True

# ----------------- PAYMENT SCHEMAS -----------------
class PaymentCreate(BaseModel):
    invoice_id: Optional[int] = None
    customer_id: int
    payment_method: str = "bank_transfer"  # cash, bank_transfer, upi, card, other
    amount: Decimal
    payment_date: datetime
    transaction_reference: Optional[str] = None
    notes: Optional[str] = None
    gateway_provider: Optional[str] = None
    gateway_order_id: Optional[str] = None
    gateway_payment_id: Optional[str] = None
    gateway_signature: Optional[str] = None

class PaymentAllocationOut(BaseModel):
    id: int
    invoice_id: int
    invoice_number: Optional[str] = None
    allocated_amount: Decimal
    class Config:
        from_attributes = True

class PaymentOut(BaseModel):
    id: int
    payment_number: str
    invoice_id: Optional[int] = None
    invoice_number: Optional[str] = None
    customer_id: int
    customer_name: Optional[str] = None
    payment_method: str
    amount: Decimal
    payment_date: datetime
    transaction_reference: Optional[str] = None
    notes: Optional[str] = None
    status: str
    gateway_provider: Optional[str] = None
    gateway_order_id: Optional[str] = None
    gateway_payment_id: Optional[str] = None
    allocations: List[PaymentAllocationOut] = []
    created_at: datetime
    class Config:
        from_attributes = True

class ReconciliationRequest(BaseModel):
    payment_id: int
    invoice_id: int
    amount: Decimal

# ----------------- PAYMENT GATEWAY SANDBOX SCHEMAS -----------------
class GatewayConfigOut(BaseModel):
    gateway_mode: str  # sandbox, live
    razorpay_enabled: bool = True
    razorpay_key_id: str
    stripe_enabled: bool = True
    stripe_publishable_key: str

class GatewayCreateOrderRequest(BaseModel):
    invoice_id: int
    provider: str  # razorpay, stripe
    amount: Optional[Decimal] = None

class GatewayOrderResponse(BaseModel):
    order_id: str
    amount: Decimal
    currency: str
    provider: str
    invoice_id: int
    invoice_number: str
    customer_name: str
    customer_email: str
    publishable_key: str
    notes: Optional[str] = None

class GatewayVerifyPaymentRequest(BaseModel):
    provider: str  # razorpay, stripe
    invoice_id: int
    order_id: str
    payment_id: str
    signature: Optional[str] = None

class GatewaySimulateWebhookRequest(BaseModel):
    provider: str  # razorpay, stripe
    event_type: str  # payment.captured, payment.failed, payment_intent.succeeded, payment_intent.payment_failed
    invoice_id: int
    amount: Optional[Decimal] = None
    simulate_signature_failure: bool = False

class GatewaySimulateWebhookResponse(BaseModel):
    success: bool
    event: str
    signature_valid: bool
    reconciled: bool
    invoice_status: str
    payment_id: Optional[int] = None
    payment_number: Optional[str] = None
    message: str


# ----------------- OFFLINE SYNC SCHEMAS -----------------
class SyncMutation(BaseModel):
    client_mutation_id: str
    entity_type: str  # customer, product, quotation, subscription, invoice, payment
    action: str  # create, update, delete
    client_version: Optional[int] = 1
    payload: dict

class SyncBatchRequest(BaseModel):
    mutations: List[SyncMutation]

class SyncBatchResponse(BaseModel):
    success_count: int
    conflict_count: int
    results: List[dict]

class ConflictResolveRequest(BaseModel):
    client_mutation_id: str
    resolution_choice: str  # keep_client, keep_server, manual_merge
    merged_payload: Optional[dict] = None

# ----------------- SETTINGS & BILLING ENGINE SCHEMAS -----------------
class SettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    company_email: Optional[str] = None
    company_phone: Optional[str] = None
    company_address: Optional[str] = None
    tax_id: Optional[str] = None
    currency: Optional[str] = None
    currency_symbol: Optional[str] = None
    auto_billing_enabled: Optional[bool] = None
    grace_period_days: Optional[int] = None
    gateway_mode: Optional[str] = None
    razorpay_key_id: Optional[str] = None
    razorpay_key_secret: Optional[str] = None
    razorpay_webhook_secret: Optional[str] = None
    stripe_publishable_key: Optional[str] = None
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None

class SettingsOut(BaseModel):
    id: int
    company_name: str
    company_email: str
    company_phone: str
    company_address: str
    tax_id: str
    currency: str
    currency_symbol: str
    auto_billing_enabled: bool
    grace_period_days: int
    gateway_mode: str = "sandbox"
    razorpay_key_id: str = "rzp_test_brightloop123"
    razorpay_key_secret: str = "rzp_secret_sandbox999"
    razorpay_webhook_secret: str = "whsec_rzp_sandbox"
    stripe_publishable_key: str = "pk_test_brightloop_stripe"
    stripe_secret_key: str = "sk_test_brightloop_stripe_sec"
    stripe_webhook_secret: str = "whsec_stripe_sandbox"
    class Config:
        from_attributes = True

class BillingRunResult(BaseModel):
    subscriptions_processed: int
    invoices_generated: int
    total_billed: Decimal
    errors_count: int
    execution_log: str

# ----------------- ANALYTICS SCHEMAS -----------------
class DashboardKPIs(BaseModel):
    total_customers: int
    total_subscriptions: int
    active_subscriptions: int
    new_subscriptions_month: int
    mrr: Decimal
    arr: Decimal
    revenue_collected: Decimal
    outstanding_revenue: Decimal
    overdue_invoices_count: int
    upcoming_renewals_count: int
    churn_rate: Decimal
    arpu: Decimal

class RevenueTrendItem(BaseModel):
    month: str
    collected: Decimal
    invoiced: Decimal

class PlanDistributionItem(BaseModel):
    name: str
    count: int
    revenue: Decimal

class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    link: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class AuditLogOut(BaseModel):
    id: int
    entity_type: str
    entity_id: Optional[int] = None
    action: str
    details: Optional[str] = None
    user_email: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True
