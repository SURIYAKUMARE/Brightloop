import json
import datetime
from decimal import Decimal
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models import (
    Customer, Product, Quotation, QuotationItem, Subscription, SubscriptionItem,
    Invoice, InvoiceItem, Payment, SyncOperation, AuditLog, OrganizationSettings
)
from app.schemas import SyncMutation

def process_batch_sync(db: Session, mutations: List[SyncMutation], user_id: int) -> Dict[str, Any]:
    """
    Processes a batch of offline mutations from the client Dexie.js mutation queue.
    Applies Optimistic Concurrency Control (OCC) and server-authoritative validation.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    results = []
    success_count = 0
    conflict_count = 0

    settings = db.query(OrganizationSettings).first()
    if not settings:
        settings = OrganizationSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    for mutation in mutations:
        op_id = mutation.client_mutation_id
        entity = mutation.entity_type
        action = mutation.action
        payload = mutation.payload
        client_ver = mutation.client_version or 1

        # Check if already processed (Idempotency)
        existing_op = db.query(SyncOperation).filter(SyncOperation.client_mutation_id == op_id).first()
        if existing_op:
            results.append({
                "client_mutation_id": op_id,
                "status": existing_op.status,
                "message": "Already processed",
                "entity_type": entity,
                "entity_id": existing_op.entity_id
            })
            if existing_op.status == "applied":
                success_count += 1
            else:
                conflict_count += 1
            continue

        try:
            target_id = payload.get("id")
            
            # CUSTOMER SYNC
            if entity == "customer":
                if action == "create":
                    new_cust = Customer(
                        name=payload.get("name", "Unknown"),
                        email=payload.get("email"),
                        phone=payload.get("phone"),
                        company_name=payload.get("company_name"),
                        tax_id=payload.get("tax_id"),
                        billing_address=payload.get("billing_address"),
                        shipping_address=payload.get("shipping_address"),
                        currency=payload.get("currency", "INR"),
                        notes=payload.get("notes"),
                        version=1
                    )
                    db.add(new_cust)
                    db.flush()
                    
                    sync_record = SyncOperation(
                        client_mutation_id=op_id,
                        entity_type=entity,
                        entity_id=new_cust.id,
                        action=action,
                        payload=json.dumps(payload),
                        status="applied",
                        client_version=client_ver,
                        server_version=1
                    )
                    db.add(sync_record)
                    success_count += 1
                    results.append({"client_mutation_id": op_id, "status": "applied", "server_id": new_cust.id, "version": 1})

                elif action == "update" and target_id:
                    cust = db.query(Customer).filter(Customer.id == target_id).first()
                    if not cust:
                        raise ValueError(f"Customer {target_id} not found")
                    if cust.version != client_ver:
                        # Conflict detected
                        conflict_count += 1
                        conflict_record = SyncOperation(
                            client_mutation_id=op_id,
                            entity_type=entity,
                            entity_id=target_id,
                            action=action,
                            payload=json.dumps(payload),
                            status="conflict",
                            conflict_details=f"Version mismatch. Server version {cust.version} vs client version {client_ver}",
                            client_version=client_ver,
                            server_version=cust.version
                        )
                        db.add(conflict_record)
                        results.append({
                            "client_mutation_id": op_id,
                            "status": "conflict",
                            "server_record": {
                                "id": cust.id, "name": cust.name, "email": cust.email, "version": cust.version
                            }
                        })
                        continue

                    # Safe to update
                    for k in ["name", "email", "phone", "company_name", "tax_id", "billing_address", "shipping_address", "notes"]:
                        if k in payload:
                            setattr(cust, k, payload[k])
                    cust.version += 1
                    cust.updated_at = now
                    db.flush()

                    sync_record = SyncOperation(
                        client_mutation_id=op_id,
                        entity_type=entity,
                        entity_id=cust.id,
                        action=action,
                        payload=json.dumps(payload),
                        status="applied",
                        client_version=client_ver,
                        server_version=cust.version
                    )
                    db.add(sync_record)
                    success_count += 1
                    results.append({"client_mutation_id": op_id, "status": "applied", "server_id": cust.id, "version": cust.version})

            # QUOTATION SYNC
            elif entity == "quotation":
                if action == "create":
                    q_num = f"{settings.quotation_prefix}{settings.next_quotation_number:05d}"
                    settings.next_quotation_number += 1
                    valid_until = datetime.datetime.fromisoformat(payload["valid_until"].replace("Z", "+00:00")) if "valid_until" in payload else now + datetime.timedelta(days=30)
                    
                    subtotal = Decimal(str(payload.get("subtotal", 0)))
                    tax_amount = Decimal(str(payload.get("tax_amount", 0)))
                    discount_amount = Decimal(str(payload.get("discount_amount", 0)))
                    total_amount = subtotal - discount_amount + tax_amount

                    new_q = Quotation(
                        quotation_number=q_num,
                        customer_id=payload["customer_id"],
                        status="draft",
                        valid_until=valid_until,
                        subtotal=subtotal,
                        tax_amount=tax_amount,
                        discount_amount=discount_amount,
                        total_amount=total_amount,
                        notes=payload.get("notes"),
                        terms=payload.get("terms"),
                        created_by_id=user_id,
                        version=1
                    )
                    db.add(new_q)
                    db.flush()

                    for item in payload.get("items", []):
                        q_item = QuotationItem(
                            quotation_id=new_q.id,
                            product_id=item["product_id"],
                            variant_id=item.get("variant_id"),
                            plan_id=item.get("plan_id"),
                            description=item.get("description", "Product line"),
                            quantity=item.get("quantity", 1),
                            unit_price=Decimal(str(item.get("unit_price", 0))),
                            tax_rate=Decimal(str(item.get("tax_rate", 0))),
                            discount_amount=Decimal(str(item.get("discount_amount", 0))),
                            total_price=Decimal(str(item.get("total_price", 0)))
                        )
                        db.add(q_item)

                    sync_record = SyncOperation(
                        client_mutation_id=op_id,
                        entity_type=entity,
                        entity_id=new_q.id,
                        action=action,
                        payload=json.dumps(payload),
                        status="applied",
                        client_version=client_ver,
                        server_version=1
                    )
                    db.add(sync_record)
                    success_count += 1
                    results.append({"client_mutation_id": op_id, "status": "applied", "server_id": new_q.id, "quotation_number": q_num, "version": 1})

            # SUBSCRIPTION DRAFT SYNC
            elif entity == "subscription":
                if action == "create":
                    sub_num = f"{settings.subscription_prefix}{settings.next_subscription_number:05d}"
                    settings.next_subscription_number += 1
                    start_date = datetime.datetime.fromisoformat(payload["start_date"].replace("Z", "+00:00")) if "start_date" in payload else now
                    interval = payload.get("billing_interval", "monthly")
                    
                    subtotal = Decimal(str(payload.get("subtotal", 0)))
                    tax_amount = Decimal(str(payload.get("tax_amount", 0)))
                    discount_amount = Decimal(str(payload.get("discount_amount", 0)))
                    total_amount = subtotal - discount_amount + tax_amount

                    new_sub = Subscription(
                        subscription_number=sub_num,
                        customer_id=payload["customer_id"],
                        plan_id=payload.get("plan_id"),
                        quotation_id=payload.get("quotation_id"),
                        status="draft",  # Offline created subscriptions start as draft for server verification
                        start_date=start_date,
                        current_period_start=start_date,
                        current_period_end=start_date + datetime.timedelta(days=30),
                        next_billing_date=start_date + datetime.timedelta(days=30),
                        billing_interval=interval,
                        payment_terms=payload.get("payment_terms", "immediate"),
                        auto_renew=payload.get("auto_renew", True),
                        subtotal=subtotal,
                        tax_amount=tax_amount,
                        discount_amount=discount_amount,
                        total_amount=total_amount,
                        currency=payload.get("currency", "INR"),
                        notes=payload.get("notes"),
                        version=1
                    )
                    db.add(new_sub)
                    db.flush()

                    for item in payload.get("items", []):
                        sub_item = SubscriptionItem(
                            subscription_id=new_sub.id,
                            product_id=item["product_id"],
                            variant_id=item.get("variant_id"),
                            description=item.get("description", "Subscription line"),
                            quantity=item.get("quantity", 1),
                            unit_price=Decimal(str(item.get("unit_price", 0))),
                            tax_rate=Decimal(str(item.get("tax_rate", 0))),
                            discount_amount=Decimal(str(item.get("discount_amount", 0))),
                            total_price=Decimal(str(item.get("total_price", 0)))
                        )
                        db.add(sub_item)

                    sync_record = SyncOperation(
                        client_mutation_id=op_id,
                        entity_type=entity,
                        entity_id=new_sub.id,
                        action=action,
                        payload=json.dumps(payload),
                        status="applied",
                        client_version=client_ver,
                        server_version=1
                    )
                    db.add(sync_record)
                    success_count += 1
                    results.append({"client_mutation_id": op_id, "status": "applied", "server_id": new_sub.id, "subscription_number": sub_num, "version": 1})

            # PENDING PAYMENT ENTRY SYNC
            elif entity == "payment":
                if action == "create":
                    pay_num = f"{settings.payment_prefix}{settings.next_payment_number:05d}"
                    settings.next_payment_number += 1
                    amount = Decimal(str(payload["amount"]))
                    pay_date = datetime.datetime.fromisoformat(payload["payment_date"].replace("Z", "+00:00")) if "payment_date" in payload else now
                    inv_id = payload.get("invoice_id")

                    new_pay = Payment(
                        payment_number=pay_num,
                        invoice_id=inv_id,
                        customer_id=payload["customer_id"],
                        payment_method=payload.get("payment_method", "bank_transfer"),
                        amount=amount,
                        payment_date=pay_date,
                        transaction_reference=payload.get("transaction_reference"),
                        notes=f"[Offline Recorded] {payload.get('notes', '')}",
                        status="confirmed",  # Confirmed on server upon sync
                        created_by_id=user_id
                    )
                    db.add(new_pay)
                    db.flush()

                    # Reconcile with invoice if provided
                    if inv_id:
                        inv = db.query(Invoice).filter(Invoice.id == inv_id).first()
                        if inv:
                            inv.amount_paid += amount
                            inv.balance_due -= amount
                            if inv.balance_due <= Decimal("0.00"):
                                inv.balance_due = Decimal("0.00")
                                inv.status = "paid"
                            else:
                                inv.status = "partially_paid"
                            
                            cust = db.query(Customer).filter(Customer.id == inv.customer_id).first()
                            if cust:
                                cust.outstanding_balance -= amount
                                if cust.outstanding_balance < Decimal("0.00"):
                                    cust.outstanding_balance = Decimal("0.00")

                    sync_record = SyncOperation(
                        client_mutation_id=op_id,
                        entity_type=entity,
                        entity_id=new_pay.id,
                        action=action,
                        payload=json.dumps(payload),
                        status="applied",
                        client_version=client_ver,
                        server_version=1
                    )
                    db.add(sync_record)
                    success_count += 1
                    results.append({"client_mutation_id": op_id, "status": "applied", "server_id": new_pay.id, "payment_number": pay_num, "version": 1})

            db.commit()

        except Exception as e:
            db.rollback()
            conflict_count += 1
            error_record = SyncOperation(
                client_mutation_id=op_id,
                entity_type=entity,
                entity_id=payload.get("id"),
                action=action,
                payload=json.dumps(payload),
                status="rejected",
                conflict_details=str(e),
                client_version=client_ver
            )
            db.add(error_record)
            db.commit()
            results.append({
                "client_mutation_id": op_id,
                "status": "rejected",
                "error": str(e)
            })

    return {
        "success_count": success_count,
        "conflict_count": conflict_count,
        "results": results
    }
