import React, { useState, useEffect } from 'react';
import { Cpu, Play, CheckCircle2, AlertCircle, Clock, ShieldCheck, FileText } from 'lucide-react';
import { apiRequest } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

export const BillingEnginePage: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runResult, setRunResult] = useState<any | null>(null);

  const loadJobs = async () => {
    try {
      const data = await apiRequest<any[]>('/billing/jobs');
      setJobs(data);
    } catch (e) {
      console.error('Error fetching billing jobs:', e);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleTriggerCycle = async () => {
    setIsRunning(true);
    setRunResult(null);
    try {
      const res = await apiRequest<any>('/billing/run-cycle', { method: 'POST' });
      setRunResult(res);
      await loadJobs();
    } catch (err: any) {
      alert(`Billing cycle execution error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Automated Recurring Billing Engine
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Deterministic billing pipeline. Discovers due subscriptions, prevents duplicate invoicing via idempotency keys, and reconciles balances.
          </p>
        </div>
        <button
          onClick={handleTriggerCycle}
          disabled={isRunning}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition-all disabled:opacity-50"
        >
          <Play className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
          <span>{isRunning ? 'Processing Billing Pipeline...' : 'Run Billing Cycle Now'}</span>
        </button>
      </div>

      {/* Safeguards Architecture Callout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Idempotency Keys</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Guarantees zero duplicate invoices for the same subscription period, even across concurrent retries.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-3">
          <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-600">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Background Scheduler</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Continuous daemon checking subscription expiry, overdue receivables, and renewal dates every 5 minutes.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Audit Execution Logs</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Complete forensic traceability of processed subscriptions, errors, and billed revenue.
            </p>
          </div>
        </div>
      </div>

      {/* Live Run Result Box */}
      {runResult && (
        <div className="p-5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/70 dark:bg-brand-950/30 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Billing Cycle Execution Finished
              </h3>
            </div>
            <span className="font-mono text-xs font-bold text-brand-600">
              Total Billed: ₹{runResult.total_billed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-2 rounded bg-white dark:bg-charcoal-900 border border-brand-200 dark:border-brand-900">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Processed</span>
              <p className="font-mono text-base font-bold text-slate-900 dark:text-white">{runResult.subscriptions_processed}</p>
            </div>
            <div className="p-2 rounded bg-white dark:bg-charcoal-900 border border-brand-200 dark:border-brand-900">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Invoices Generated</span>
              <p className="font-mono text-base font-bold text-emerald-600">{runResult.invoices_generated}</p>
            </div>
            <div className="p-2 rounded bg-white dark:bg-charcoal-900 border border-brand-200 dark:border-brand-900">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Errors</span>
              <p className="font-mono text-base font-bold text-slate-900 dark:text-white">{runResult.errors_count}</p>
            </div>
          </div>

          <div className="mt-2">
            <p className="font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase">Execution Log Trace:</p>
            <pre className="mt-1 p-3 rounded-lg bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
              {runResult.execution_log}
            </pre>
          </div>
        </div>
      )}

      {/* Historical Billing Jobs */}
      <div className="p-5 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          Historical Billing Cycles & Execution Ledger
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Execution Time</th>
                <th className="px-4 py-2.5 text-center">Subscriptions Checked</th>
                <th className="px-4 py-2.5 text-center">Invoices Generated</th>
                <th className="px-4 py-2.5">Total Billed</th>
                <th className="px-4 py-2.5">Errors</th>
                <th className="px-4 py-2.5 text-right">Job Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No previous billing cycles on record. Run the first cycle above!
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                      {new Date(job.run_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold">
                      {job.subscriptions_processed}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-emerald-600">
                      {job.invoices_generated}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                      ₹{job.total_billed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {job.errors_count}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={job.status} size="sm" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
