import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import (
    User, Customer, Product, ProductVariant, SubscriptionPlan, TaxRule,
    DiscountRule, Quotation, QuotationItem, QuotationTemplate, Subscription,
    SubscriptionItem, SubscriptionTimeline, Invoice, InvoiceItem, Payment,
    PaymentAllocation, OrganizationSettings, AuditLog, Notification
)
from app.services.auth_service import hash_password

def seed_database():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    # Check if already seeded
    if db.query(User).first():
        db.close()
        return

    print("Seeding Brightloop database with production-grade initial dataset...")

    now = datetime.datetime.now(datetime.timezone.utc)
    one_month_ago = now - datetime.timedelta(days=30)
    two_months_ago = now - datetime.timedelta(days=60)
    three_months_ago = now - datetime.timedelta(days=90)
    future_month = now + datetime.timedelta(days=30)
    future_days_5 = now + datetime.timedelta(days=5)

    # 1. Organization Settings
    org = OrganizationSettings(
        company_name="Brightloop Software Solutions Pvt Ltd",
        company_email="billing@brightloop.com",
        company_phone="+91 484 290 8800",
        company_address="Infopark Kochi, Phase II, Kakkanad, Kerala, India - 682042",
        tax_id="GSTIN: 32AABCB1234F1Z0",
        currency="INR",
        currency_symbol="₹",
        invoice_prefix="INV-",
        quotation_prefix="QT-",
        subscription_prefix="SUB-",
        payment_prefix="PAY-",
        next_invoice_number=1006,
        next_quotation_number=1004,
        next_subscription_number=1006,
        next_payment_number=1005,
        auto_billing_enabled=True,
        grace_period_days=7
    )
    db.add(org)

    # 2. Users (Admin, Staff, Customer)
    admin_user = User(
        email="admin@brightloop.com",
        password_hash=hash_password("Admin@12345!"),
        full_name="Sarah Jenkins (CTO / Admin)",
        role="admin",
        phone="+91 98950 11223",
        status="active"
    )
    staff_user = User(
        email="staff@brightloop.com",
        password_hash=hash_password("Staff@12345!"),
        full_name="Alex Rivera (Billing Operations)",
        role="staff",
        phone="+91 98950 44556",
        status="active"
    )
    customer_user = User(
        email="customer@brightloop.com",
        password_hash=hash_password("Customer@12345!"),
        full_name="Vikram Nair (Nexus Tech Pvt Ltd)",
        role="customer",
        phone="+91 98470 77889",
        status="active"
    )
    db.add_all([admin_user, staff_user, customer_user])
    db.flush()

    # 3. Customers
    cust1 = Customer(
        user_id=customer_user.id,
        name="Vikram Nair",
        email="customer@brightloop.com",
        phone="+91 98470 77889",
        company_name="Nexus Technologies Pvt Ltd",
        tax_id="GSTIN: 32AAECN5544R1Z8",
        billing_address="Suite 402, SmartCity Kochi, Kakkanad, Kerala - 682030",
        shipping_address="Suite 402, SmartCity Kochi, Kakkanad, Kerala - 682030",
        currency="INR",
        outstanding_balance=Decimal("0.00"),
        status="active",
        notes="High-growth enterprise SaaS client. Priority SLA."
    )
    cust2 = Customer(
        name="Ananya Sharma",
        email="ananya@keralafintech.io",
        phone="+91 97450 33221",
        company_name="Kerala FinTech Innovations",
        tax_id="GSTIN: 32AABCK9988P1Z3",
        billing_address="Plot 18, Electronic City, Kalamassery, Kochi - 683104",
        currency="INR",
        outstanding_balance=Decimal("2949.00"),
        status="active",
        notes="Fintech billing integration client. Monthly billing cycle."
    )
    cust3 = Customer(
        name="David Chen",
        email="david.chen@orientpacific.com",
        phone="+65 6789 0123",
        company_name="Orient Pacific Logistics",
        tax_id="UEN: 202109876C",
        billing_address="71 Robinson Road, Singapore 068895",
        currency="INR",
        outstanding_balance=Decimal("0.00"),
        status="active",
        notes="International enterprise account."
    )
    cust4 = Customer(
        name="Meera Pillai",
        email="meera@cochinretail.com",
        phone="+91 94471 22334",
        company_name="Cochin Retail Dynamics",
        tax_id="GSTIN: 32AACCR1122M1Z1",
        billing_address="Panampilly Nagar, Kochi, Kerala - 682036",
        currency="INR",
        outstanding_balance=Decimal("1769.00"),
        status="active",
        notes="Retail POS and subscription tier."
    )
    db.add_all([cust1, cust2, cust3, cust4])
    db.flush()

    # 4. Tax Rules
    tax_gst = TaxRule(name="GST 18%", rate_percentage=Decimal("18.00"), is_compound=False, tax_type="gst", is_active=True)
    tax_vat = TaxRule(name="VAT 5%", rate_percentage=Decimal("5.00"), is_compound=False, tax_type="vat", is_active=True)
    tax_zero = TaxRule(name="Export Zero-Tax", rate_percentage=Decimal("0.00"), is_compound=False, tax_type="zero_rated", is_active=True)
    db.add_all([tax_gst, tax_vat, tax_zero])

    # 5. Discount Rules
    disc1 = DiscountRule(
        code="WELCOME20",
        name="New Customer 20% Off",
        discount_type="percentage",
        value=Decimal("20.00"),
        min_purchase_amount=Decimal("1000.00"),
        max_usage_count=50,
        current_usage_count=4,
        subscription_wide=True,
        is_active=True
    )
    disc2 = DiscountRule(
        code="FIXED500",
        name="Flat ₹500 Loyalty Bonus",
        discount_type="fixed",
        value=Decimal("500.00"),
        min_purchase_amount=Decimal("2000.00"),
        max_usage_count=100,
        current_usage_count=12,
        subscription_wide=True,
        is_active=True
    )
    db.add_all([disc1, disc2])
    db.flush()

    # 6. Products & Variants (with realistic Odoo variant example from prompt)
    prod1 = Product(
        name="Brightloop Business Software",
        description="Comprehensive enterprise cloud suite for financials, inventory, and operations.",
        product_type="recurring_service",
        sku="BL-BS-01",
        sales_price=Decimal("2499.00"),
        cost_price=Decimal("800.00"),
        image_url="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=60",
        status="active"
    )
    db.add(prod1)
    db.flush()

    v1_1 = ProductVariant(product_id=prod1.id, name="Standard", sku="BL-BS-STD", additional_price=Decimal("0.00"), status="active")
    v1_2 = ProductVariant(product_id=prod1.id, name="Odoo Connector", sku="BL-BS-ODOO", additional_price=Decimal("560.00"), status="active")
    v1_3 = ProductVariant(product_id=prod1.id, name="Enterprise Multi-Tenant", sku="BL-BS-ENT", additional_price=Decimal("1500.00"), status="active")
    db.add_all([v1_1, v1_2, v1_3])

    prod2 = Product(
        name="Brightloop Real-time Financial Analytics",
        description="Streaming MRR, ARR, churn, and invoice reconciliation analytics pipeline.",
        product_type="recurring_service",
        sku="BL-AN-02",
        sales_price=Decimal("1499.00"),
        cost_price=Decimal("400.00"),
        image_url="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=60",
        status="active"
    )
    db.add(prod2)
    db.flush()

    v2_1 = ProductVariant(product_id=prod2.id, name="Core Engine", sku="BL-AN-CORE", additional_price=Decimal("0.00"), status="active")
    v2_2 = ProductVariant(product_id=prod2.id, name="Predictive AI Engine", sku="BL-AN-AI", additional_price=Decimal("750.00"), status="active")
    db.add_all([v2_1, v2_2])

    prod3 = Product(
        name="Brightloop Dedicated High-Performance Server",
        description="Isolated single-tenant node hosted in Kochi Datacenter with 99.99% uptime guarantee.",
        product_type="digital",
        sku="BL-INF-03",
        sales_price=Decimal("5999.00"),
        cost_price=Decimal("2500.00"),
        image_url="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=60",
        status="active"
    )
    db.add(prod3)
    db.flush()

    # 7. Subscription Plans
    plan1 = SubscriptionPlan(
        name="Business Software Professional",
        product_id=prod1.id,
        billing_interval="monthly",
        base_price=Decimal("2499.00"),
        min_quantity=1,
        max_quantity=500,
        description="Standard monthly subscription for Brightloop Business Software with Odoo integration support.",
        auto_close=False,
        allow_early_closure=True,
        allow_pause=True,
        allow_renewal=True,
        status="active"
    )
    plan2 = SubscriptionPlan(
        name="Business Software Annual Saver",
        product_id=prod1.id,
        billing_interval="yearly",
        base_price=Decimal("24990.00"),
        min_quantity=1,
        max_quantity=1000,
        description="Annual upfront subscription offering 2 months free.",
        auto_close=False,
        allow_early_closure=True,
        allow_pause=False,
        allow_renewal=True,
        status="active"
    )
    plan3 = SubscriptionPlan(
        name="Analytics Pro Stream",
        product_id=prod2.id,
        billing_interval="monthly",
        base_price=Decimal("1499.00"),
        min_quantity=1,
        max_quantity=100,
        description="Continuous subscription for real-time KPI streaming and audit reports.",
        auto_close=False,
        allow_early_closure=True,
        allow_pause=True,
        allow_renewal=True,
        status="active"
    )
    db.add_all([plan1, plan2, plan3])
    db.flush()

    # 8. Quotations
    q1 = Quotation(
        quotation_number="QT-01001",
        customer_id=cust1.id,
        status="converted",
        valid_until=future_month,
        subtotal=Decimal("3059.00"),
        tax_amount=Decimal("550.62"),
        discount_amount=Decimal("0.00"),
        total_amount=Decimal("3609.62"),
        notes="Quotation for Business Software with Odoo connector variant.",
        terms="Payment within 15 days of invoice date.",
        created_by_id=admin_user.id
    )
    db.add(q1)
    db.flush()

    qi1 = QuotationItem(
        quotation_id=q1.id,
        product_id=prod1.id,
        variant_id=v1_2.id,
        plan_id=plan1.id,
        description="Brightloop Business Software (Odoo Connector variant)",
        quantity=1,
        unit_price=Decimal("3059.00"),
        tax_rate=Decimal("18.00"),
        discount_amount=Decimal("0.00"),
        total_price=Decimal("3609.62")
    )
    db.add(qi1)

    q2 = Quotation(
        quotation_number="QT-01002",
        customer_id=cust3.id,
        status="sent",
        valid_until=now + datetime.timedelta(days=14),
        subtotal=Decimal("5999.00"),
        tax_amount=Decimal("0.00"),
        discount_amount=Decimal("500.00"),
        total_amount=Decimal("5499.00"),
        notes="Dedicated cloud instance quote for Orient Pacific.",
        terms="Prepaid net 30.",
        created_by_id=staff_user.id
    )
    db.add(q2)
    db.flush()

    qi2 = QuotationItem(
        quotation_id=q2.id,
        product_id=prod3.id,
        description="Brightloop Dedicated High-Performance Server",
        quantity=1,
        unit_price=Decimal("5999.00"),
        tax_rate=Decimal("0.00"),
        discount_amount=Decimal("500.00"),
        total_price=Decimal("5499.00")
    )
    db.add(qi2)

    # 9. Subscriptions
    # Sub 1: Active subscription for Nexus (Vikram Nair)
    sub1 = Subscription(
        subscription_number="SUB-01001",
        customer_id=cust1.id,
        plan_id=plan1.id,
        quotation_id=q1.id,
        status="active",
        start_date=two_months_ago,
        current_period_start=now - datetime.timedelta(days=10),
        current_period_end=now + datetime.timedelta(days=20),
        next_billing_date=now + datetime.timedelta(days=20),
        billing_interval="monthly",
        payment_terms="immediate",
        auto_renew=True,
        subtotal=Decimal("3059.00"),
        tax_amount=Decimal("550.62"),
        discount_amount=Decimal("0.00"),
        total_amount=Decimal("3609.62"),
        currency="INR",
        notes="Primary active subscription with Odoo variant included.",
        version=1
    )
    db.add(sub1)
    db.flush()

    si1 = SubscriptionItem(
        subscription_id=sub1.id,
        product_id=prod1.id,
        variant_id=v1_2.id,
        description="Brightloop Business Software + Odoo Variant (+₹560)",
        quantity=1,
        unit_price=Decimal("3059.00"),
        tax_rate=Decimal("18.00"),
        discount_amount=Decimal("0.00"),
        total_price=Decimal("3609.62")
    )
    db.add(si1)

    t1 = SubscriptionTimeline(
        subscription_id=sub1.id,
        event_type="creation",
        old_status="draft",
        new_status="active",
        description="Subscription activated via quotation QT-01001.",
        performed_by_id=admin_user.id
    )
    db.add(t1)

    # Sub 2: Active subscription for Ananya (Kerala FinTech)
    sub2 = Subscription(
        subscription_number="SUB-01002",
        customer_id=cust2.id,
        plan_id=plan1.id,
        status="active",
        start_date=one_month_ago,
        current_period_start=one_month_ago,
        current_period_end=now,
        next_billing_date=now,  # Due for billing!
        billing_interval="monthly",
        payment_terms="immediate",
        auto_renew=True,
        subtotal=Decimal("2499.00"),
        tax_amount=Decimal("450.00"),
        discount_amount=Decimal("0.00"),
        total_amount=Decimal("2949.00"),
        currency="INR",
        notes="Standard monthly plan.",
        version=1
    )
    db.add(sub2)
    db.flush()

    si2 = SubscriptionItem(
        subscription_id=sub2.id,
        product_id=prod1.id,
        variant_id=v1_1.id,
        description="Brightloop Business Software (Standard)",
        quantity=1,
        unit_price=Decimal("2499.00"),
        tax_rate=Decimal("18.00"),
        discount_amount=Decimal("0.00"),
        total_price=Decimal("2949.00")
    )
    db.add(si2)

    # Sub 3: Paused subscription
    sub3 = Subscription(
        subscription_number="SUB-01003",
        customer_id=cust3.id,
        plan_id=plan3.id,
        status="paused",
        start_date=three_months_ago,
        current_period_start=one_month_ago,
        current_period_end=now + datetime.timedelta(days=15),
        next_billing_date=now + datetime.timedelta(days=15),
        billing_interval="monthly",
        payment_terms="immediate",
        auto_renew=False,
        subtotal=Decimal("1499.00"),
        tax_amount=Decimal("269.82"),
        discount_amount=Decimal("0.00"),
        total_amount=Decimal("1768.82"),
        currency="INR",
        notes="Customer paused service during system restructuring.",
        version=1
    )
    db.add(sub3)
    db.flush()

    # Sub 4: Expired subscription
    sub4 = Subscription(
        subscription_number="SUB-01004",
        customer_id=cust4.id,
        plan_id=plan3.id,
        status="expired",
        start_date=two_months_ago,
        expiry_date=one_month_ago,
        current_period_start=two_months_ago,
        current_period_end=one_month_ago,
        next_billing_date=one_month_ago,
        billing_interval="monthly",
        payment_terms="immediate",
        auto_renew=False,
        subtotal=Decimal("1499.00"),
        tax_amount=Decimal("269.82"),
        discount_amount=Decimal("0.00"),
        total_amount=Decimal("1768.82"),
        currency="INR",
        notes="Fixed term trial ended.",
        version=1
    )
    db.add(sub4)
    db.flush()

    # 10. Invoices
    # Invoice 1: Paid invoice for Nexus
    inv1 = Invoice(
        invoice_number="INV-01001",
        customer_id=cust1.id,
        subscription_id=sub1.id,
        status="paid",
        invoice_date=two_months_ago,
        due_date=two_months_ago + datetime.timedelta(days=7),
        period_start=two_months_ago,
        period_end=one_month_ago,
        subtotal=Decimal("3059.00"),
        tax_amount=Decimal("550.62"),
        discount_amount=Decimal("0.00"),
        total_amount=Decimal("3609.62"),
        amount_paid=Decimal("3609.62"),
        balance_due=Decimal("0.00"),
        notes="Initial subscription cycle billing.",
        idempotency_key=f"sub-{sub1.id}-{two_months_ago.strftime('%Y%m%d')}"
    )
    db.add(inv1)
    db.flush()

    ii1 = InvoiceItem(
        invoice_id=inv1.id,
        product_id=prod1.id,
        variant_id=v1_2.id,
        description="Brightloop Business Software + Odoo Variant (+₹560)",
        quantity=1,
        unit_price=Decimal("3059.00"),
        tax_rate=Decimal("18.00"),
        discount_amount=Decimal("0.00"),
        total_price=Decimal("3609.62")
    )
    db.add(ii1)

    # Invoice 2: Overdue invoice for Ananya (Kerala FinTech)
    inv2 = Invoice(
        invoice_number="INV-01002",
        customer_id=cust2.id,
        subscription_id=sub2.id,
        status="overdue",
        invoice_date=one_month_ago,
        due_date=now - datetime.timedelta(days=5),
        period_start=one_month_ago,
        period_end=now,
        subtotal=Decimal("2499.00"),
        tax_amount=Decimal("450.00"),
        discount_amount=Decimal("0.00"),
        total_amount=Decimal("2949.00"),
        amount_paid=Decimal("0.00"),
        balance_due=Decimal("2949.00"),
        notes="Second month cycle billing. Overdue follow-up pending.",
        idempotency_key=f"sub-{sub2.id}-{one_month_ago.strftime('%Y%m%d')}"
    )
    db.add(inv2)
    db.flush()

    ii2 = InvoiceItem(
        invoice_id=inv2.id,
        product_id=prod1.id,
        variant_id=v1_1.id,
        description="Brightloop Business Software (Standard)",
        quantity=1,
        unit_price=Decimal("2499.00"),
        tax_rate=Decimal("18.00"),
        discount_amount=Decimal("0.00"),
        total_price=Decimal("2949.00")
    )
    db.add(ii2)

    # Invoice 3: Partially paid invoice for Meera (Cochin Retail)
    inv3 = Invoice(
        invoice_number="INV-01003",
        customer_id=cust4.id,
        status="partially_paid",
        invoice_date=now - datetime.timedelta(days=12),
        due_date=now + datetime.timedelta(days=3),
        period_start=now - datetime.timedelta(days=12),
        period_end=now + datetime.timedelta(days=18),
        subtotal=Decimal("2499.00"),
        tax_amount=Decimal("450.00"),
        discount_amount=Decimal("180.00"),
        total_amount=Decimal("2769.00"),
        amount_paid=Decimal("1000.00"),
        balance_due=Decimal("1769.00"),
        notes="Enterprise support package.",
        idempotency_key=f"manual-cust-{cust4.id}-202610"
    )
    db.add(inv3)
    db.flush()

    # 11. Payments & Allocations
    pay1 = Payment(
        payment_number="PAY-01001",
        invoice_id=inv1.id,
        customer_id=cust1.id,
        payment_method="bank_transfer",
        amount=Decimal("3609.62"),
        payment_date=two_months_ago + datetime.timedelta(days=2),
        transaction_reference="HDFC_NEFT_982341209",
        notes="Full settlement of INV-01001 via HDFC net banking.",
        status="confirmed",
        created_by_id=staff_user.id
    )
    db.add(pay1)
    db.flush()

    pa1 = PaymentAllocation(
        payment_id=pay1.id,
        invoice_id=inv1.id,
        allocated_amount=Decimal("3609.62")
    )
    db.add(pa1)

    pay2 = Payment(
        payment_number="PAY-01002",
        invoice_id=inv3.id,
        customer_id=cust4.id,
        payment_method="upi",
        amount=Decimal("1000.00"),
        payment_date=now - datetime.timedelta(days=10),
        transaction_reference="UPI_GPay_991823712",
        notes="Partial deposit payment via UPI.",
        status="confirmed",
        created_by_id=staff_user.id
    )
    db.add(pay2)
    db.flush()

    pa2 = PaymentAllocation(
        payment_id=pay2.id,
        invoice_id=inv3.id,
        allocated_amount=Decimal("1000.00")
    )
    db.add(pa2)

    # 12. In-App Notifications
    notif1 = Notification(
        user_id=admin_user.id,
        title="Overdue Invoice Alert",
        message="Invoice INV-01002 for Kerala FinTech (₹2,949.00) is 5 days overdue.",
        type="overdue",
        link="/invoices"
    )
    notif2 = Notification(
        user_id=customer_user.id,
        title="Subscription Active",
        message="Your subscription SUB-01001 is active. Next billing date: 2026-11-20.",
        type="renewal",
        link="/subscriptions"
    )
    db.add_all([notif1, notif2])

    # 13. Audit Trail
    audit1 = AuditLog(
        entity_type="system",
        entity_id=None,
        action="seed_complete",
        details="Initial enterprise dataset seeded with realistic customers, subscriptions, invoices, and payments.",
        user_id=admin_user.id
    )
    db.add(audit1)

    db.commit()
    db.close()
    print("Database seeding completed successfully!")

if __name__ == "__main__":
    seed_database()
