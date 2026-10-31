import datetime
from decimal import Decimal
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Numeric, DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from app.database import Base

def now_utc():
    return datetime.datetime.now(datetime.timezone.utc)

# ----------------- USERS & AUTH -----------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="staff", nullable=False)  # admin, staff, customer
    status = Column(String(50), default="active", nullable=False)  # active, inactive
    phone = Column(String(50), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)

    customer_profile = relationship("Customer", back_populates="user", uselist=False)

# ----------------- CUSTOMERS -----------------
class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, unique=True)
    name = Column(String(255), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    company_name = Column(String(255), nullable=True)
    tax_id = Column(String(100), nullable=True)
    billing_address = Column(Text, nullable=True)
    shipping_address = Column(Text, nullable=True)
    currency = Column(String(10), default="INR", nullable=False)
    outstanding_balance = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    status = Column(String(50), default="active", nullable=False)  # active, inactive, archived
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    user = relationship("User", back_populates="customer_profile")
    subscriptions = relationship("Subscription", back_populates="customer")
    invoices = relationship("Invoice", back_populates="customer")
    quotations = relationship("Quotation", back_populates="customer")
    payments = relationship("Payment", back_populates="customer")

# ----------------- PRODUCTS & VARIANTS -----------------
class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    product_type = Column(String(50), default="recurring_service", nullable=False)  # service, digital, physical, recurring_license
    sku = Column(String(100), unique=True, index=True, nullable=False)
    sales_price = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    cost_price = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    image_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(50), default="active", nullable=False)  # active, archived
    created_at = Column(DateTime, default=now_utc, nullable=False)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    plans = relationship("SubscriptionPlan", back_populates="product")

class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)  # Standard, Odoo, Enterprise
    sku = Column(String(100), unique=True, nullable=False)
    additional_price = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    status = Column(String(50), default="active", nullable=False)
    created_at = Column(DateTime, default=now_utc, nullable=False)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)

    product = relationship("Product", back_populates="variants")

# ----------------- SUBSCRIPTION PLANS -----------------
class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    billing_interval = Column(String(50), default="monthly", nullable=False)  # daily, weekly, monthly, yearly
    base_price = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    min_quantity = Column(Integer, default=1, nullable=False)
    max_quantity = Column(Integer, default=1000, nullable=False)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    description = Column(Text, nullable=True)
    auto_close = Column(Boolean, default=False, nullable=False)
    allow_early_closure = Column(Boolean, default=True, nullable=False)
    allow_pause = Column(Boolean, default=True, nullable=False)
    allow_renewal = Column(Boolean, default=True, nullable=False)
    status = Column(String(50), default="active", nullable=False)  # active, inactive, archived
    created_at = Column(DateTime, default=now_utc, nullable=False)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)

    product = relationship("Product", back_populates="plans")
    subscriptions = relationship("Subscription", back_populates="plan")

# ----------------- TAX & DISCOUNT RULES -----------------
class TaxRule(Base):
    __tablename__ = "tax_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # e.g., GST 18%, VAT 5%, State Tax
    rate_percentage = Column(Numeric(5, 2), default=Decimal("18.00"), nullable=False)
    is_compound = Column(Boolean, default=False, nullable=False)
    tax_type = Column(String(50), default="gst", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=now_utc, nullable=False)

class DiscountRule(Base):
    __tablename__ = "discount_rules"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    discount_type = Column(String(50), default="percentage", nullable=False)  # percentage, fixed
    value = Column(Numeric(12, 2), default=Decimal("10.00"), nullable=False)
    min_purchase_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    min_quantity = Column(Integer, default=1, nullable=False)
    start_date = Column(DateTime, nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    max_usage_count = Column(Integer, default=100, nullable=False)
    current_usage_count = Column(Integer, default=0, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    subscription_wide = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=now_utc, nullable=False)

# ----------------- QUOTATIONS -----------------
class QuotationTemplate(Base):
    __tablename__ = "quotation_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    default_notes = Column(Text, nullable=True)
    default_terms = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=now_utc, nullable=False)

class Quotation(Base):
    __tablename__ = "quotations"

    id = Column(Integer, primary_key=True, index=True)
    quotation_number = Column(String(100), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    template_id = Column(Integer, ForeignKey("quotation_templates.id"), nullable=True)
    status = Column(String(50), default="draft", nullable=False)  # draft, sent, accepted, declined, converted
    valid_until = Column(DateTime, nullable=False)
    subtotal = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    tax_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    discount_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    customer = relationship("Customer", back_populates="quotations")
    items = relationship("QuotationItem", back_populates="quotation", cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="quotation", uselist=False)

class QuotationItem(Base):
    __tablename__ = "quotation_items"

    id = Column(Integer, primary_key=True, index=True)
    quotation_id = Column(Integer, ForeignKey("quotations.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    variant_id = Column(Integer, ForeignKey("product_variants.id"), nullable=True)
    plan_id = Column(Integer, ForeignKey("subscription_plans.id"), nullable=True)
    description = Column(String(500), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    tax_rate = Column(Numeric(5, 2), default=Decimal("0.00"), nullable=False)
    discount_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_price = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)

    quotation = relationship("Quotation", back_populates="items")
    product = relationship("Product")
    variant = relationship("ProductVariant")
    plan = relationship("SubscriptionPlan")

# ----------------- SUBSCRIPTIONS -----------------
class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    subscription_number = Column(String(100), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("subscription_plans.id"), nullable=True, index=True)
    quotation_id = Column(Integer, ForeignKey("quotations.id"), nullable=True)
    status = Column(String(50), default="draft", nullable=False, index=True)  
    # draft, quotation, confirmed, active, paused, expired, pending_renewal, cancelled, closed
    start_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime, nullable=True)
    current_period_start = Column(DateTime, nullable=False)
    current_period_end = Column(DateTime, nullable=False)
    next_billing_date = Column(DateTime, nullable=False, index=True)
    billing_interval = Column(String(50), default="monthly", nullable=False)  # daily, weekly, monthly, yearly
    payment_terms = Column(String(50), default="immediate", nullable=False)  # immediate, net_15, net_30
    auto_renew = Column(Boolean, default=True, nullable=False)
    allow_pause = Column(Boolean, default=True, nullable=False)
    allow_early_closure = Column(Boolean, default=True, nullable=False)
    subtotal = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    tax_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    discount_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    customer = relationship("Customer", back_populates="subscriptions")
    plan = relationship("SubscriptionPlan", back_populates="subscriptions")
    quotation = relationship("Quotation", back_populates="subscription")
    items = relationship("SubscriptionItem", back_populates="subscription", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="subscription")
    timeline = relationship("SubscriptionTimeline", back_populates="subscription", cascade="all, delete-orphan", order_by="SubscriptionTimeline.created_at.desc()")

class SubscriptionItem(Base):
    __tablename__ = "subscription_items"

    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    variant_id = Column(Integer, ForeignKey("product_variants.id"), nullable=True)
    description = Column(String(500), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    tax_rate = Column(Numeric(5, 2), default=Decimal("0.00"), nullable=False)
    discount_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_price = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)

    subscription = relationship("Subscription", back_populates="items")
    product = relationship("Product")
    variant = relationship("ProductVariant")

class SubscriptionTimeline(Base):
    __tablename__ = "subscription_timelines"

    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=False, index=True)
    event_type = Column(String(100), nullable=False)  # status_change, renewal, pause, resume, upgrade, invoice_generated
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)
    description = Column(Text, nullable=False)
    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)

    subscription = relationship("Subscription", back_populates="timeline")
    performed_by = relationship("User")

# ----------------- INVOICES -----------------
class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(100), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=True, index=True)
    status = Column(String(50), default="draft", nullable=False, index=True)  
    # draft, confirmed, paid, partially_paid, overdue, cancelled
    invoice_date = Column(DateTime, default=now_utc, nullable=False)
    due_date = Column(DateTime, nullable=False, index=True)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    subtotal = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    tax_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    discount_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    amount_paid = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    balance_due = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    notes = Column(Text, nullable=True)
    idempotency_key = Column(String(255), unique=True, nullable=True, index=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    customer = relationship("Customer", back_populates="invoices")
    subscription = relationship("Subscription", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice")
    allocations = relationship("PaymentAllocation", back_populates="invoice")

class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    variant_id = Column(Integer, ForeignKey("product_variants.id"), nullable=True)
    description = Column(String(500), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    tax_rate = Column(Numeric(5, 2), default=Decimal("0.00"), nullable=False)
    discount_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_price = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)

    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product")
    variant = relationship("ProductVariant")

# ----------------- PAYMENTS -----------------
class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    payment_number = Column(String(100), unique=True, index=True, nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    payment_method = Column(String(50), default="bank_transfer", nullable=False)  # cash, bank_transfer, upi, card, other
    amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    payment_date = Column(DateTime, default=now_utc, nullable=False)
    transaction_reference = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(50), default="confirmed", nullable=False)  # pending, confirmed, failed, refunded
    gateway_provider = Column(String(50), nullable=True)  # razorpay, stripe, manual
    gateway_order_id = Column(String(100), nullable=True, index=True)
    gateway_payment_id = Column(String(100), nullable=True, index=True)
    gateway_signature = Column(String(255), nullable=True)
    raw_webhook_data = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)

    customer = relationship("Customer", back_populates="payments")
    invoice = relationship("Invoice", back_populates="payments")
    allocations = relationship("PaymentAllocation", back_populates="payment", cascade="all, delete-orphan")

class PaymentAllocation(Base):
    __tablename__ = "payment_allocations"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=False, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    allocated_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    created_at = Column(DateTime, default=now_utc, nullable=False)

    payment = relationship("Payment", back_populates="allocations")
    invoice = relationship("Invoice", back_populates="allocations")

# ----------------- BILLING JOBS & LOGS -----------------
class BillingJob(Base):
    __tablename__ = "billing_jobs"

    id = Column(Integer, primary_key=True, index=True)
    run_at = Column(DateTime, default=now_utc, nullable=False)
    subscriptions_processed = Column(Integer, default=0, nullable=False)
    invoices_generated = Column(Integer, default=0, nullable=False)
    total_billed = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    errors_count = Column(Integer, default=0, nullable=False)
    execution_log = Column(Text, nullable=True)
    status = Column(String(50), default="completed", nullable=False)  # completed, failed, running

# ----------------- AUDIT & NOTIFICATIONS -----------------
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(100), nullable=False, index=True)  # subscription, invoice, payment, product, etc.
    entity_id = Column(Integer, nullable=True, index=True)
    action = Column(String(100), nullable=False)  # create, update, delete, status_change, reconcile, sync
    details = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    ip_address = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)

    user = relationship("User")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="system", nullable=False)  # renewal, expiry, overdue, payment, sync, system
    is_read = Column(Boolean, default=False, nullable=False)
    link = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)

    user = relationship("User")

# ----------------- SYNC OPERATIONS (OFFLINE MUTATION LOG) -----------------
class SyncOperation(Base):
    __tablename__ = "sync_operations"

    id = Column(Integer, primary_key=True, index=True)
    client_mutation_id = Column(String(100), unique=True, index=True, nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(Integer, nullable=True)
    action = Column(String(50), nullable=False)  # create, update, delete
    payload = Column(Text, nullable=False)
    status = Column(String(50), default="applied", nullable=False)  # applied, conflict, rejected
    conflict_details = Column(Text, nullable=True)
    client_version = Column(Integer, nullable=True)
    server_version = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)
    applied_at = Column(DateTime, default=now_utc, nullable=False)

# ----------------- ORGANIZATION SETTINGS -----------------
class OrganizationSettings(Base):
    __tablename__ = "organization_settings"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), default="Brightloop Software Solutions Pvt Ltd", nullable=False)
    company_email = Column(String(255), default="billing@brightloop.com", nullable=False)
    company_phone = Column(String(50), default="+91 484 290 8800", nullable=False)
    company_address = Column(Text, default="Infopark Kochi, Phase II, Kakkanad, Kerala, India - 682042", nullable=False)
    tax_id = Column(String(100), default="GSTIN: 32AABCB1234F1Z0", nullable=False)
    logo_url = Column(String(500), nullable=True)
    currency = Column(String(10), default="INR", nullable=False)
    currency_symbol = Column(String(10), default="₹", nullable=False)
    invoice_prefix = Column(String(20), default="INV-", nullable=False)
    quotation_prefix = Column(String(20), default="QT-", nullable=False)
    subscription_prefix = Column(String(20), default="SUB-", nullable=False)
    payment_prefix = Column(String(20), default="PAY-", nullable=False)
    next_invoice_number = Column(Integer, default=1001, nullable=False)
    next_quotation_number = Column(Integer, default=1001, nullable=False)
    next_subscription_number = Column(Integer, default=1001, nullable=False)
    next_payment_number = Column(Integer, default=1001, nullable=False)
    auto_billing_enabled = Column(Boolean, default=True, nullable=False)
    billing_hour_utc = Column(Integer, default=2, nullable=False)
    grace_period_days = Column(Integer, default=5, nullable=False)
    gateway_mode = Column(String(20), default="sandbox", nullable=False)  # sandbox, live
    razorpay_key_id = Column(String(100), default="rzp_test_brightloop123", nullable=False)
    razorpay_key_secret = Column(String(100), default="rzp_secret_sandbox999", nullable=False)
    razorpay_webhook_secret = Column(String(100), default="whsec_rzp_sandbox", nullable=False)
    stripe_publishable_key = Column(String(100), default="pk_test_brightloop_stripe", nullable=False)
    stripe_secret_key = Column(String(100), default="sk_test_brightloop_stripe_sec", nullable=False)
    stripe_webhook_secret = Column(String(100), default="whsec_stripe_sandbox", nullable=False)
    created_at = Column(DateTime, default=now_utc, nullable=False)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)
