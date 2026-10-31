import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConnectivityProvider } from './context/ConnectivityContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { ProductsPage } from './pages/ProductsPage';
import { PlansPage } from './pages/PlansPage';
import { QuotationsPage } from './pages/QuotationsPage';
import { QuotationBuilder } from './pages/QuotationBuilder';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { SubscriptionDetailPage } from './pages/SubscriptionDetailPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { DiscountsPage } from './pages/DiscountsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { BillingEnginePage } from './pages/BillingEnginePage';
import { SyncCentrePage } from './pages/SyncCentrePage';
import { UsersPage } from './pages/UsersPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { CustomerPortalPage } from './pages/CustomerPortalPage';
import { GatewaySandboxPage } from './pages/GatewaySandboxPage';
import { LoginPage } from './pages/LoginPage';

const ProtectedRoutes: React.FC = () => {
  const { isAuthenticated, isLoading, role } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-charcoal-950 text-xs font-semibold text-slate-500">
        Loading Brightloop platform...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* If customer role, redirect root to portal */}
        <Route path="/" element={role === 'customer' ? <CustomerPortalPage /> : <DashboardPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/quotations" element={<QuotationsPage />} />
        <Route path="/quotations/new" element={<QuotationBuilder />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/subscriptions/:id" element={<SubscriptionDetailPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/discounts" element={<DiscountsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/billing" element={<BillingEnginePage />} />
        <Route path="/sync" element={<SyncCentrePage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/audit" element={<AuditLogsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/gateway-sandbox" element={<GatewaySandboxPage />} />

        {/* Customer Self-Service Portal */}
        <Route path="/portal" element={<CustomerPortalPage />} />
        <Route path="/portal/subscriptions" element={<CustomerPortalPage />} />
        <Route path="/portal/invoices" element={<CustomerPortalPage />} />
        <Route path="/portal/payments" element={<CustomerPortalPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ConnectivityProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </BrowserRouter>
        </ConnectivityProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
