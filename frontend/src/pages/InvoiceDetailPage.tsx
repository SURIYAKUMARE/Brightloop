import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Printer, CreditCard, XCircle, CheckCircle, ShieldCheck } from 'lucide-react';
import { apiRequest, recordPayment } from '../api/client';
import { Invoice } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { PaymentGatewayModal } from '../components/PaymentGatewayModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Record Payment Modal
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isGatewayOpen, setIsGatewayOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'upi' | 'card' | 'cash'>('bank_transfer');
  const [payAmount, setPayAmount] = useState<string>('');
  const [txnRef, setTxnRef] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [isPaying, setIsPaying] = useState(false);

  const loadInvoice = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<Invoice>(`/invoices/${id}`);
      setInvoice(data);
      setPayAmount(data.balance_due.toString());
    } catch (e) {
      console.error('Error fetching invoice:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const handleDownloadPDF = () => {
    if (!invoice) return;
    const doc = new jsPDF();

    // Brand Header
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // Brand Indigo
    doc.text('BRIGHTLOOP SOFTWARE', 14, 22);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Brightloop Software Solutions Pvt Ltd', 14, 28);
    doc.text('Infopark Kochi, Phase II, Kakkanad, Kerala - 682042', 14, 33);
    doc.text('GSTIN: 32AABCB1234F1Z0 | billing@brightloop.com', 14, 38);

    // Invoice Title & Meta
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('TAX INVOICE', 140, 22);

    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(`Invoice #: ${invoice.invoice_number}`, 140, 28);
    doc.text(`Invoice Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, 140, 33);
    doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 140, 38);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 140, 43);

    // Line separator
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 48, 196, 48);

    // Bill To
    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229);
    doc.text('BILLED TO:', 14, 55);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(invoice.customer_name || 'Customer', 14, 62);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(invoice.company_name || 'Company', 14, 67);
    doc.text(invoice.customer_email || '', 14, 72);
    doc.text(`Tax ID: ${invoice.tax_id || 'N/A'}`, 14, 77);
    doc.text(`Address: ${invoice.billing_address || 'Kochi, Kerala'}`, 14, 82);

    // Items Table
    const tableData = invoice.items.map(item => [
      item.description,
      item.quantity.toString(),
      `INR ${item.unit_price.toFixed(2)}`,
      `${item.tax_rate}%`,
      `INR ${item.total_price.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 90,
      head: [['Line Item Description', 'Qty', 'Unit Price', 'Tax Rate', 'Line Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, font: 'helvetica' },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 130;

    // Totals Box
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Subtotal:', 130, finalY + 10);
    doc.text(`INR ${invoice.subtotal.toFixed(2)}`, 170, finalY + 10);

    doc.text('Tax (GST/VAT):', 130, finalY + 16);
    doc.text(`INR ${invoice.tax_amount.toFixed(2)}`, 170, finalY + 16);

    doc.text('Discount:', 130, finalY + 22);
    doc.text(`- INR ${invoice.discount_amount.toFixed(2)}`, 170, finalY + 22);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Total Amount:', 130, finalY + 30);
    doc.text(`INR ${invoice.total_amount.toFixed(2)}`, 170, finalY + 30);

    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129);
    doc.text('Amount Paid:', 130, finalY + 37);
    doc.text(`INR ${invoice.amount_paid.toFixed(2)}`, 170, finalY + 37);

    doc.setFontSize(11);
    doc.setTextColor(239, 68, 68);
    doc.text('Balance Due:', 130, finalY + 45);
    doc.text(`INR ${invoice.balance_due.toFixed(2)}`, 170, finalY + 45);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Thank you for choosing Brightloop Software. For billing inquiries, contact billing@brightloop.com.', 14, 280);

    doc.save(`${invoice.invoice_number}.pdf`);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    setIsPaying(true);
    try {
      await recordPayment({
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        payment_method: paymentMethod,
        amount: parseFloat(payAmount),
        payment_date: new Date().toISOString(),
        transaction_reference: txnRef || `TXN-${Date.now().toString().slice(-6)}`,
        notes: payNotes || `Payment recorded against ${invoice.invoice_number}`
      });
      setIsPayOpen(false);
      await loadInvoice();
    } catch (err: any) {
      alert(`Payment error: ${err.message}`);
    } finally {
      setIsPaying(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!invoice) return;
    if (!confirm(`Are you sure you want to cancel invoice ${invoice.invoice_number}? This will revert the customer balance.`)) return;

    try {
      await apiRequest(`/invoices/${invoice.id}/cancel`, { method: 'POST' });
      await loadInvoice();
    } catch (err: any) {
      alert(`Cancellation error: ${err.message}`);
    }
  };

  if (isLoading || !invoice) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading invoice document...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/invoices')}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                {invoice.invoice_number}
              </h1>
              <StatusBadge status={invoice.status} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generated on {new Date(invoice.invoice_date).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-charcoal-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-sm transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>

          {invoice.balance_due > 0 && invoice.status !== 'cancelled' && (
            <>
              <button
                onClick={() => setIsGatewayOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Pay Online (Sandbox)</span>
              </button>
              <button
                onClick={() => setIsPayOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Record Payment</span>
              </button>
            </>
          )}

          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <button
              onClick={handleCancelInvoice}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* High-Fidelity Invoice Canvas */}
      <div className="p-8 sm:p-10 rounded-2xl bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-8 text-xs print:border-none print:shadow-none">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-100 dark:border-slate-800 pb-8">
          <div>
            <h2 className="text-xl font-extrabold text-brand-600 tracking-tight">
              BRIGHTLOOP SOFTWARE
            </h2>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
              Brightloop Software Solutions Pvt Ltd
            </p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              Infopark Kochi, Phase II, Kakkanad, Kerala - 682042
            </p>
            <p className="text-slate-500 dark:text-slate-400 font-mono">
              GSTIN: 32AABCB1234F1Z0 | billing@brightloop.com
            </p>
          </div>

          <div className="sm:text-right space-y-1">
            <h3 className="text-xl font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
              TAX INVOICE
            </h3>
            <p className="font-mono font-bold text-brand-600 dark:text-brand-400 text-sm">
              {invoice.invoice_number}
            </p>
            <p className="text-slate-500">
              Invoice Date: <strong className="text-slate-900 dark:text-white">{new Date(invoice.invoice_date).toLocaleDateString()}</strong>
            </p>
            <p className="text-slate-500">
              Payment Due Date: <strong className="text-rose-600 dark:text-rose-400">{new Date(invoice.due_date).toLocaleDateString()}</strong>
            </p>
            {invoice.subscription_number && (
              <p className="text-slate-500">
                Subscription Ref: <strong className="font-mono text-slate-800 dark:text-slate-200">{invoice.subscription_number}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Bill To & Billing Period */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Billed To</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{invoice.customer_name}</p>
            <p className="font-semibold text-slate-700 dark:text-slate-300">{invoice.company_name || 'Individual Account'}</p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">{invoice.customer_email}</p>
            <p className="text-slate-500 dark:text-slate-400 font-mono mt-0.5">Tax ID / GSTIN: {invoice.tax_id || 'N/A'}</p>
            <p className="text-slate-500 dark:text-slate-400 mt-1">{invoice.billing_address || 'Kochi, Kerala, India'}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
            <div>
              <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Billing Coverage Period</p>
              <p className="font-mono font-semibold text-slate-900 dark:text-white mt-1">
                {new Date(invoice.period_start).toLocaleDateString()} – {new Date(invoice.period_end).toLocaleDateString()}
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Automated recurring engine statement.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-500">Payment Status: </span>
              <StatusBadge status={invoice.status} size="sm" />
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Item Description</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Tax Rate</th>
                <th className="px-4 py-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                    {item.description}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-bold">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    ₹{item.unit_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-500">
                    {item.tax_rate}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    ₹{item.total_price.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Breakdown */}
        <div className="flex flex-col items-end">
          <div className="w-72 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold tabular-nums">₹{invoice.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Tax (GST/VAT):</span>
              <span className="font-mono font-semibold tabular-nums">+₹{invoice.tax_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Discounts:</span>
              <span className="font-mono font-semibold text-emerald-600 tabular-nums">-₹{invoice.discount_amount.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-sm text-slate-900 dark:text-white">
              <span>Grand Total:</span>
              <span className="font-mono text-brand-600 dark:text-brand-400 tabular-nums">₹{invoice.total_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
              <span>Amount Paid:</span>
              <span className="font-mono tabular-nums">₹{invoice.amount_paid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-rose-600 dark:text-rose-400 text-sm pt-1 border-t border-slate-200 dark:border-slate-700">
              <span>Outstanding Balance Due:</span>
              <span className="font-mono tabular-nums">₹{invoice.balance_due.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          <p className="font-semibold text-slate-600 dark:text-slate-300">Payment Instructions:</p>
          <p className="mt-0.5">Bank: HDFC Bank Ltd | Account: 50200099881122 | IFSC: HDFC0001234 | UPI: brightloop@hdfcbank</p>
        </div>
      </div>

      {/* Record Payment Modal */}
      <Modal isOpen={isPayOpen} onClose={() => setIsPayOpen(false)} title={`Record Payment against ${invoice.invoice_number}`}>
        <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Payment Method *</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="bank_transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
              <option value="upi">UPI (Google Pay, PhonePe, BHIM)</option>
              <option value="card">Credit / Debit Card</option>
              <option value="cash">Cash / Cheque</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Payment Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                max={invoice.balance_due}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400">Outstanding: ₹{invoice.balance_due.toFixed(2)}</span>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Transaction Ref #</label>
              <input
                type="text"
                value={txnRef}
                onChange={(e) => setTxnRef(e.target.value)}
                placeholder="UTR / Bank Ref ID"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Payment Notes</label>
            <input
              type="text"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="e.g. Cleared via corporate net banking"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={() => setIsPayOpen(false)} className="px-4 py-2 rounded-lg text-slate-600 font-semibold">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPaying}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
            >
              {isPaying ? 'Recording...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </Modal>

      <PaymentGatewayModal
        invoice={invoice}
        isOpen={isGatewayOpen}
        onClose={() => setIsGatewayOpen(false)}
        onSuccess={loadInvoice}
      />
    </div>
  );
};
