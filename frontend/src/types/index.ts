export type UserRole = 'admin' | 'staff' | 'customer';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  status: string;
  phone?: string;
  avatar_url?: string;
  customer_id?: number;
  created_at: string;
}

export interface Customer {
  id: number;
  user_id?: number;
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
  tax_id?: string;
  billing_address?: string;
  shipping_address?: string;
  currency: string;
  outstanding_balance: number;
  status: 'active' | 'inactive' | 'archived';
  notes?: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  name: string;
  sku: string;
  additional_price: number;
  status: string;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  product_type: string;
  sku: string;
  sales_price: number;
  cost_price: number;
  image_url?: string;
  notes?: string;
  status: 'active' | 'archived';
  variants: ProductVariant[];
  created_at: string;
  updated_at: string;
  version: number;
}

export interface SubscriptionPlan {
  id: number;
  name: string;
  product_id: number;
  product_name?: string;
  billing_interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  base_price: number;
  min_quantity: number;
  max_quantity: number;
  start_date?: string;
  end_date?: string;
  description?: string;
  auto_close: boolean;
  allow_early_closure: boolean;
  allow_pause: boolean;
  allow_renewal: boolean;
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface QuotationItem {
  id?: number;
  product_id: number;
  variant_id?: number;
  plan_id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_amount: number;
  total_price: number;
}

export interface Quotation {
  id: number;
  quotation_number: string;
  customer_id: number;
  customer_name?: string;
  customer_email?: string;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'converted';
  valid_until: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  terms?: string;
  items: QuotationItem[];
  created_at: string;
  updated_at: string;
  version: number;
}

export interface SubscriptionItem {
  id?: number;
  product_id: number;
  variant_id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_amount: number;
  total_price: number;
}

export interface SubscriptionTimeline {
  id: number;
  event_type: string;
  old_status?: string;
  new_status?: string;
  description: string;
  performed_by_name?: string;
  created_at: string;
}

export interface Subscription {
  id: number;
  subscription_number: string;
  customer_id: number;
  customer_name?: string;
  customer_email?: string;
  plan_id?: number;
  plan_name?: string;
  status: 'draft' | 'quotation' | 'confirmed' | 'active' | 'paused' | 'expired' | 'pending_renewal' | 'cancelled' | 'closed';
  start_date: string;
  expiry_date?: string;
  current_period_start: string;
  current_period_end: string;
  next_billing_date: string;
  billing_interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  payment_terms: string;
  auto_renew: boolean;
  allow_pause: boolean;
  allow_early_closure: boolean;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  notes?: string;
  items: SubscriptionItem[];
  timeline: SubscriptionTimeline[];
  created_at: string;
  updated_at: string;
  version: number;
}

export interface InvoiceItem {
  id?: number;
  product_id: number;
  variant_id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_amount: number;
  total_price: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number;
  customer_name?: string;
  customer_email?: string;
  company_name?: string;
  tax_id?: string;
  billing_address?: string;
  subscription_id?: number;
  subscription_number?: string;
  status: 'draft' | 'confirmed' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
  invoice_date: string;
  due_date: string;
  period_start: string;
  period_end: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes?: string;
  items: InvoiceItem[];
  created_at: string;
  updated_at: string;
  version: number;
}

export interface PaymentAllocation {
  id: number;
  invoice_id: number;
  invoice_number?: string;
  allocated_amount: number;
}

export interface Payment {
  id: number;
  payment_number: string;
  invoice_id?: number;
  invoice_number?: string;
  customer_id: number;
  customer_name?: string;
  payment_method: 'cash' | 'bank_transfer' | 'upi' | 'card' | 'other';
  amount: number;
  payment_date: string;
  transaction_reference?: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'failed' | 'refunded';
  gateway_provider?: 'razorpay' | 'stripe' | 'manual';
  gateway_order_id?: string;
  gateway_payment_id?: string;
  allocations: PaymentAllocation[];
  created_at: string;
}

export interface TaxRule {
  id: number;
  name: string;
  rate_percentage: number;
  is_compound: boolean;
  tax_type: string;
  is_active: boolean;
}

export interface DiscountRule {
  id: number;
  code: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  value: number;
  min_purchase_amount: number;
  min_quantity: number;
  max_usage_count: number;
  current_usage_count: number;
  is_active: boolean;
}

export interface DashboardKPIs {
  total_customers: number;
  total_subscriptions: number;
  active_subscriptions: number;
  new_subscriptions_month: number;
  mrr: number;
  arr: number;
  revenue_collected: number;
  outstanding_revenue: number;
  overdue_invoices_count: number;
  upcoming_renewals_count: number;
  churn_rate: number;
  arpu: number;
}

export interface RevenueTrendItem {
  month: string;
  collected: number;
  invoiced: number;
}

export interface OrganizationSettings {
  id: number;
  company_name: string;
  company_email: string;
  company_phone: string;
  company_address: string;
  tax_id: string;
  currency: string;
  currency_symbol: string;
  auto_billing_enabled: boolean;
  grace_period_days: number;
  gateway_mode: 'sandbox' | 'live';
  razorpay_key_id: string;
  razorpay_key_secret: string;
  razorpay_webhook_secret: string;
  stripe_publishable_key: string;
  stripe_secret_key: string;
  stripe_webhook_secret: string;
}

export interface GatewayConfig {
  gateway_mode: 'sandbox' | 'live';
  razorpay_enabled: boolean;
  razorpay_key_id: string;
  stripe_enabled: boolean;
  stripe_publishable_key: string;
}

export interface GatewayOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  provider: string;
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  publishable_key: string;
  notes?: string;
}

export interface GatewaySimulateResult {
  success: boolean;
  event: string;
  signature_valid: boolean;
  reconciled: boolean;
  invoice_status: string;
  payment_id?: number;
  payment_number?: string;
  message: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link?: string;
  created_at: string;
}

export interface AuditLogItem {
  id: number;
  entity_type: string;
  entity_id?: number;
  action: string;
  details?: string;
  user_email?: string;
  ip_address?: string;
  created_at: string;
}

export interface OfflineMutation {
  id?: number;
  client_mutation_id: string;
  entity_type: 'customer' | 'product' | 'quotation' | 'subscription' | 'invoice' | 'payment';
  action: 'create' | 'update' | 'delete';
  client_version?: number;
  payload: any;
  created_at: string;
  status: 'pending' | 'synced' | 'conflict' | 'failed';
  error_message?: string;
}
