import Dexie, { type EntityTable } from 'dexie';
import { Customer, Product, SubscriptionPlan, Quotation, Subscription, Invoice, Payment, OfflineMutation } from '../types';

export class BrightloopOfflineDB extends Dexie {
  customers!: EntityTable<Customer, 'id'>;
  products!: EntityTable<Product, 'id'>;
  plans!: EntityTable<SubscriptionPlan, 'id'>;
  quotations!: EntityTable<Quotation, 'id'>;
  subscriptions!: EntityTable<Subscription, 'id'>;
  invoices!: EntityTable<Invoice, 'id'>;
  payments!: EntityTable<Payment, 'id'>;
  mutations!: EntityTable<OfflineMutation, 'id'>;

  constructor() {
    super('brightloop_offline_db');
    this.version(1).stores({
      customers: '++id, email, name, status, version',
      products: '++id, sku, name, status, product_type',
      plans: '++id, product_id, billing_interval, status',
      quotations: '++id, quotation_number, customer_id, status',
      subscriptions: '++id, subscription_number, customer_id, plan_id, status, next_billing_date',
      invoices: '++id, invoice_number, customer_id, subscription_id, status, due_date',
      payments: '++id, payment_number, customer_id, invoice_id, payment_method, status',
      mutations: '++id, client_mutation_id, entity_type, action, status, created_at'
    });
  }
}

export const offlineDB = new BrightloopOfflineDB();

// Helper to push an offline mutation to the queue
export async function queueOfflineMutation(
  entity_type: OfflineMutation['entity_type'],
  action: OfflineMutation['action'],
  payload: any,
  client_version: number = 1
): Promise<string> {
  const mutationId = `mut-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const mutation: OfflineMutation = {
    client_mutation_id: mutationId,
    entity_type,
    action,
    client_version,
    payload,
    created_at: new Date().toISOString(),
    status: 'pending'
  };

  await offlineDB.mutations.add(mutation);
  return mutationId;
}

export async function getPendingMutations(): Promise<OfflineMutation[]> {
  return await offlineDB.mutations.where('status').equals('pending').toArray();
}

export async function markMutationStatus(
  client_mutation_id: string,
  status: 'synced' | 'conflict' | 'failed',
  error_message?: string
) {
  const existing = await offlineDB.mutations.where('client_mutation_id').equals(client_mutation_id).first();
  if (existing && existing.id) {
    await offlineDB.mutations.update(existing.id, { status, error_message });
  }
}
