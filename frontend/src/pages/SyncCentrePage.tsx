import React, { useState, useEffect } from 'react';
import { 
  Database, RefreshCw, Wifi, WifiOff, CheckCircle2, AlertTriangle, 
  Clock, HardDrive, ArrowUpCircle, Layers, ShieldCheck 
} from 'lucide-react';
import { useConnectivity } from '../context/ConnectivityContext';
import { offlineDB, getPendingMutations } from '../db';
import { OfflineMutation } from '../types';
import { StatusBadge } from '../components/StatusBadge';

export const SyncCentrePage: React.FC = () => {
  const { isOnline, pendingCount, isSyncing, lastSyncTime, triggerSync } = useConnectivity();
  const [allMutations, setAllMutations] = useState<OfflineMutation[]>([]);
  const [syncResult, setSyncResult] = useState<any | null>(null);
  const [dbStats, setDbStats] = useState<{
    customers: number;
    subscriptions: number;
    invoices: number;
    payments: number;
  }>({ customers: 0, subscriptions: 0, invoices: 0, payments: 0 });

  const loadLocalState = async () => {
    try {
      const muts = await offlineDB.mutations.orderBy('created_at').reverse().toArray();
      setAllMutations(muts);

      const [cCount, sCount, iCount, pCount] = await Promise.all([
        offlineDB.customers.count(),
        offlineDB.subscriptions.count(),
        offlineDB.invoices.count(),
        offlineDB.payments.count()
      ]);
      setDbStats({
        customers: cCount,
        subscriptions: sCount,
        invoices: iCount,
        payments: pCount
      });
    } catch (e) {
      console.error('Error reading offline storage:', e);
    }
  };

  useEffect(() => {
    loadLocalState();
  }, [pendingCount, isSyncing]);

  const handleManualSync = async () => {
    try {
      const res = await triggerSync();
      setSyncResult(res);
      await loadLocalState();
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Offline Status & Synchronization Centre
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitor Progressive Web App cache storage, queued offline operations, and optimistic concurrency version tracking.
          </p>
        </div>
        <button
          onClick={handleManualSync}
          disabled={!isOnline || isSyncing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Synchronizing Operations...' : 'Sync Pending Changes Now'}</span>
        </button>
      </div>

      {/* Connectivity & Health Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 font-bold uppercase text-[10px]">Network Condition</span>
            <div className="flex items-center gap-2 mt-1">
              {isOnline ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Online (Connected)</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-sm font-bold text-amber-600">Offline (Disconnected)</span>
                </>
              )}
            </div>
          </div>
          <div className={`p-2.5 rounded-lg ${isOnline ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600'}`}>
            {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 font-bold uppercase text-[10px]">Pending Queue</span>
            <p className="font-mono text-xl font-bold text-slate-900 dark:text-white mt-1">
              {pendingCount} mutation(s)
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600">
            <ArrowUpCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 font-bold uppercase text-[10px]">Last Successful Sync</span>
            <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white mt-1">
              {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Pending connection'}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-brand-50 dark:bg-brand-950/50 text-brand-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 font-bold uppercase text-[10px]">IndexedDB Cache</span>
            <p className="text-slate-900 dark:text-white font-semibold text-xs mt-1">
              {dbStats.customers} cust, {dbStats.subscriptions} subs, {dbStats.invoices} inv
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Sync Execution Feedback Box */}
      {syncResult && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white">Batch Sync Operation Complete</span>
              <p className="text-slate-600 dark:text-slate-300">
                Applied {syncResult.success_count} mutations successfully. Conflicts detected: {syncResult.conflict_count}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mutation Queue Ledger */}
      <div className="p-5 rounded-xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          IndexedDB Mutation Queue & Conflict Inspector
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Mutation ID</th>
                <th className="px-4 py-2.5">Entity</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Queued At</th>
                <th className="px-4 py-2.5">Version OCC</th>
                <th className="px-4 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {allMutations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No pending or historic offline mutations. All local data synchronized with server.
                  </td>
                </tr>
              ) : (
                allMutations.map((m) => (
                  <tr key={m.id || m.client_mutation_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-brand-600 dark:text-brand-400">
                      {m.client_mutation_id}
                    </td>
                    <td className="px-4 py-3 capitalize font-semibold text-slate-900 dark:text-white">
                      {m.entity_type}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">
                      {m.action}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {new Date(m.created_at).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      v{m.client_version || 1}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={m.status} size="sm" />
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
