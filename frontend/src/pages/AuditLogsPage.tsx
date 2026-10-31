import React, { useState, useEffect } from 'react';
import { ShieldAlert, Search, Clock, User, Filter } from 'lucide-react';
import { apiRequest } from '../api/client';
import { AuditLogItem } from '../types';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [search, setSearch] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  const loadLogs = async () => {
    try {
      const data = await apiRequest<AuditLogItem[]>('/audit/logs');
      setLogs(data);
    } catch (e) {
      console.error('Error fetching audit logs:', e);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = logs.filter(l => {
    const matchesSearch = l.action.toLowerCase().includes(search.toLowerCase()) ||
      (l.details && l.details.toLowerCase().includes(search.toLowerCase())) ||
      (l.user_email && l.user_email.toLowerCase().includes(search.toLowerCase()));
    const matchesEntity = entityFilter === 'all' || l.entity_type === entityFilter;
    return matchesSearch && matchesEntity;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Security & Audit Trail
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Forensic immutable logs of subscription changes, invoice cancellations, payment reconciliations, and staff actions.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search action, details, user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Entity:</label>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Entities</option>
            <option value="subscription">Subscriptions</option>
            <option value="invoice">Invoices</option>
            <option value="payment">Payments</option>
            <option value="customer">Customers</option>
            <option value="product">Products</option>
            <option value="billing_engine">Billing Engine</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Entity Type</th>
                <th className="px-4 py-3">Action Performed</th>
                <th className="px-4 py-3">Operational Details</th>
                <th className="px-4 py-3 text-right">Actor / Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 text-slate-500 text-[11px]">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 capitalize font-bold text-slate-800 dark:text-slate-200">
                    {log.entity_type}
                  </td>
                  <td className="px-4 py-3 text-brand-600 dark:text-brand-400 font-semibold">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 font-sans text-slate-700 dark:text-slate-300">
                    {log.details || '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500 text-[11px]">
                    {log.user_email || 'System'}
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
