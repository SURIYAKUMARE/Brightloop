import React, { useState, useEffect } from 'react';
import { 
  fetchGatewayConfig, simulateGatewayWebhook, fetchGatewayTransactions, fetchInvoices 
} from '../api/client';
import { GatewayConfig, Payment, Invoice, GatewaySimulateResult } from '../types';
import { 
  ShieldCheck, Terminal, Play, RefreshCw, Key, CheckCircle2, 
  XCircle, AlertTriangle, ArrowRight, CreditCard, Smartphone, 
  ExternalLink, Sparkles, Copy, Check 
} from 'lucide-react';

export const GatewaySandboxPage: React.FC = () => {
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [transactions, setTransactions] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulator Form State
  const [provider, setProvider] = useState<'razorpay' | 'stripe'>('razorpay');
  const [eventType, setEventType] = useState('payment.captured');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | ''>('');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [simulateTamperedSig, setSimulateTamperedSig] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationLog, setSimulationLog] = useState<Array<{
    timestamp: string;
    type: 'info' | 'success' | 'error' | 'warning';
    message: string;
    details?: any;
  }>>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Switch default event type when provider changes
    if (provider === 'razorpay') {
      setEventType('payment.captured');
    } else {
      setEventType('payment_intent.succeeded');
    }
  }, [provider]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfg, invList, txList] = await Promise.all([
        fetchGatewayConfig().catch(() => null),
        fetchInvoices().catch(() => []),
        fetchGatewayTransactions().catch(() => [])
      ]);
      setConfig(cfg);
      setInvoices(invList);
      setTransactions(txList);
      if (invList.length > 0 && selectedInvoiceId === '') {
        const unpaid = invList.find((i) => i.balance_due > 0) || invList[0];
        setSelectedInvoiceId(unpaid.id);
        setCustomAmount(unpaid.balance_due.toString());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleInvoiceChange = (id: number) => {
    setSelectedInvoiceId(id);
    const inv = invoices.find((i) => i.id === id);
    if (inv) {
      setCustomAmount(inv.balance_due.toString());
    }
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId) return;

    setIsSimulating(true);
    const now = new Date().toLocaleTimeString();
    
    // Add initial log
    setSimulationLog((prev) => [
      {
        timestamp: now,
        type: 'info',
        message: `Dispatched sandbox webhook event: ${eventType} for Invoice ID #${selectedInvoiceId} (Provider: ${provider.toUpperCase()})`
      },
      ...prev
    ]);

    try {
      const amountVal = customAmount ? parseFloat(customAmount) : undefined;
      const res: GatewaySimulateResult = await simulateGatewayWebhook({
        provider,
        event_type: eventType,
        invoice_id: Number(selectedInvoiceId),
        amount: amountVal,
        simulate_signature_failure: simulateTamperedSig
      });

      if (res.signature_valid && res.reconciled) {
        setSimulationLog((prev) => [
          {
            timestamp: new Date().toLocaleTimeString(),
            type: 'success',
            message: `HMAC Signature Verified: 200 OK. Server Authoritative Reconciliation complete! Payment #${res.payment_number || 'OK'} generated. Invoice status: ${res.invoice_status.toUpperCase()}`,
            details: res
          },
          ...prev
        ]);
      } else if (!res.signature_valid) {
        setSimulationLog((prev) => [
          {
            timestamp: new Date().toLocaleTimeString(),
            type: 'error',
            message: `SECURITY ALERT: HMAC-SHA256 verification failed! Server rejected untrusted payload with 400 Bad Request.`,
            details: res
          },
          ...prev
        ]);
      } else {
        setSimulationLog((prev) => [
          {
            timestamp: new Date().toLocaleTimeString(),
            type: 'warning',
            message: `Webhook received & signature validated. Failure logged as expected: ${res.message}`,
            details: res
          },
          ...prev
        ]);
      }

      // Refresh transactions and invoices
      const [updatedTxs, updatedInvs] = await Promise.all([
        fetchGatewayTransactions(),
        fetchInvoices()
      ]);
      setTransactions(updatedTxs);
      setInvoices(updatedInvs);
    } catch (err: any) {
      setSimulationLog((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          type: 'error',
          message: `Simulation execution failed: ${err.message}`
        },
        ...prev
      ]);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-tight">Payment Gateway Sandbox & Simulator</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>SANDBOX ENGINE ACTIVE</span>
            </span>
          </div>
          <p className="text-slate-400 text-sm max-w-2xl">
            Isolated mock environment simulating end-to-end checkout flows, authentic HMAC-SHA256 webhook signatures, and server-authoritative balance reconciliation for Razorpay and Stripe.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition flex items-center space-x-2 border border-white/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh State</span>
          </button>
        </div>
      </div>

      {/* Provider Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Razorpay Card */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Razorpay Sandbox</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">UPI QR, Netbanking, Cards (India)</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              MOCK ACTIVE
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Key ID</span>
              <div className="flex items-center space-x-1 font-mono text-slate-800 dark:text-slate-200">
                <span>{config?.razorpay_key_id || 'rzp_test_brightloop123'}</span>
                <button 
                  onClick={() => handleCopy(config?.razorpay_key_id || 'rzp_test_brightloop123', 'rzp_key')}
                  className="p-1 hover:text-indigo-600"
                >
                  {copiedKey === 'rzp_key' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Webhook Header</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">X-Razorpay-Signature (HMAC-SHA256)</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Endpoint</span>
              <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">/api/v1/gateway/webhook/razorpay</span>
            </div>
          </div>
        </div>

        {/* Stripe Card */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Stripe Sandbox</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">PaymentIntents, Global Cards, 3DS</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              MOCK ACTIVE
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Publishable Key</span>
              <div className="flex items-center space-x-1 font-mono text-slate-800 dark:text-slate-200">
                <span>{config?.stripe_publishable_key || 'pk_test_brightloop_stripe'}</span>
                <button 
                  onClick={() => handleCopy(config?.stripe_publishable_key || 'pk_test_brightloop_stripe', 'stripe_key')}
                  className="p-1 hover:text-indigo-600"
                >
                  {copiedKey === 'stripe_key' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Webhook Header</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">Stripe-Signature (v1 Timestamped)</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Endpoint</span>
              <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">/api/v1/gateway/webhook/stripe</span>
            </div>
          </div>
        </div>

      </div>

      {/* Simulator & Live Console Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Simulation Dispatch Form (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">Developer Webhook Simulator</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Construct & dispatch genuine gateway events</p>
            </div>
          </div>

          <form onSubmit={handleRunSimulation} className="space-y-4">
            
            {/* Provider Switch */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Gateway Provider
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setProvider('razorpay')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                    provider === 'razorpay'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Razorpay</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('stripe')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                    provider === 'stripe'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Stripe</span>
                </button>
              </div>
            </div>

            {/* Event Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Webhook Event Type
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              >
                {provider === 'razorpay' ? (
                  <>
                    <option value="payment.captured">payment.captured (Success)</option>
                    <option value="payment.failed">payment.failed (Declined)</option>
                    <option value="order.paid">order.paid (Order Paid)</option>
                  </>
                ) : (
                  <>
                    <option value="payment_intent.succeeded">payment_intent.succeeded (Success)</option>
                    <option value="payment_intent.payment_failed">payment_intent.payment_failed (Declined)</option>
                    <option value="charge.succeeded">charge.succeeded (Charge Success)</option>
                  </>
                )}
              </select>
            </div>

            {/* Target Invoice */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Invoice
              </label>
              <select
                value={selectedInvoiceId}
                onChange={(e) => handleInvoiceChange(Number(e.target.value))}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} ({inv.customer_name}) • Due: ₹{Number(inv.balance_due).toFixed(2)} [{inv.status.toUpperCase()}]
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Override */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Simulated Amount (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Amount to credit"
              />
            </div>

            {/* Tampered Signature Toggle */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start space-x-3">
              <input
                type="checkbox"
                id="tamperedSig"
                checked={simulateTamperedSig}
                onChange={(e) => setSimulateTamperedSig(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-slate-300 dark:border-slate-700"
              />
              <label htmlFor="tamperedSig" className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-semibold block text-slate-900 dark:text-white">Corrupt Webhook Signature</span>
                Simulates an untrusted payload or MITM tampered payload to verify server rejection (400 Bad Request).
              </label>
            </div>

            {/* Trigger Button */}
            <button
              type="submit"
              disabled={isSimulating || !selectedInvoiceId}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm flex items-center justify-center space-x-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isSimulating ? 'Processing Webhook Event...' : 'Fire Webhook Simulation'}</span>
            </button>

          </form>
        </div>

        {/* Right: Diagnostic Log Terminal (7 cols) */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl bg-slate-950 border border-slate-800 shadow-xl overflow-hidden font-mono text-xs">
          
          {/* Terminal Header */}
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-slate-400">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
              <span className="ml-2 font-semibold text-[11px] text-slate-300">Sandbox Ingestion Console</span>
            </div>
            <button
              onClick={() => setSimulationLog([])}
              className="text-[10px] text-slate-400 hover:text-white transition"
            >
              Clear Log
            </button>
          </div>

          {/* Terminal Body */}
          <div className="p-4 flex-1 overflow-y-auto space-y-3 min-h-[360px] max-h-[480px]">
            {simulationLog.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16 space-y-2">
                <Terminal className="w-8 h-8 opacity-40" />
                <p>Awaiting simulation events. Select options and click "Fire Webhook Simulation".</p>
                <p className="text-[10px] text-slate-600">Events are logged with HMAC authenticity verification & balance reconciliation steps.</p>
              </div>
            ) : (
              simulationLog.map((log, idx) => (
                <div key={idx} className="space-y-1 animate-in fade-in duration-150">
                  <div className="flex items-start space-x-2">
                    <span className="text-slate-500 text-[10px] whitespace-nowrap">[{log.timestamp}]</span>
                    {log.type === 'success' && <span className="text-emerald-400 font-bold">[SUCCESS]</span>}
                    {log.type === 'error' && <span className="text-red-400 font-bold">[REJECTED]</span>}
                    {log.type === 'warning' && <span className="text-amber-400 font-bold">[RECORDED]</span>}
                    {log.type === 'info' && <span className="text-sky-400 font-bold">[DISPATCH]</span>}
                    <span className={
                      log.type === 'success' ? 'text-emerald-300' :
                      log.type === 'error' ? 'text-red-300' :
                      log.type === 'warning' ? 'text-amber-300' : 'text-slate-300'
                    }>
                      {log.message}
                    </span>
                  </div>
                  {log.details && (
                    <pre className="p-2 rounded bg-slate-900/80 border border-slate-800 text-[10px] text-slate-400 overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Terminal Footer */}
          <div className="p-2.5 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 px-4">
            <span>Status: Ready</span>
            <span>Tunnel: 127.0.0.1:8000</span>
          </div>

        </div>

      </div>

      {/* Gateway Transactions Ledger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Gateway Transactions Ledger</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">All payments processed through Razorpay & Stripe integrations</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {transactions.length} Total Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-semibold">Payment #</th>
                <th className="py-3 px-4 font-semibold">Invoice #</th>
                <th className="py-3 px-4 font-semibold">Customer</th>
                <th className="py-3 px-4 font-semibold">Gateway</th>
                <th className="py-3 px-4 font-semibold">Order ID</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Amount</th>
                <th className="py-3 px-4 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No gateway transactions recorded yet. Use the simulator above or pay an invoice via the online modal.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                      {tx.payment_number}
                    </td>
                    <td className="py-3 px-4 font-mono text-indigo-600 dark:text-indigo-400">
                      {tx.invoice_number || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {tx.customer_name || 'Customer'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        tx.gateway_provider === 'razorpay'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                      }`}>
                        {tx.gateway_provider || 'Manual'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {tx.gateway_order_id || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        tx.status === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : tx.status === 'failed'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {tx.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold font-mono text-slate-900 dark:text-white">
                      ₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(tx.payment_date).toLocaleDateString()}
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
