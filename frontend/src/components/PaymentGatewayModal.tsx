import React, { useState, useEffect } from 'react';
import { Invoice, GatewayOrderResponse } from '../types';
import { createGatewayOrder, verifyGatewayPayment } from '../api/client';
import { X, ShieldCheck, CreditCard, QrCode, Smartphone, Building2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface PaymentGatewayModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [provider, setProvider] = useState<'razorpay' | 'stripe'>('razorpay');
  const [razorpayMethod, setRazorpayMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('customer@okaxis');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('999');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [order, setOrder] = useState<GatewayOrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOpen && invoice) {
      setError(null);
      setSuccessResult(null);
      setIsProcessing(false);
      // Initiate sandbox order
      initiateOrder(provider);
    }
  }, [isOpen, invoice, provider]);

  const initiateOrder = async (targetProvider: 'razorpay' | 'stripe') => {
    if (!invoice || !isOnline) return;
    try {
      const ord = await createGatewayOrder(invoice.id, targetProvider, invoice.balance_due);
      setOrder(ord);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize payment gateway order.');
    }
  };

  if (!isOpen || !invoice) return null;

  const handleAuthorizePayment = async () => {
    if (!isOnline) {
      setError('Cannot process payment while offline. Financial transactions require network verification.');
      return;
    }
    if (!order) {
      setError('Order not initialized. Please try again.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Generate client-side test token / payment ID
      const mockPaymentId = provider === 'razorpay' 
        ? `pay_rzp_mock_${Math.random().toString(36).substring(2, 12)}`
        : `ch_mock_${Math.random().toString(36).substring(2, 14)}`;

      // Compute client test signature for sandbox verification
      const verifyRes = await verifyGatewayPayment({
        provider,
        invoice_id: invoice.id,
        order_id: order.order_id,
        payment_id: mockPaymentId,
        // In sandbox mock mode, valid token is accepted and reconciled server-side
        signature: 'sandbox_verified_signature'
      });

      setSuccessResult(verifyRes.message || 'Payment successfully authorized and reconciled.');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Payment authorization failed.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-slate-900 dark:text-white">Pay Online via Gateway</h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                  SANDBOX
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Invoice {invoice.invoice_number} • ₹{Number(invoice.balance_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Offline Warning Guard */}
        {!isOnline && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong>Offline Protection:</strong> Live payment gateway checkouts require active internet. Offline payment queues are disabled to prevent untrusted financial reconciliation.
            </span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {successResult ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">Payment Authorized!</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xs mx-auto">
                {successResult}
              </p>
              <div className="text-xs text-slate-400">
                Updating ledger and invoice balance...
              </div>
            </div>
          ) : (
            <>
              {/* Provider Selection Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setProvider('razorpay');
                    initiateOrder('razorpay');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition ${
                    provider === 'razorpay'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Razorpay (UPI / Netbanking)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProvider('stripe');
                    initiateOrder('stripe');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition ${
                    provider === 'stripe'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Stripe (Cards)</span>
                </button>
              </div>

              {/* Order Summary Pill */}
              {order && (
                <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Order ID: </span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{order.order_id}</span>
                  </div>
                  <div className="font-bold text-indigo-600 dark:text-indigo-400">
                    ₹{Number(order.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}

              {/* Razorpay Sub-methods */}
              {provider === 'razorpay' && (
                <div className="space-y-4">
                  <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setRazorpayMethod('upi')}
                      className={`pb-2 px-3 font-medium flex items-center space-x-1.5 border-b-2 transition ${
                        razorpayMethod === 'upi'
                          ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                          : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>UPI QR & VPA</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRazorpayMethod('card')}
                      className={`pb-2 px-3 font-medium flex items-center space-x-1.5 border-b-2 transition ${
                        razorpayMethod === 'card'
                          ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                          : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Debit/Credit Card</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRazorpayMethod('netbanking')}
                      className={`pb-2 px-3 font-medium flex items-center space-x-1.5 border-b-2 transition ${
                        razorpayMethod === 'netbanking'
                          ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                          : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Netbanking</span>
                    </button>
                  </div>

                  {razorpayMethod === 'upi' && (
                    <div className="space-y-3">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center space-x-4">
                        <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                          {/* QR Code Graphic Mock */}
                          <div className="w-20 h-20 bg-slate-900 flex items-center justify-center text-white text-[10px] font-mono p-1 text-center">
                            [UPI-QR MOCK]
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">Scan with any UPI App</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Google Pay, PhonePe, Paytm, BHIM</p>
                          <span className="inline-block mt-2 px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] font-medium">
                            Auto-approving Sandbox
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Or Enter UPI VPA
                        </label>
                        <input
                          type="text"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="e.g. mobile@upi or username@bank"
                        />
                      </div>
                    </div>
                  )}

                  {razorpayMethod === 'card' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Card Number</label>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Valid Thru</label>
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">CVV</label>
                          <input
                            type="password"
                            maxLength={3}
                            value={cardCvc}
                            onChange={(e) => setCardCvc(e.target.value)}
                            className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {razorpayMethod === 'netbanking' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Select Bank</label>
                      <select
                        value={selectedBank}
                        onChange={(e) => setSelectedBank(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="HDFC Bank">HDFC Bank</option>
                        <option value="ICICI Bank">ICICI Bank</option>
                        <option value="State Bank of India">State Bank of India</option>
                        <option value="Axis Bank">Axis Bank</option>
                        <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Stripe Card Method */}
              {provider === 'stripe' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Card Number (Stripe Test)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 pl-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                      <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Expiration</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">CVC / CVC2</label>
                      <input
                        type="password"
                        maxLength={4}
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-[11px] text-slate-500 dark:text-slate-400">
                    💡 Uses standard Stripe test card (4242). Sandbox automatically tests 3D-Secure success verification.
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={handleAuthorizePayment}
                disabled={isProcessing || !isOnline}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm flex items-center justify-center space-x-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authorizing with {provider === 'razorpay' ? 'Razorpay' : 'Stripe'}...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      Authorize & Pay ₹{Number(invoice.balance_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>256-Bit Encrypted Sandbox Tunnel</span>
          </div>
          <span>Brightloop SafeCheckout™</span>
        </div>

      </div>
    </div>
  );
};
