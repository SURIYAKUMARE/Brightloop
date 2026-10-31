import React, { useState, useEffect } from 'react';
import { 
  UserCheck, RefreshCw, CreditCard, Download, AlertCircle, 
  CheckCircle2, Clock, Calendar, XCircle, ArrowUpRight, ShieldCheck 
} from 'lucide-react';
import { fetchSubscriptions, fetchInvoices, fetchPayments, apiRequest } from '../api/client';
import { Subscription, Invoice, Payment } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { PaymentGatewayModal } from '../components/PaymentGatewayModal';

export const CustomerPortalPage: React.FC = () => {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'invoices' | 'payments'>('subscriptions');

  // Request modals
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Online Payment Gateway Modal
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<Invoice | null>(null);
  const [isGatewayOpen, setIsGatewayOpen] = useState(false);

  const loadCustomerData = async () => {
    try {
      const [subs, invs, pays] = await Promise.all([
        fetchSubscriptions(),
        fetchInvoices(),
        fetchPayments()
      ]);
      setSubscriptions(subs);
      setInvoices(invs);
      setPayments(pays);
    } catch (e) {
      console.error('Error fetching customer self-service data:', e);
    }
  };

  useEffect(() => {
    loadCustomerData();
  }, []);

  const handleRequestCancel = async () => {
    if (!selectedSub) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/subscriptions/${selectedSub.id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: 'cancel', reason: actionReason || 'Customer requested cancellation via portal' })
      });
      setIsCancelModalOpen(false);
      await loadCustomerData();
      alert('Your cancellation request has been processed.');
    } catch (err: any) {
      alert(`Request failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestRenew = async () => {
    if (!selectedSub) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/subscriptions/${selectedSub.id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: 'renew', reason: 'Customer requested manual renewal via portal' })
      });
      setIsRenewModalOpen(false);
      await loadCustomerData();
      alert('Your subscription renewal has been processed.');
    } catch (err: any) {
      alert(`Renewal failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSubs = subscriptions.filter(s => s.status === 'active');
  const pastSubs = subscriptions.filter(s => s.status !== 'active');
  const unpaidInvoices = invoices.filter(i => i.balance_due > 0 && i.status !== 'cancelled');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Customer Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-brand-600 via-brand-700 to-violet-700 text-white shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white">
              Customer Self-Service Portal
            </span>
            <h1 className="text-2xl font-bold mt-1">
              Welcome, {user?.full_name || 'Subscriber'}
            </h1>
            <p className="text-xs text-brand-100 mt-0.5">
              Nexus Technologies Pvt Ltd • Account ID: #{user?.customer_id || 'CUST-1001'}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-[11px] text-brand-200">Total Outstanding Balance</span>
            <p className="font-mono text-2xl font-bold tabular-nums">
              ₹{unpaidInvoices.reduce((acc, i) => acc + i.balance_due, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'subscriptions'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>My Subscriptions ({subscriptions.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'invoices'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Billing Statements & Invoices ({invoices.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'payments'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Payment History ({payments.length})</span>
        </button>
      </div>

      {/* TAB 1: SUBSCRIPTIONS */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Active Services & Licenses</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSubs.map((sub) => (
              <div
                key={sub.id}
                className="p-5 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[10px] font-bold text-brand-600 dark:text-brand-400">
                      {sub.subscription_number}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {sub.items[0]?.description || 'Subscription Line'}
                    </h3>
                  </div>
                  <StatusBadge status={sub.status} size="sm" />
                </div>

                <div className="flex justify-between items-baseline pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Recurring Price:</span>
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                    ₹{sub.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {sub.billing_interval}
                  </span>
                </div>

                <div className="space-y-1.5 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Next Billing Date:</span>
                    <span className="font-mono text-slate-900 dark:text-white font-semibold">
                      {new Date(sub.next_billing_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Coverage:</span>
                    <span className="font-mono text-slate-500">
                      {new Date(sub.current_period_start).toLocaleDateString()} – {new Date(sub.current_period_end).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setSelectedSub(sub);
                      setIsRenewModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                  >
                    Renew Cycle
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSub(sub);
                      setIsCancelModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 font-semibold hover:bg-rose-100"
                  >
                    Request Cancellation
                  </button>
                </div>
              </div>
            ))}
          </div>

          {pastSubs.length > 0 && (
            <div className="mt-8 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Past / Inactive Subscriptions</h2>
              <div className="bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Subscription #</th>
                      <th className="px-4 py-2.5">Plan Description</th>
                      <th className="px-4 py-2.5">Amount</th>
                      <th className="px-4 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {pastSubs.map((s) => (
                      <tr key={s.id}>
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">{s.subscription_number}</td>
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{s.items[0]?.description}</td>
                        <td className="px-4 py-3 font-mono font-bold">₹{s.total_amount.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right"><StatusBadge status={s.status} size="sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INVOICES */}
      {activeTab === 'invoices' && (
        <div className="bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Invoice Date</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Balance Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono font-bold text-brand-600 dark:text-brand-400">
                    <Link to={`/invoices/${inv.id}`}>{inv.invoice_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {new Date(inv.invoice_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono">
                    {new Date(inv.due_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    ₹{inv.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold tabular-nums">
                    <span className={inv.balance_due > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}>
                      ₹{inv.balance_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {inv.balance_due > 0 && inv.status !== 'cancelled' && (
                        <button
                          onClick={() => {
                            setSelectedInvoiceToPay(inv);
                            setIsGatewayOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] shadow-sm transition"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Pay Online</span>
                        </button>
                      )}
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>View PDF</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: PAYMENTS */}
      {activeTab === 'payments' && (
        <div className="bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Payment #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Channel / Method</th>
                <th className="px-4 py-3">Transaction Reference</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{p.payment_number}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(p.payment_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 capitalize text-slate-700 dark:text-slate-300">{p.payment_method.replace('_', ' ')}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{p.transaction_reference || '—'}</td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    ₹{p.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusBadge status={p.status} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cancel Request Modal */}
      <Modal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Request Subscription Cancellation">
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-400">
            Please let us know why you wish to cancel subscription <strong>{selectedSub?.subscription_number}</strong>:
          </p>
          <textarea
            rows={3}
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            placeholder="Feedback or rationale..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setIsCancelModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 font-semibold">
              Return
            </button>
            <button
              onClick={handleRequestCancel}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm"
            >
              {isSubmitting ? 'Submitting...' : 'Confirm Cancellation Request'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Renew Modal */}
      <Modal isOpen={isRenewModalOpen} onClose={() => setIsRenewModalOpen(false)} title="Confirm Subscription Renewal">
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-400">
            Would you like to renew subscription <strong>{selectedSub?.subscription_number}</strong> for another cycle?
          </p>
          <p className="font-semibold text-slate-900 dark:text-white">
            Amount: ₹{selectedSub?.total_amount.toLocaleString('en-IN')} / {selectedSub?.billing_interval}
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setIsRenewModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 font-semibold">
              Cancel
            </button>
            <button
              onClick={handleRequestRenew}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm"
            >
              {isSubmitting ? 'Renewing...' : 'Renew Subscription'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Payment Gateway Modal */}
      <PaymentGatewayModal
        invoice={selectedInvoiceToPay}
        isOpen={isGatewayOpen}
        onClose={() => setIsGatewayOpen(false)}
        onSuccess={loadCustomerData}
      />
    </div>
  );
};
