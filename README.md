# Brightloop Software — Next-Generation Offline-First Subscription Management Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Dexie.js](https://img.shields.io/badge/Dexie.js-IndexedDB-orange.svg)](https://dexie.org/)
[![Tests](https://img.shields.io/badge/Pytest-20%2F20%20Passed-brightgreen.svg)](backend/tests/)

Brightloop Software is an enterprise-grade, offline-first subscription management and recurring billing platform engineered with **FastAPI**, **SQLAlchemy**, **React 18**, **TypeScript**, **Dexie.js (IndexedDB)**, and the **Google Stitch Design System**.

---

## Key Capabilities

1. **Complete Subscription Lifecycle Management**:
   - Draft, Quotation, Confirmed, Active, Paused, Pending Renewal, Expired, and Cancelled states.
   - Comprehensive audit timeline tracking with chronological status change records.
   - Quotation Builder with customer auto-linking, multi-item line configurations, and instant quote conversion.

2. **Automated Recurring Billing Engine**:
   - Background worker and on-demand execution panel.
   - Auto-generates recurring invoices based on billing intervals (monthly, yearly, weekly).
   - Enforces idempotent execution keys to eliminate duplicate billing.

3. **Multi-Variant Products**:
   - Recurring licenses, digital assets, and recurring services.
   - Dynamic variant pricing (e.g. Standard, Odoo Connector, Enterprise).

4. **Tax & Discount Rules Engine**:
   - Percentage and fixed monetary discounts, minimum spend limits, expiry tracking, and usage counters.
   - Configurable GST/VAT rules with compound rate handling.

5. **Payment Gateway Sandbox Layer & Webhook Simulator**:
   - **Razorpay Sandbox Engine**: UPI QR, VPA, and Netbanking mock checkout with HMAC-SHA256 signature verification.
   - **Stripe Sandbox Engine**: PaymentIntent mock checkout with v1 timestamped HMAC signature verification.
   - **Developer Webhook Simulator**: Interactive console for firing simulated webhook events (`payment.captured`, `payment_intent.succeeded`, `payment.failed`) with tampered signature attack simulation.
   - **Server-Authoritative Reconciliation**: Prevents client-side double-counting; automatically updates invoice and customer balances upon verified webhook receipt.

6. **Offline-First Resilience**:
   - **Client Storage**: Full local dataset mirror in IndexedDB via Dexie.js.
   - **Mutation Queue**: Offline creates and edits are queued with unique mutation IDs and vector clocks.
   - **Bi-directional Sync**: Auto-syncs mutations when network reconnects, with automated and manual conflict resolution interfaces.
   - **Financial Safety Guard**: Untrusted financial actions and external payment checkouts require connectivity to preserve server-authoritative integrity.

7. **Invoice Generation & PDF Export**:
   - Instant client-side PDF invoice compilation via `jsPDF` and `jspdf-autotable`.
   - Complete tax breakdown, organization GSTIN, billing period, and status watermark.

8. **Role-Based Access Control (RBAC)**:
   - **Administrator**: Full platform access, gateway configuration, billing controls, user management, and audit logs.
   - **Internal Staff**: Operational management of customers, quotations, subscriptions, and payment recording.
   - **Customer Self-Service Portal**: View active subscriptions, download invoice PDFs, pay online via sandbox gateways, and request plan changes or cancellations.

---

## Project Structure

```
d:/Oodo Kochi/
├── backend/
│   ├── app/
│   │   ├── models/           # SQLAlchemy 2.0 ORM models
│   │   ├── routers/          # 17 modular FastAPI routers (auth, subscriptions, gateway, etc.)
│   │   ├── schemas/          # Pydantic v2 schemas and validation contracts
│   │   ├── services/         # Billing engine, sync engine, and payment gateways
│   │   │   └── payment_gateway/  # Razorpay & Stripe sandbox providers & factory
│   │   ├── database.py       # Engine & session management
│   │   ├── seed.py           # Production-realistic seed dataset
│   │   ├── migrate_db.py     # Idempotent schema upgrade utility
│   │   └── main.py           # Application entrypoint & background billing worker
│   ├── tests/                # 20 automated pytest test suites
│   ├── requirements.txt      # Python dependencies
│   └── venv/
└── frontend/
    ├── src/
    │   ├── api/              # Axios/Fetch API client with offline fallback
    │   ├── components/       # Google Stitch design components (Sidebar, Modals, Badges)
    │   ├── context/          # Auth, Theme, and Connectivity contexts
    │   ├── db/               # Dexie.js IndexedDB offline cache & mutation queue
    │   ├── pages/            # 28 application screen modules (Dashboard, Gateway Sandbox, Portal, etc.)
    │   ├── types/            # TypeScript domain interfaces
    │   ├── App.tsx           # Router and role-based route guard
    │   └── main.tsx
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.ts
```

---

## Getting Started

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Unix/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations and seed data
python -m app.migrate_db

# Start FastAPI development server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API interactive Swagger documentation will be available at:
`http://127.0.0.1:8000/docs`

### 2. Frontend Setup

```bash
cd frontend

# Install npm dependencies
npm install

# Start Vite development server
npm run dev
```

The application interface will be live at:
`http://localhost:5173`

### 3. Run Automated Tests

```bash
cd backend
python -m pytest tests/
```
All 20 test cases will execute and validate authentication, subscription state transitions, billing engine idempotency, data isolation, and payment gateway HMAC signature validation.

---

## Default Seed Accounts

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@brightloop.com` | `Admin@12345!` | Full system access, Gateway Sandbox, Billing Engine |
| **Internal Staff** | `staff@brightloop.com` | `Staff@12345!` | Quotations, Subscriptions, Customers, Payments |
| **Customer** | `customer@brightloop.com` | `Customer@12345!` | Self-Service Customer Portal, Invoice payments |

---

## Payment Gateway Sandbox

Brightloop includes an extensible mock payment gateway supporting:
- **Razorpay**: Key ID `rzp_test_brightloop123`, HMAC-SHA256 signature verification.
- **Stripe**: Publishable Key `pk_test_brightloop_stripe`, v1 timestamped HMAC verification.
- Access the developer console at `/gateway-sandbox` to fire webhook simulations and test attack rejection with corrupted signatures.

---

## License

Proprietary — Brightloop Software Solutions Pvt Ltd.
