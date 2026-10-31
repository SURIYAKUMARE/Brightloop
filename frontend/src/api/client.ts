import { offlineDB, queueOfflineMutation, getPendingMutations, markMutationStatus } from '../db';
import {
  Customer, Product, SubscriptionPlan, Quotation, Subscription,
  Invoice, Payment, DashboardKPIs, GatewayConfig, GatewayOrderResponse, GatewaySimulateResult
} from '../types';

const API_BASE = '/api/v1';

export function getAuthToken(): string | null {
  return localStorage.getItem('brightloop_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('brightloop_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('brightloop_token');
  localStorage.removeItem('brightloop_user');
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP Error ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ----------------- DATA REPOSITORY WITH OFFLINE FALLBACK -----------------

// Customers
export async function fetchCustomers(): Promise<Customer[]> {
  if (navigator.onLine) {
    try {
      const data = await apiRequest<Customer[]>('/customers/');
      // Cache locally in Dexie
      await offlineDB.customers.clear();
      await offlineDB.customers.bulkPut(data);
      return data;
    } catch (e) {
      console.warn('Network fetch failed, reading from IndexedDB:', e);
    }
  }
  return await offlineDB.customers.toArray();
}

export async function createCustomer(payload: Partial<Customer>): Promise<Customer> {
  if (navigator.onLine) {
    try {
      const created = await apiRequest<Customer>('/customers/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await offlineDB.customers.put(created);
      return created;
    } catch (e) {
      console.warn('Online create failed, falling back to offline queue:', e);
    }
  }

  // Offline mode
  const localId = Date.now();
  const optimisticCust: Customer = {
    id: localId,
    name: payload.name || 'New Customer',
    email: payload.email || '',
    phone: payload.phone,
    company_name: payload.company_name,
    tax_id: payload.tax_id,
    billing_address: payload.billing_address,
    currency: payload.currency || 'INR',
    outstanding_balance: 0,
    status: 'active',
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await offlineDB.customers.put(optimisticCust);
  await queueOfflineMutation('customer', 'create', optimisticCust, 1);
  return optimisticCust;
}

// Products
export async function fetchProducts(): Promise<Product[]> {
  if (navigator.onLine) {
    try {
      const data = await apiRequest<Product[]>('/products/');
      await offlineDB.products.clear();
      await offlineDB.products.bulkPut(data);
      return data;
    } catch (e) {
      console.warn('Network product fetch failed, reading from IndexedDB:', e);
    }
  }
  return await offlineDB.products.toArray();
}

// Plans
export async function fetchPlans(): Promise<SubscriptionPlan[]> {
  if (navigator.onLine) {
    try {
      const data = await apiRequest<SubscriptionPlan[]>('/plans/');
      await offlineDB.plans.clear();
      await offlineDB.plans.bulkPut(data);
      return data;
    } catch (e) {
      console.warn('Network plan fetch failed, reading from IndexedDB:', e);
    }
  }
  return await offlineDB.plans.toArray();
}

// Quotations
export async function fetchQuotations(): Promise<Quotation[]> {
  if (navigator.onLine) {
    try {
      const data = await apiRequest<Quotation[]>('/quotations/');
      await offlineDB.quotations.clear();
      await offlineDB.quotations.bulkPut(data);
      return data;
    } catch (e) {
      console.warn('Network quotation fetch failed, reading from IndexedDB:', e);
    }
  }
  return await offlineDB.quotations.toArray();
}

export async function createQuotation(payload: any): Promise<Quotation> {
  if (navigator.onLine) {
    try {
      const created = await apiRequest<Quotation>('/quotations/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await offlineDB.quotations.put(created);
      return created;
    } catch (e) {
      console.warn('Online create quotation failed, falling back to offline queue:', e);
    }
  }

  // Offline optimistic quotation
  const localId = Date.now();
  const optimisticQ: Quotation = {
    id: localId,
    quotation_number: `QT-OFFLINE-${localId.toString().slice(-4)}`,
    customer_id: payload.customer_id,
    status: 'draft',
    valid_until: payload.valid_until,
    subtotal: payload.items.reduce((acc: number, item: any) => acc + (item.unit_price * item.quantity), 0),
    tax_amount: 0,
    discount_amount: 0,
    total_amount: payload.items.reduce((acc: number, item: any) => acc + (item.unit_price * item.quantity), 0),
    notes: payload.notes,
    terms: payload.terms,
    items: payload.items,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await offlineDB.quotations.put(optimisticQ);
  await queueOfflineMutation('quotation', 'create', optimisticQ, 1);
  return optimisticQ;
}

// Subscriptions
export async function fetchSubscriptions(): Promise<Subscription[]> {
  if (navigator.onLine) {
    try {
      const data = await apiRequest<Subscription[]>('/subscriptions/');
      await offlineDB.subscriptions.clear();
      await offlineDB.subscriptions.bulkPut(data);
      return data;
    } catch (e) {
      console.warn('Network subscription fetch failed, reading from IndexedDB:', e);
    }
  }
  return await offlineDB.subscriptions.toArray();
}

export async function createSubscription(payload: any): Promise<Subscription> {
  if (navigator.onLine) {
    try {
      const created = await apiRequest<Subscription>('/subscriptions/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await offlineDB.subscriptions.put(created);
      return created;
    } catch (e) {
      console.warn('Online create subscription failed, queuing offline:', e);
    }
  }

  const localId = Date.now();
  const optimisticSub: Subscription = {
    id: localId,
    subscription_number: `SUB-OFFLINE-${localId.toString().slice(-4)}`,
    customer_id: payload.customer_id,
    plan_id: payload.plan_id,
    status: 'draft',
    start_date: payload.start_date,
    current_period_start: payload.start_date,
    current_period_end: payload.start_date,
    next_billing_date: payload.start_date,
    billing_interval: payload.billing_interval || 'monthly',
    payment_terms: payload.payment_terms || 'immediate',
    auto_renew: payload.auto_renew ?? true,
    allow_pause: true,
    allow_early_closure: true,
    subtotal: payload.items.reduce((acc: number, item: any) => acc + (item.unit_price * item.quantity), 0),
    tax_amount: 0,
    discount_amount: 0,
    total_amount: payload.items.reduce((acc: number, item: any) => acc + (item.unit_price * item.quantity), 0),
    currency: 'INR',
    items: payload.items,
    timeline: [{
      id: Date.now(),
      event_type: 'creation',
      description: 'Created offline draft subscription.',
      created_at: new Date().toISOString()
    }],
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await offlineDB.subscriptions.put(optimisticSub);
  await queueOfflineMutation('subscription', 'create', optimisticSub, 1);
  return optimisticSub;
}

// Invoices
export async function fetchInvoices(): Promise<Invoice[]> {
  if (navigator.onLine) {
    try {
      const data = await apiRequest<Invoice[]>('/invoices/');
      await offlineDB.invoices.clear();
      await offlineDB.invoices.bulkPut(data);
      return data;
    } catch (e) {
      console.warn('Network invoice fetch failed, reading from IndexedDB:', e);
    }
  }
  return await offlineDB.invoices.toArray();
}

// Payments
export async function fetchPayments(): Promise<Payment[]> {
  if (navigator.onLine) {
    try {
      const data = await apiRequest<Payment[]>('/payments/');
      await offlineDB.payments.clear();
      await offlineDB.payments.bulkPut(data);
      return data;
    } catch (e) {
      console.warn('Network payments fetch failed, reading from IndexedDB:', e);
    }
  }
  return await offlineDB.payments.toArray();
}

export async function recordPayment(payload: any): Promise<Payment> {
  if (navigator.onLine) {
    try {
      const created = await apiRequest<Payment>('/payments/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await offlineDB.payments.put(created);
      return created;
    } catch (e) {
      console.warn('Online record payment failed, queuing offline:', e);
    }
  }

  const localId = Date.now();
  const optimisticPay: Payment = {
    id: localId,
    payment_number: `PAY-OFFLINE-${localId.toString().slice(-4)}`,
    invoice_id: payload.invoice_id,
    customer_id: payload.customer_id,
    payment_method: payload.payment_method,
    amount: parseFloat(payload.amount),
    payment_date: payload.payment_date,
    transaction_reference: payload.transaction_reference,
    notes: payload.notes,
    status: 'pending', // Offline safety rule: Queued payments are marked pending until server confirmed
    allocations: [],
    created_at: new Date().toISOString()
  };

  await offlineDB.payments.put(optimisticPay);
  await queueOfflineMutation('payment', 'create', optimisticPay, 1);
  return optimisticPay;
}

// ----------------- OFFLINE RECONCILIATION & SYNC -----------------

export async function syncOfflineMutations(): Promise<{
  success_count: number;
  conflict_count: number;
  results: any[];
}> {
  if (!navigator.onLine) {
    throw new Error('Device is currently offline. Synchronization requires network connectivity.');
  }

  const pending = await getPendingMutations();
  if (pending.length === 0) {
    return { success_count: 0, conflict_count: 0, results: [] };
  }

  const payload = {
    mutations: pending.map((m) => ({
      client_mutation_id: m.client_mutation_id,
      entity_type: m.entity_type,
      action: m.action,
      client_version: m.client_version || 1,
      payload: m.payload
    }))
  };

  const response = await apiRequest<any>('/sync/batch', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  // Mark local mutations status
  for (const res of response.results) {
    if (res.status === 'applied') {
      await markMutationStatus(res.client_mutation_id, 'synced');
    } else if (res.status === 'conflict') {
      await markMutationStatus(res.client_mutation_id, 'conflict', res.server_record ? JSON.stringify(res.server_record) : 'Version conflict');
    } else {
      await markMutationStatus(res.client_mutation_id, 'failed', res.error || 'Server rejected');
    }
  }

  // Refresh local cache with latest server dataset
  await fetchCustomers();
  await fetchProducts();
  await fetchPlans();
  await fetchQuotations();
  await fetchSubscriptions();
  await fetchInvoices();
  await fetchPayments();

  return response;
}

// ----------------- PAYMENT GATEWAY SANDBOX APIS -----------------

export async function fetchGatewayConfig(): Promise<GatewayConfig> {
  return await apiRequest<GatewayConfig>('/gateway/config');
}

export async function createGatewayOrder(
  invoiceId: number,
  provider: 'razorpay' | 'stripe',
  amount?: number
): Promise<GatewayOrderResponse> {
  if (!navigator.onLine) {
    throw new Error('Online payment gateway checkout requires an active internet connection.');
  }
  return await apiRequest<GatewayOrderResponse>('/gateway/create-order', {
    method: 'POST',
    body: JSON.stringify({
      invoice_id: invoiceId,
      provider,
      amount
    })
  });
}

export async function verifyGatewayPayment(payload: {
  provider: 'razorpay' | 'stripe';
  invoice_id: number;
  order_id: string;
  payment_id: string;
  signature?: string;
}): Promise<{
  verified: boolean;
  reconciled: boolean;
  payment_id?: number;
  payment_number?: string;
  invoice_status?: string;
  message: string;
}> {
  if (!navigator.onLine) {
    throw new Error('Online payment verification requires network connectivity.');
  }
  return await apiRequest('/gateway/verify-payment', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function simulateGatewayWebhook(payload: {
  provider: 'razorpay' | 'stripe';
  event_type: string;
  invoice_id: number;
  amount?: number;
  simulate_signature_failure?: boolean;
}): Promise<GatewaySimulateResult> {
  return await apiRequest<GatewaySimulateResult>('/gateway/simulate-webhook', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function fetchGatewayTransactions(provider?: string): Promise<Payment[]> {
  const query = provider ? `?provider=${encodeURIComponent(provider)}` : '';
  return await apiRequest<Payment[]>(`/gateway/transactions${query}`);
}
