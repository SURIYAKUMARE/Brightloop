import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Pause, Play, XCircle, RefreshCw, Layers, 
  Calendar, CheckCircle, Clock, Shield, AlertTriangle 
} from 'lucide-react';
import { apiRequest, fetchPlans } from '../api/client';
import { Subscription, SubscriptionPlan } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

export const SubscriptionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Action Modals
  const [isPauseOpen, setIsPauseOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('Customer temporary service pause');
  const [cancelReason, setCancelReason] = useState('Customer contract restructuring');
  const [selectedPlanId, setSelectedPlanId] = useState<number>(0);
  const [isActionPending, setIsActionPending] = useState(false);

  const loadSubscription = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<Subscription>(`/subscriptions/${id}`);
      setSub(data);
      const allPlans = await fetchPlans();
      setPlans(allPlans);
      if (allPlans.length > 0) setSelectedPlanId(allPlans[0].id);
    } catch (e) {
      console.error('Error loading subscription:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubscription();
  }, [id]);

  const executeAction = async (action: string, extraBody: any = {}) => {
    setIsActionPending(true);
    try {
      const res = await apiRequest<Subscription>(`/subscriptions/${id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, ...extraBody })
      });
      setSub(res);
      setIsPauseOpen(false);
      setIsCancelOpen(false);
      setIsUpgradeOpen(false);
    } catch (err: any) {
      alert(`Action error: ${err.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  if (isLoading || !sub) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Loading subscription record...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/subscriptions')}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                {sub.subscription_number}
              </h1>
              <StatusBadge status={sub.status} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Customer: <strong className="text-slate-900 dark:text-white">{sub.customer_name}</strong> ({sub.customer_email})
            </p>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="flex items-center gap-2">
          {sub.status === 'active' && (
            <>
              {sub.allow_pause && (
                <button
                  onClick={() => setIsPauseOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-charcoal-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-sm transition-colors"
                >
                  <Pause className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pause</span>
                </button>
              )}
              <button
                onClick={() => setIsUpgradeOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-charcoal-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-sm transition-colors"
              >
                <Layers className="w-3.5 h-3.5 text-brand-600" />
                <span>Change Plan</span>
              </button>
              <button
                onClick={() => setIsCancelOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-semibold shadow-sm hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </>
          )}

          {sub.status === 'paused' && (
            <button
              onClick={() => executeAction('resume')}
              disabled={isActionPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume Active Subscription</span>
            </button>
          )}

          {(sub.status === 'pending_renewal' || sub.status === 'expired') && (
            <button
              onClick={() => executeAction('renew')}
              disabled={isActionPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Renew Subscription Now</span>
            </button>
          )}
        </div>
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Contract Schedule</h2>
          <div className="flex justify-between">
            <span className="text-slate-500">Billing Interval:</span>
            <span className="font-semibold capitalize text-slate-900 dark:text-white">{sub.billing_interval}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Current Period:</span>
            <span className="font-mono text-slate-900 dark:text-white">
              {new Date(sub.current_period_start).toLocaleDateString()} – {new Date(sub.current_period_end).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Next Billing Date:</span>
            <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
              {new Date(sub.next_billing_date).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Auto Renew:</span>
            <span className="font-semibold text-slate-900 dark:text-white">{sub.auto_renew ? 'Yes' : 'No'}</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Financial Value</h2>
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal:</span>
            <span className="font-mono text-slate-900 dark:text-white">₹{sub.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Taxes:</span>
            <span className="font-mono text-slate-900 dark:text-white">+₹{sub.tax_amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Discounts:</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">-₹{sub.discount_amount.toFixed(2)}</span>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-bold text-sm">
            <span>Recurring Total:</span>
            <span className="font-mono text-brand-600 dark:text-brand-400">₹{sub.total_amount.toFixed(2)}</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Governance Policies</h2>
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <CheckCircle className={`w-3.5 h-3.5 ${sub.allow_pause ? 'text-emerald-500' : 'text-slate-300'}`} />
            <span>Pausing allowed: {sub.allow_pause ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <CheckCircle className={`w-3.5 h-3.5 ${sub.allow_early_closure ? 'text-emerald-500' : 'text-slate-300'}`} />
            <span>Early cancellation allowed: {sub.allow_early_closure ? 'Enabled' : 'Disabled'}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Automated recurring invoice generated on each next billing date.
          </p>
        </div>
      </div>

      {/* Subscription Line Items */}
      <div className="p-5 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          Subscription Product Lines & Variants
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="px-3 py-2 rounded-l-md">Description</th>
                <th className="px-3 py-2 text-center">Qty</th>
                <th className="px-3 py-2">Unit Price</th>
                <th className="px-3 py-2">Tax Rate</th>
                <th className="px-3 py-2 text-right rounded-r-md">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sub.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">
                    {item.description}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono font-bold">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300">
                    ₹{item.unit_price.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-500">
                    {item.tax_rate}%
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                    ₹{item.total_price.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Activity Timeline */}
      <div className="p-5 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-brand-600" />
          Subscription Activity Timeline & Audit Trail
        </h2>

        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {sub.timeline.map((event) => (
            <div key={event.id} className="relative">
              <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-brand-600 ring-4 ring-white dark:ring-charcoal-900" />
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-slate-900 dark:text-white text-xs">
                  {event.description}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {new Date(event.created_at).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                <span>By: {event.performed_by_name || 'System Billing Engine'}</span>
                {event.old_status && event.new_status && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px]">
                    {event.old_status} → {event.new_status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pause Modal */}
      <Modal isOpen={isPauseOpen} onClose={() => setIsPauseOpen(false)} title="Pause Active Subscription">
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-400">
            Pausing this subscription will freeze billing until resumed. Please provide a reason:
          </p>
          <input
            type="text"
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setIsPauseOpen(false)} className="px-3 py-1.5 rounded-lg text-slate-600 font-semibold">
              Cancel
            </button>
            <button
              onClick={() => executeAction('pause', { reason: pauseReason })}
              disabled={isActionPending}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm"
            >
              Confirm Pause
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal isOpen={isCancelOpen} onClose={() => setIsCancelOpen(false)} title="Cancel Subscription">
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-400">
            Are you sure you want to cancel subscription <strong>{sub.subscription_number}</strong>?
          </p>
          <input
            type="text"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setIsCancelOpen(false)} className="px-3 py-1.5 rounded-lg text-slate-600 font-semibold">
              Return
            </button>
            <button
              onClick={() => executeAction('cancel', { reason: cancelReason })}
              disabled={isActionPending}
              className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm"
            >
              Cancel Subscription
            </button>
          </div>
        </div>
      </Modal>

      {/* Upgrade / Change Plan Modal */}
      <Modal isOpen={isUpgradeOpen} onClose={() => setIsUpgradeOpen(false)} title="Change Subscription Plan Tier">
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-400">
            Select a new subscription plan for this account:
          </p>
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(parseInt(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — ₹{p.base_price.toLocaleString('en-IN')} / {p.billing_interval}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setIsUpgradeOpen(false)} className="px-3 py-1.5 rounded-lg text-slate-600 font-semibold">
              Cancel
            </button>
            <button
              onClick={() => executeAction('upgrade', { new_plan_id: selectedPlanId })}
              disabled={isActionPending}
              className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm"
            >
              Apply Plan Change
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
