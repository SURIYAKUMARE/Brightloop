from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models import Product, ProductVariant, User, AuditLog
from app.schemas import ProductCreate, ProductUpdate, ProductOut, ProductVariantCreate, ProductVariantOut
from app.services.auth_service import get_current_user, require_admin

router = APIRouter(prefix="/products", tags=["Products"])

@router.get("/", response_model=List[ProductOut])
def get_products(
    search: Optional[str] = None,
    product_type: Optional[str] = None,
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Product)
    if status_filter:
        query = query.filter(Product.status == status_filter)
    if product_type:
        query = query.filter(Product.product_type == product_type)
    if search:
        s = f"%{search}%"
        query = query.filter(or_(Product.name.ilike(s), Product.sku.ilike(s), Product.description.ilike(s)))
    return query.order_by(Product.created_at.desc()).offset(skip).limit(limit).all()

@router.post("/", response_model=ProductOut)
def create_product(
    prod_in: ProductCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    existing = db.query(Product).filter(Product.sku == prod_in.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail="A product with this SKU already exists.")

    new_prod = Product(
        name=prod_in.name,
        description=prod_in.description,
        product_type=prod_in.product_type,
        sku=prod_in.sku,
        sales_price=prod_in.sales_price,
        cost_price=prod_in.cost_price,
        image_url=prod_in.image_url,
        notes=prod_in.notes,
        status=prod_in.status,
        version=1
    )
    db.add(new_prod)
    db.flush()

    for v in prod_in.variants or []:
        variant = ProductVariant(
            product_id=new_prod.id,
            name=v.name,
            sku=v.sku,
            additional_price=v.additional_price,
            status=v.status
        )
        db.add(variant)

    db.commit()
    db.refresh(new_prod)

    audit = AuditLog(
        entity_type="product",
        entity_id=new_prod.id,
        action="create",
        details=f"Product created: {new_prod.name} (SKU: {new_prod.sku})",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return new_prod

@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found.")
    return prod

@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    prod_update: ProductUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found.")

    for field, val in prod_update.model_dump(exclude_unset=True).items():
        setattr(prod, field, val)

    prod.version += 1
    db.commit()
    db.refresh(prod)

    audit = AuditLog(
        entity_type="product",
        entity_id=prod.id,
        action="update",
        details=f"Product updated: {prod.name}",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return prod

@router.post("/{product_id}/variants", response_model=ProductVariantOut)
def add_product_variant(
    product_id: int,
    variant_in: ProductVariantCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found.")

    variant = ProductVariant(
        product_id=product_id,
        name=variant_in.name,
        sku=variant_in.sku,
        additional_price=variant_in.additional_price,
        status=variant_in.status
    )
    db.add(variant)
    db.commit()
    db.refresh(variant)

    audit = AuditLog(
        entity_type="product_variant",
        entity_id=variant.id,
        action="create",
        details=f"Variant added to product {prod.name}: {variant.name} (+₹{variant.additional_price})",
        user_id=current_user.id
    )
    db.add(audit)
    db.commit()

    return variant
