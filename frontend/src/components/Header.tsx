import React, { useState } from 'react';
import { 
  Wifi, WifiOff, RefreshCw, Sun, Moon, Bell, User as UserIcon, 
  LogOut, Shield, Briefcase, UserCheck, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useTheme } from '../context/ThemeContext';
import { UserRole } from '../types';

export const Header: React.FC = () => {
  const { user, role, logout, switchRoleDemo } = useAuth();
  const { isOnline, pendingCount, isSyncing, triggerSync } = useConnectivity();
  const { isDark, toggleTheme } = useTheme();

  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleManualSync = async () => {
    try {
      const res = await triggerSync();
      setSyncFeedback(`Synced ${res.success_count} changes`);
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (e: any) {
      setSyncFeedback(e.message || 'Sync failed');
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white/90 dark:bg-charcoal-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      {/* Left: Role Switcher & Environment Pill */}
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
          Enterprise v1.0
        </span>

        {/* 1-Click Role Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => switchRoleDemo('admin')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              role === 'admin'
                ? 'bg-white dark:bg-charcoal-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Switch to Administrator view"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Admin</span>
          </button>
          <button
            onClick={() => switchRoleDemo('staff')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              role === 'staff'
                ? 'bg-white dark:bg-charcoal-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Switch to Internal Staff view"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Staff</span>
          </button>
          <button
            onClick={() => switchRoleDemo('customer')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              role === 'customer'
                ? 'bg-white dark:bg-charcoal-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Switch to Customer Self-Service Portal"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Customer</span>
          </button>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Network & Offline Status */}
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Online</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline Mode</span>
            </span>
          )}

          {/* Pending Mutations Counter */}
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
              {pendingCount} queued
            </span>
          )}

          {/* Manual Sync Button */}
          <button
            onClick={handleManualSync}
            disabled={!isOnline || isSyncing}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              !isOnline
                ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                : isSyncing
                ? 'bg-brand-50 text-brand-600 border-brand-200 dark:bg-brand-950 dark:border-brand-800'
                : 'bg-white dark:bg-charcoal-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="Synchronize offline changes with backend"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-brand-600' : ''}`} />
            <span className="hidden md:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {syncFeedback && (
            <span className="hidden lg:inline text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {syncFeedback}
            </span>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Info & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-xs">
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="hidden xl:block text-left">
            <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
              {user?.full_name || 'Authenticated User'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
              {role}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 ml-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
