import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, Plus, Filter, Calendar, ArrowRight } from 'lucide-react';
import { fetchSubscriptions } from '../api/client';
import { Subscription } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Link } from 'react-router-dom';

export const SubscriptionsPage: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [intervalFilter, setIntervalFilter] = useState<string>('all');

  const loadSubs = async () => {
    try {
      const data = await fetchSubscriptions();
      setSubscriptions(data);
    } catch (e) {
      console.error('Error fetching subscriptions:', e);
    }
  };

  useEffect(() => {
    loadSubs();
  }, []);

  const filtered = subscriptions.filter(sub => {
    const matchesSearch = sub.subscription_number.toLowerCase().includes(search.toLowerCase()) ||
      (sub.customer_name && sub.customer_name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    const matchesInterval = intervalFilter === 'all' || sub.billing_interval === intervalFilter;
    return matchesSearch && matchesStatus && matchesInterval;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Subscription Lifecycle Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Oversee active recurring contracts, billing schedules, pause states, and automated renewals.
          </p>
        </div>
        <Link
          to="/quotations/new"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Proposal / Subscription</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search subscription #, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="pending_renewal">Pending Renewal</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="closed">Closed</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Interval:</label>
            <select
              value={intervalFilter}
              onChange={(e) => setIntervalFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Intervals</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Subscription #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Interval</th>
                <th className="px-4 py-3">Next Billing Date</th>
                <th className="px-4 py-3">Recurring Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-brand-600 dark:text-brand-400">
                    <Link to={`/subscriptions/${sub.id}`} className="hover:underline">
                      {sub.subscription_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900 dark:text-white">{sub.customer_name || 'Customer'}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">{sub.customer_email}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-700 dark:text-slate-300">
                    {sub.billing_interval}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono">
                    {new Date(sub.next_billing_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white tabular-nums text-sm">
                    ₹{sub.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={sub.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/subscriptions/${sub.id}`}
                      className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                    >
                      Manage Timeline →
                    </Link>
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
