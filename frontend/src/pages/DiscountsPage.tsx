import React, { useState, useEffect } from 'react';
import { Tag, Plus, Check, Percent, DollarSign, Calendar } from 'lucide-react';
import { apiRequest } from '../api/client';
import { DiscountRule, TaxRule } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

export const DiscountsPage: React.FC = () => {
  const [discounts, setDiscounts] = useState<DiscountRule[]>([]);
  const [taxes, setTaxes] = useState<TaxRule[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Discount Form
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('');
  const [minPurchase, setMinPurchase] = useState('0');
  const [maxUsage, setMaxUsage] = useState('100');

  const loadRules = async () => {
    try {
      const [discData, taxData] = await Promise.all([
        apiRequest<DiscountRule[]>('/rules/discounts'),
        apiRequest<TaxRule[]>('/rules/taxes')
      ]);
      setDiscounts(discData);
      setTaxes(taxData);
    } catch (e) {
      console.error('Error fetching rules:', e);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/rules/discounts', {
        method: 'POST',
        body: JSON.stringify({
          code: code.toUpperCase(),
          name,
          discount_type: discountType,
          value: parseFloat(value),
          min_purchase_amount: parseFloat(minPurchase),
          max_usage_count: parseInt(maxUsage),
          is_active: true
        })
      });
      setIsModalOpen(false);
      setCode('');
      setName('');
      setValue('');
      await loadRules();
    } catch (err: any) {
      alert(`Error creating discount: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Discount & Tax Rules Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure promotional percentage vouchers, loyalty coupons, and statutory GST / VAT rates.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create Discount Rule</span>
        </button>
      </div>

      {/* Tax Rates Banner */}
      <div className="p-4 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Configured Statutory Tax Rules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {taxes.map((t) => (
            <div key={t.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{t.name}</p>
                <p className="text-[10px] text-slate-400 uppercase">{t.tax_type}</p>
              </div>
              <span className="font-mono text-base font-bold text-brand-600 dark:text-brand-400">
                {t.rate_percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Discounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {discounts.map((disc) => (
          <div key={disc.id} className="p-5 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold px-2 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 text-xs border border-brand-200 dark:border-brand-800">
                {disc.code}
              </span>
              <StatusBadge status={disc.is_active ? 'active' : 'inactive'} size="sm" />
            </div>

            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">{disc.name}</h3>
              <p className="font-mono text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                {disc.discount_type === 'percentage' ? `${disc.value}% OFF` : `₹${disc.value.toFixed(2)} OFF`}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-slate-500 dark:text-slate-400">
              <p>Min Purchase: ₹{disc.min_purchase_amount.toFixed(2)}</p>
              <p>Usage: <strong className="text-slate-900 dark:text-white font-mono">{disc.current_usage_count}</strong> / {disc.max_usage_count} redeemed</p>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Discount Rule">
        <form onSubmit={handleCreateDiscount} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Coupon Code *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PROMO2026"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Discount Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Diwali Festive Offer"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Type *</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Discount Value *</label>
              <input
                type="number"
                step="0.01"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={discountType === 'percentage' ? '15.00' : '500.00'}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 font-semibold">
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm"
            >
              Create Rule
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
