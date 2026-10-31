import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, ArrowRight, CheckCircle2, Download } from 'lucide-react';
import { fetchQuotations, apiRequest } from '../api/client';
import { Quotation } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Link, useNavigate } from 'react-router-dom';

export const QuotationsPage: React.FC = () => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [convertingId, setConvertingId] = useState<number | null>(null);
  const navigate = useNavigate();

  const loadQuotes = async () => {
    try {
      const data = await fetchQuotations();
      setQuotations(data);
    } catch (e) {
      console.error('Error fetching quotations:', e);
    }
  };

  useEffect(() => {
    loadQuotes();
  }, []);

  const handleConvert = async (quoteId: number) => {
    setConvertingId(quoteId);
    try {
      const res = await apiRequest<any>(`/quotations/${quoteId}/convert-to-subscription`, {
        method: 'POST'
      });
      alert(res.message);
      await loadQuotes();
      navigate(`/subscriptions/${res.subscription_id}`);
    } catch (err: any) {
      alert(`Conversion error: ${err.message}`);
    } finally {
      setConvertingId(null);
    }
  };

  const filtered = quotations.filter(q => {
    const matchesSearch = q.quotation_number.toLowerCase().includes(search.toLowerCase()) ||
      (q.customer_name && q.customer_name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Quotation Management & Proposals
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Build bespoke subscription proposals, apply tax/discount rules, and convert directly into active subscriptions.
          </p>
        </div>
        <Link
          to="/quotations/new"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Quotation Proposal</span>
        </Link>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search quotation #, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Proposals</option>
            <option value="sent">Sent / Pending</option>
            <option value="converted">Converted to Subscription</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Quotation #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Valid Until</th>
                <th className="px-4 py-3">Subtotal</th>
                <th className="px-4 py-3">Tax & Disc.</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-brand-600 dark:text-brand-400">
                    {q.quotation_number}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900 dark:text-white">{q.customer_name}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">{q.customer_email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {new Date(q.valid_until).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    ₹{q.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-[11px]">
                    +₹{q.tax_amount.toLocaleString('en-IN')} / -₹{q.discount_amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white tabular-nums text-sm">
                    ₹{q.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={q.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {q.status !== 'converted' ? (
                      <button
                        onClick={() => handleConvert(q.id)}
                        disabled={convertingId === q.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-colors"
                      >
                        {convertingId === q.id ? 'Converting...' : 'Convert to Sub →'}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Converted
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
