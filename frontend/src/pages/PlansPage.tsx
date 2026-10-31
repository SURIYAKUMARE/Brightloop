import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Check, Clock, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { fetchPlans, fetchProducts, apiRequest } from '../api/client';
import { SubscriptionPlan, Product } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

export const PlansPage: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // New Plan form state
  const [name, setName] = useState('');
  const [productId, setProductId] = useState<number>(0);
  const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [basePrice, setBasePrice] = useState('');
  const [minQty, setMinQty] = useState(1);
  const [maxQty, setMaxQty] = useState(100);
  const [allowPause, setAllowPause] = useState(true);
  const [allowRenewal, setAllowRenewal] = useState(true);
  const [allowEarlyClosure, setAllowEarlyClosure] = useState(true);
  const [description, setDescription] = useState('');

  const loadData = async () => {
    try {
      const [plansData, prodsData] = await Promise.all([fetchPlans(), fetchProducts()]);
      setPlans(plansData);
      setProducts(prodsData);
      if (prodsData.length > 0 && !productId) {
        setProductId(prodsData[0].id);
      }
    } catch (e) {
      console.error('Error loading plans:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/plans/', {
        method: 'POST',
        body: JSON.stringify({
          name,
          product_id: productId,
          billing_interval: interval,
          base_price: parseFloat(basePrice),
          min_quantity: minQty,
          max_quantity: maxQty,
          allow_pause: allowPause,
          allow_renewal: allowRenewal,
          allow_early_closure: allowEarlyClosure,
          description,
          status: 'active'
        })
      });
      setIsModalOpen(false);
      setName('');
      setBasePrice('');
      setDescription('');
      await loadData();
    } catch (err: any) {
      alert(`Error creating plan: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Subscription Plans & Billing Schedules
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure flexible recurring intervals (daily, weekly, monthly, yearly), pauses, and renewal policies.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Plan</span>
        </button>
      </div>

      {/* Plans Matrix Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="flex flex-col justify-between p-6 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                    {plan.billing_interval}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-2">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {plan.product_name || 'Business Software'}
                  </p>
                </div>
                <StatusBadge status={plan.status} size="sm" />
              </div>

              {/* Pricing Display */}
              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
                  ₹{plan.base_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  / {plan.billing_interval}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 line-clamp-2">
                {plan.description || 'Enterprise grade recurring billing schedule.'}
              </p>

              {/* Policies Checklist */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Check className={`w-3.5 h-3.5 ${plan.allow_pause ? 'text-emerald-500' : 'text-slate-300'}`} />
                  <span>Pause & Resume Permitted: {plan.allow_pause ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Check className={`w-3.5 h-3.5 ${plan.allow_renewal ? 'text-emerald-500' : 'text-slate-300'}`} />
                  <span>Automatic Renewal Eligible: {plan.allow_renewal ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Check className={`w-3.5 h-3.5 ${plan.allow_early_closure ? 'text-emerald-500' : 'text-slate-300'}`} />
                  <span>Early Cancellation Allowed: {plan.allow_early_closure ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Qty Limits: {plan.min_quantity} – {plan.max_quantity} units</span>
              <span className="font-mono font-medium">Plan #{plan.id}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Create Plan Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Configure Subscription Plan">
        <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Plan Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cloud ERP Pro Monthly"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Related Product *</label>
              <select
                value={productId}
                onChange={(e) => setProductId(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Billing Interval *</label>
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Base Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="2499.00"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Min Quantity</label>
              <input
                type="number"
                value={minQty}
                onChange={(e) => setMinQty(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Max Quantity</label>
              <input
                type="number"
                value={maxQty}
                onChange={(e) => setMaxQty(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Policy Toggles */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={allowPause}
                onChange={(e) => setAllowPause(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>Allow Customer / Staff to Pause Subscription</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={allowRenewal}
                onChange={(e) => setAllowRenewal(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>Allow Automatic Cycle Renewal</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={allowEarlyClosure}
                onChange={(e) => setAllowEarlyClosure(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>Allow Early Cancellation</span>
            </label>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Full software access with automated renewal..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm"
            >
              Create Plan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
