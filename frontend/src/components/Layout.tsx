import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useConnectivity } from '../context/ConnectivityContext';
import { WifiOff, RefreshCw } from 'lucide-react';

export const Layout: React.FC = () => {
  const { isOnline, pendingCount, isSyncing, triggerSync } = useConnectivity();

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-charcoal-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        {/* Global Offline / Pending Sync Banner */}
        {(!isOnline || pendingCount > 0) && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              {!isOnline ? <WifiOff className="w-4 h-4" /> : <RefreshCw className="w-4 h-4 animate-spin-slow" />}
              <span>
                {!isOnline
                  ? `Offline Mode Active — You can continue viewing records, generating quotes, and recording payments.`
                  : `${pendingCount} offline modification(s) queued for server synchronization.`}
              </span>
            </div>
            {isOnline && pendingCount > 0 && (
              <button
                onClick={() => triggerSync()}
                disabled={isSyncing}
                className="bg-slate-950 text-white px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-900 transition-colors"
              >
                {isSyncing ? 'Synchronizing...' : 'Sync Now'}
              </button>
            )}
          </div>
        )}

        {/* Main Routed Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
