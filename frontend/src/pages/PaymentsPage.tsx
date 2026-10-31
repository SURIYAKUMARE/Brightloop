import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Search, Filter, CheckCircle2, ArrowDownLeft } from 'lucide-react';
import { fetchPayments, fetchCustomers, fetchInvoices, recordPayment } from '../api/client';
import { Payment, Customer, Invoice } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

export const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // New Payment Form State
  const [customerId, setCustomerId] = useState<number>(0);
  const [invoiceId, setInvoiceId] = useState<number | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'upi' | 'card' | 'cash'>('bank_transfer');
  const [amount, setAmount] = useState<string>('');
  const [txnRef, setTxnRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const [payData, custData, invData] = await Promise.all([
        fetchPayments(),
        fetchCustomers(),
        fetchInvoices()
      ]);
      setPayments(payData);
      setCustomers(custData);
      setInvoices(invData);
      if (custData.length > 0 && !customerId) {
        setCustomerId(custData[0].id);
      }
    } catch (e) {
      console.error('Error loading payments:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await recordPayment({
        customer_id: customerId,
        invoice_id: invoiceId || undefined,
        payment_method: paymentMethod,
        amount: parseFloat(amount),
        payment_date: new Date().toISOString(),
        transaction_reference: txnRef || `TXN-${Date.now().toString().slice(-6)}`,
        notes
      });
      setIsModalOpen(false);
      setAmount('');
      setTxnRef('');
      setNotes('');
      await loadData();
    } catch (err: any) {
      alert(`Payment recording failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = payments.filter(p => {
    const matchesSearch = p.payment_number.toLowerCase().includes(search.toLowerCase()) ||
      (p.customer_name && p.customer_name.toLowerCase().includes(search.toLowerCase())) ||
      (p.transaction_reference && p.transaction_reference.toLowerCase().includes(search.toLowerCase()));
    const matchesMethod = methodFilter === 'all' || p.payment_method === methodFilter;
    return matchesSearch && matchesMethod;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Payments Ledger & Reconciliation
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Record multi-channel receipts (Bank Transfer, UPI, Card, Cash), allocate against outstanding invoices, and settle balances.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Record New Payment</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search payment #, ref, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Method:</label>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Payment Channels</option>
            <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
            <option value="upi">UPI (GPay / PhonePe)</option>
            <option value="card">Card</option>
            <option value="cash">Cash / Cheque</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Receipt #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Channel / Method</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Transaction Ref</th>
                <th className="px-4 py-3">Amount Received</th>
                <th className="px-4 py-3">Settlement Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((pay) => (
                <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                    {pay.payment_number}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {pay.customer_name || 'Customer'}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">
                    {pay.payment_method.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono">
                    {new Date(pay.payment_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">
                    {pay.transaction_reference || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums text-sm">
                    ₹{pay.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={pay.status} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Incoming Customer Payment">
        <form onSubmit={handleCreatePayment} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Customer Account *</label>
            <select
              value={customerId}
              onChange={(e) => {
                const cid = parseInt(e.target.value);
                setCustomerId(cid);
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — Outstanding: ₹{c.outstanding_balance.toLocaleString('en-IN')}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                <option value="card">Credit / Debit Card</option>
                <option value="cash">Cash / Cheque</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="2500.00"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Bank / UTR Transaction Reference</label>
            <input
              type="text"
              value={txnRef}
              onChange={(e) => setTxnRef(e.target.value)}
              placeholder="e.g. HDFC_982341209"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Internal Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Verified against bank statement..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg text-slate-600 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
            >
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
