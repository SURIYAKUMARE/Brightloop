import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, PieChart as PieIcon, DollarSign, Calendar, Layers } from 'lucide-react';
import { apiRequest } from '../api/client';
import { DashboardKPIs } from '../types';
import { KPICard } from '../components/KPICard';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend 
} from 'recharts';

export const AnalyticsPage: React.FC = () => {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [breakdowns, setBreakdowns] = useState<any | null>(null);
  const [dateFilter, setDateFilter] = useState('this_month');

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const [kpiData, trendData, breakdownData] = await Promise.all([
          apiRequest<DashboardKPIs>(`/analytics/kpis?date_filter=${dateFilter}`),
          apiRequest<any[]>('/analytics/trends'),
          apiRequest<any>('/analytics/breakdowns')
        ]);
        setKpis(kpiData);
        setTrends(trendData);
        setBreakdowns(breakdownData);
      } catch (e) {
        console.error('Error fetching analytics:', e);
      }
    }
    loadAnalytics();
  }, [dateFilter]);

  const COLORS = ['#4f46e5', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#ec4899'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Financial & Subscription Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real database metrics for MRR, ARR, churn, collections, and cohort distributions.
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-charcoal-900 px-3 py-1.5 text-slate-800 dark:text-slate-200 font-medium focus:ring-2 focus:ring-brand-500"
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="this_year">This Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Monthly Recurring Revenue"
          value={`₹${(kpis?.mrr || 0).toLocaleString('en-IN')}`}
          subtitle={`Annual Run Rate: ₹${(kpis?.arr || 0).toLocaleString('en-IN')}`}
          icon={TrendingUp}
          highlight={true}
        />
        <KPICard
          title="Average Revenue Per User"
          value={`₹${(kpis?.arpu || 0).toLocaleString('en-IN')}`}
          subtitle="Per active subscription"
          icon={DollarSign}
        />
        <KPICard
          title="Customer Churn Rate"
          value={`${kpis?.churn_rate || 0}%`}
          subtitle="Last 30 days cancellations"
          icon={BarChart3}
        />
        <KPICard
          title="Outstanding Receivables"
          value={`₹${(kpis?.outstanding_revenue || 0).toLocaleString('en-IN')}`}
          subtitle={`Collected: ₹${(kpis?.revenue_collected || 0).toLocaleString('en-IN')}`}
          icon={Layers}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trailing Invoiced vs Collected */}
        <div className="p-6 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
            Revenue Collections Trend
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Actual invoice amounts generated vs cash received.
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `₹${v}`} />
                <Tooltip 
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="invoiced" name="Invoiced" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Plan */}
        <div className="p-6 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
            Revenue Contribution by Plan
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Active subscription volume & revenue contribution.
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdowns?.by_plan || []}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {(breakdowns?.by_plan || []).map((_: any, idx: number) => (
                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Payment Channels & Status Distributions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Payment Channel Distribution
          </h2>
          <div className="space-y-3">
            {(breakdowns?.by_payment_method || []).map((m: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{m.method}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  ₹{m.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Subscription Lifecycle Status Breakdown
          </h2>
          <div className="space-y-2">
            {(breakdowns?.by_status || []).map((st: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">{st.status}</span>
                <span className="font-mono font-bold px-2 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  {st.count} subscriptions
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
