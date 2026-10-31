import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Package, Calendar, FileText, 
  RefreshCw, CreditCard, Tag, BarChart3, Database, 
  Settings, ShieldAlert, UserCog, Clock, Cpu, UserCheck, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useConnectivity } from '../context/ConnectivityContext';

export const Sidebar: React.FC = () => {
  const { role } = useAuth();
  const { pendingCount } = useConnectivity();

  const adminNav = [
    { to: '/', label: 'Admin Dashboard', icon: LayoutDashboard },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/products', label: 'Products & Variants', icon: Package },
    { to: '/plans', label: 'Subscription Plans', icon: Calendar },
    { to: '/quotations', label: 'Quotations', icon: FileText },
    { to: '/subscriptions', label: 'Subscriptions', icon: RefreshCw },
    { to: '/invoices', label: 'Invoices', icon: CreditCard },
    { to: '/payments', label: 'Payments & Reconcile', icon: CreditCard },
    { to: '/gateway-sandbox', label: 'Gateway Sandbox', icon: ShieldCheck, badge: 'SANDBOX' },
    { to: '/discounts', label: 'Discount Rules', icon: Tag },
    { to: '/analytics', label: 'Revenue Analytics', icon: BarChart3 },
    { to: '/billing', label: 'Billing Engine', icon: Cpu },
    { to: '/sync', label: 'Offline Sync Centre', icon: Database, badge: pendingCount > 0 ? pendingCount : undefined },
    { to: '/users', label: 'Staff & Roles', icon: UserCog },
    { to: '/audit', label: 'Audit Logs', icon: ShieldAlert },
    { to: '/settings', label: 'Organization Settings', icon: Settings },
  ];

  const staffNav = [
    { to: '/', label: 'Staff Dashboard', icon: LayoutDashboard },
    { to: '/customers', label: 'Assigned Customers', icon: Users },
    { to: '/quotations', label: 'Quotations', icon: FileText },
    { to: '/subscriptions', label: 'Subscriptions', icon: RefreshCw },
    { to: '/invoices', label: 'Invoices', icon: CreditCard },
    { to: '/payments', label: 'Record Payments', icon: CreditCard },
    { to: '/gateway-sandbox', label: 'Gateway Sandbox', icon: ShieldCheck, badge: 'SANDBOX' },
    { to: '/sync', label: 'Offline Sync Centre', icon: Database, badge: pendingCount > 0 ? pendingCount : undefined },
  ];

  const customerNav = [
    { to: '/portal', label: 'Customer Portal', icon: UserCheck },
    { to: '/portal/subscriptions', label: 'My Subscriptions', icon: RefreshCw },
    { to: '/portal/invoices', label: 'My Invoices & PDFs', icon: CreditCard },
    { to: '/portal/payments', label: 'Payment History', icon: CreditCard },
    { to: '/sync', label: 'Offline Cache', icon: Database },
  ];

  let navItems = adminNav;
  if (role === 'staff') navItems = staffNav;
  if (role === 'customer') navItems = customerNav;

  return (
    <aside className="w-64 flex-shrink-0 bg-white dark:bg-charcoal-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen sticky top-0 transition-colors">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-100 dark:border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
          <RefreshCw className="w-4 h-4 animate-spin-slow" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white leading-none">
            Brightloop
          </h1>
          <p className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-widest mt-0.5">
            Subscription OS
          </p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {role === 'customer' ? 'Self-Service' : `${role} Workspace`}
          </p>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/' || item.to === '/portal'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 shadow-sm border border-brand-200/50 dark:border-brand-800/50'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`
              }
            >
              <div className="flex items-center gap-3 truncate">
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${
                  typeof item.badge === 'string'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                    : 'bg-amber-500 text-white'
                }`}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Offline Status Footer Notice */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Offline Engine</span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Dexie IndexedDB active. All records cached locally.
          </p>
        </div>
      </div>
    </aside>
  );
};
