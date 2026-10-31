import sqlite3
from sqlalchemy import inspect, text
from app.database import engine

def migrate_database():
    """
    Idempotent schema upgrade to add gateway columns if they do not exist.
    Preserves all existing data in production/test database.
    """
    with engine.connect() as conn:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()

        # 1. Update payments table
        if "payments" in table_names:
            columns = [c["name"] for c in inspector.get_columns("payments")]
            new_cols = [
                ("gateway_provider", "VARCHAR(50)"),
                ("gateway_order_id", "VARCHAR(100)"),
                ("gateway_payment_id", "VARCHAR(100)"),
                ("gateway_signature", "VARCHAR(255)"),
                ("raw_webhook_data", "TEXT"),
            ]
            for col_name, col_type in new_cols:
                if col_name not in columns:
                    try:
                        conn.execute(text(f"ALTER TABLE payments ADD COLUMN {col_name} {col_type}"))
                        conn.commit()
                        print(f"[Migration] Added column {col_name} to payments table.")
                    except Exception as e:
                        print(f"[Migration] Could not add column {col_name} to payments: {e}")

        # 2. Update organization_settings table
        if "organization_settings" in table_names:
            columns = [c["name"] for c in inspector.get_columns("organization_settings")]
            settings_cols = [
                ("gateway_mode", "VARCHAR(20) DEFAULT 'sandbox'"),
                ("razorpay_key_id", "VARCHAR(100) DEFAULT 'rzp_test_brightloop123'"),
                ("razorpay_key_secret", "VARCHAR(100) DEFAULT 'rzp_secret_sandbox999'"),
                ("razorpay_webhook_secret", "VARCHAR(100) DEFAULT 'whsec_rzp_sandbox'"),
                ("stripe_publishable_key", "VARCHAR(100) DEFAULT 'pk_test_brightloop_stripe'"),
                ("stripe_secret_key", "VARCHAR(100) DEFAULT 'sk_test_brightloop_stripe_sec'"),
                ("stripe_webhook_secret", "VARCHAR(100) DEFAULT 'whsec_stripe_sandbox'"),
            ]
            for col_name, col_def in settings_cols:
                if col_name not in columns:
                    try:
                        conn.execute(text(f"ALTER TABLE organization_settings ADD COLUMN {col_name} {col_def}"))
                        conn.commit()
                        print(f"[Migration] Added column {col_name} to organization_settings table.")
                    except Exception as e:
                        print(f"[Migration] Could not add column {col_name} to organization_settings: {e}")

if __name__ == "__main__":
    migrate_database()
