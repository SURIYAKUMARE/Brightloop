import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Check, Sparkles, Calculator } from 'lucide-react';
import { fetchCustomers, fetchProducts, fetchPlans, createQuotation } from '../api/client';
import { Customer, Product, SubscriptionPlan, QuotationItem } from '../types';

export const QuotationBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  // Form states
  const [customerId, setCustomerId] = useState<number>(0);
  const [validDays, setValidDays] = useState<number>(30);
  const [notes, setNotes] = useState<string>('Standard enterprise software terms apply. Priority onboarding included.');
  const [terms, setTerms] = useState<string>('Payment within 15 days of invoice date.');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Line items
  interface BuilderItem {
    productId: number;
    variantId: number;
    planId?: number;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    discountAmount: number;
  }

  const [items, setItems] = useState<BuilderItem[]>([]);

  useEffect(() => {
    async function loadMetadata() {
      const [custs, prods, plns] = await Promise.all([
        fetchCustomers(),
        fetchProducts(),
        fetchPlans()
      ]);
      setCustomers(custs);
      setProducts(prods);
      setPlans(plns);

      if (custs.length > 0) setCustomerId(custs[0].id);

      // Default line item with product 1 and variant
      if (prods.length > 0) {
        const p = prods[0];
        const v = p.variants.length > 0 ? p.variants[0] : null;
        const initialPrice = p.sales_price + (v ? v.additional_price : 0);
        setItems([{
          productId: p.id,
          variantId: v ? v.id : 0,
          description: `${p.name} ${v ? `(${v.name})` : ''}`,
          quantity: 1,
          unitPrice: initialPrice,
          taxRate: 18.00,
          discountAmount: 0
        }]);
      }
    }
    loadMetadata();
  }, []);

  const handleProductChange = (index: number, prodId: number) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;
    const variant = prod.variants.length > 0 ? prod.variants[0] : null;
    const newPrice = prod.sales_price + (variant ? variant.additional_price : 0);

    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      productId: prod.id,
      variantId: variant ? variant.id : 0,
      description: `${prod.name} ${variant ? `(${variant.name})` : ''}`,
      unitPrice: newPrice
    };
    setItems(newItems);
  };

  const handleVariantChange = (index: number, variantId: number) => {
    const item = items[index];
    const prod = products.find(p => p.id === item.productId);
    if (!prod) return;
    const variant = prod.variants.find(v => v.id === variantId);
    const newPrice = prod.sales_price + (variant ? variant.additional_price : 0);

    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      variantId,
      description: `${prod.name} ${variant ? `(${variant.name})` : ''}`,
      unitPrice: newPrice
    };
    setItems(newItems);
  };

  const handleAddItem = () => {
    if (products.length === 0) return;
    const p = products[0];
    const v = p.variants.length > 0 ? p.variants[0] : null;
    setItems([
      ...items,
      {
        productId: p.id,
        variantId: v ? v.id : 0,
        description: `${p.name} ${v ? `(${v.name})` : ''}`,
        quantity: 1,
        unitPrice: p.sales_price + (v ? v.additional_price : 0),
        taxRate: 18.00,
        discountAmount: 0
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Live calculations
  let subtotal = 0;
  let totalTax = 0;
  let totalDiscount = 0;

  items.forEach(item => {
    const lineSub = item.unitPrice * item.quantity;
    const lineTaxable = Math.max(0, lineSub - item.discountAmount);
    const lineTax = (lineTaxable * item.taxRate) / 100;

    subtotal += lineSub;
    totalDiscount += item.discountAmount;
    totalTax += lineTax;
  });

  const grandTotal = subtotal - totalDiscount + totalTax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + validDays);

      const quotationPayload = {
        customer_id: customerId,
        valid_until: validUntil.toISOString(),
        items: items.map(item => ({
          product_id: item.productId,
          variant_id: item.variantId || undefined,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          tax_rate: item.taxRate,
          discount_amount: item.discountAmount,
          total_price: (item.unitPrice * item.quantity) - item.discountAmount + (((item.unitPrice * item.quantity) - item.discountAmount) * item.taxRate / 100)
        })),
        notes,
        terms
      };

      await createQuotation(quotationPayload);
      navigate('/quotations');
    } catch (err: any) {
      alert(`Error creating quotation: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/quotations')}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Quotation & Proposal Builder
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Combine products, variants, recurring intervals, taxes, and customer discounts.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Header Settings */}
        <div className="p-5 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Customer *</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.company_name || 'Individual'} ({c.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Proposal Validity (Days)</label>
            <input
              type="number"
              min={1}
              max={180}
              value={validDays}
              onChange={(e) => setValidDays(parseInt(e.target.value) || 30)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
            />
          </div>
        </div>

        {/* Dynamic Line Items Table */}
        <div className="p-5 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-brand-600" />
              Proposed Product & Variant Lines
            </h2>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 dark:bg-brand-950 dark:hover:bg-brand-900 text-brand-700 dark:text-brand-300 font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Add Line
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => {
              const currentProd = products.find(p => p.id === item.productId);
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                >
                  {/* Product Selector */}
                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-slate-500 text-[10px] uppercase mb-1">Product</label>
                    <select
                      value={item.productId}
                      onChange={(e) => handleProductChange(idx, parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-charcoal-900 text-slate-900 dark:text-white"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Variant Selector */}
                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-slate-500 text-[10px] uppercase mb-1">Variant (+Price)</label>
                    <select
                      value={item.variantId}
                      onChange={(e) => handleVariantChange(idx, parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-charcoal-900 text-slate-900 dark:text-white"
                    >
                      {currentProd?.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.additional_price > 0 ? `+₹${v.additional_price}` : 'Incl.'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="sm:col-span-1">
                    <label className="block font-semibold text-slate-500 text-[10px] uppercase mb-1">Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx].quantity = parseInt(e.target.value) || 1;
                        setItems(newItems);
                      }}
                      className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-charcoal-900 text-slate-900 dark:text-white font-mono text-center"
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-500 text-[10px] uppercase mb-1">Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx].unitPrice = parseFloat(e.target.value) || 0;
                        setItems(newItems);
                      }}
                      className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-charcoal-900 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>

                  {/* Tax Rate % */}
                  <div className="sm:col-span-1">
                    <label className="block font-semibold text-slate-500 text-[10px] uppercase mb-1">Tax</label>
                    <select
                      value={item.taxRate}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx].taxRate = parseFloat(e.target.value);
                        setItems(newItems);
                      }}
                      className="w-full px-1.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-charcoal-900 text-slate-900 dark:text-white font-mono text-xs"
                    >
                      <option value={18}>18%</option>
                      <option value={5}>5%</option>
                      <option value={0}>0%</option>
                    </select>
                  </div>

                  {/* Line Total */}
                  <div className="sm:col-span-1 text-right">
                    <label className="block font-semibold text-slate-500 text-[10px] uppercase mb-1">Line Total</label>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-xs tabular-nums">
                      ₹{((item.unitPrice * item.quantity) - item.discountAmount + (((item.unitPrice * item.quantity) - item.discountAmount) * item.taxRate / 100)).toFixed(2)}
                    </span>
                  </div>

                  {/* Delete Button */}
                  <div className="sm:col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length <= 1}
                      className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals Summary Panel */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col items-end text-xs">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                  ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Applied Discounts:</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  -₹{totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Taxes (GST/VAT):</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                  +₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-base font-bold text-slate-900 dark:text-white">
                <span>Total Amount:</span>
                <span className="font-mono text-brand-600 dark:text-brand-400 tabular-nums">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        <div className="p-5 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes to Customer</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Contract Terms</label>
            <textarea
              rows={2}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/quotations')}
            className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 font-semibold text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-md shadow-brand-500/20 transition-all"
          >
            {isSubmitting ? 'Generating Proposal...' : 'Create & Send Proposal'}
          </button>
        </div>
      </form>
    </div>
  );
};
