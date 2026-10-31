import threading
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base, SessionLocal
from app.seed import seed_database
from app.services.billing_engine import run_billing_cycle
from app.routers import (
    auth, users, customers, products, plans, quotations, subscriptions,
    invoices, payments, rules, billing, analytics, sync, settings as settings_router,
    audit, notifications, gateway
)

def background_billing_worker():
    """
    Background worker thread checking for recurring subscriptions every 5 minutes.
    Safeguards and idempotency keys in run_billing_cycle prevent duplicate billing.
    """
    while True:
        try:
            time.sleep(300)  # Check every 5 minutes
            db = SessionLocal()
            try:
                run_billing_cycle(db)
            finally:
                db.close()
        except Exception as e:
            print(f"[Billing Worker] Exception during recurring billing run: {e}")

from app.migrate_db import migrate_database

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist & seed dataset
    Base.metadata.create_all(bind=engine)
    migrate_database()
    seed_database()

    # Launch background recurring billing scheduler thread
    billing_thread = threading.Thread(target=background_billing_worker, daemon=True)
    billing_thread.start()

    yield
    # Shutdown logic if any

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Next-Generation Offline-First Subscription Management Platform for Brightloop Software.",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits local Vite, mobile dev, and production domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health checks
@app.get("/health")
@app.get(f"{settings.API_V1_STR}/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "mode": "production-ready"
    }

# Register all API V1 routers
api_v1 = settings.API_V1_STR
app.include_router(auth.router, prefix=api_v1)
app.include_router(users.router, prefix=api_v1)
app.include_router(customers.router, prefix=api_v1)
app.include_router(products.router, prefix=api_v1)
app.include_router(plans.router, prefix=api_v1)
app.include_router(quotations.router, prefix=api_v1)
app.include_router(subscriptions.router, prefix=api_v1)
app.include_router(invoices.router, prefix=api_v1)
app.include_router(payments.router, prefix=api_v1)
app.include_router(rules.router, prefix=api_v1)
app.include_router(billing.router, prefix=api_v1)
app.include_router(analytics.router, prefix=api_v1)
app.include_router(sync.router, prefix=api_v1)
app.include_router(settings_router.router, prefix=api_v1)
app.include_router(audit.router, prefix=api_v1)
app.include_router(notifications.router, prefix=api_v1)
app.include_router(gateway.router, prefix=api_v1)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
