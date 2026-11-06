import React, { useState } from 'react';

export interface SubscriptionTransactionItem {
  id: string;
  phoneNumber: string;
  amount: string;
  planCode: string;
  mpesaReceiptNumber?: string | null;
  transactionStatus: 'INITIATED' | 'SUCCESS' | 'FAILED';
  subscriptionPeriodStart?: string | null;
  subscriptionPeriodEnd?: string | null;
  createdAt: string;
}

interface SubscriptionBillingViewProps {
  tenantName?: string;
  subscriptionState?: 'ACTIVE' | 'TRIAL' | 'GRACE_PERIOD' | 'SUSPENDED';
  activePlan?: 'PROJECT_TIER' | 'PORTFOLIO_TIER';
  monthlyFeeKes?: string;
  daysRemaining?: number;
  lastPaymentRef?: string | null;
  transactions?: SubscriptionTransactionItem[];
  onInitiateStkPush?: (data: { phoneNumber: string; planCode: string; amount: string }) => Promise<any>;
}

export const SubscriptionBillingView: React.FC<SubscriptionBillingViewProps> = ({
  tenantName = 'Apex Builders Kenya Ltd',
  subscriptionState: initialSubState = 'ACTIVE',
  activePlan: initialActivePlan = 'PORTFOLIO_TIER',
  monthlyFeeKes: initialFee = '25000.00',
  daysRemaining: initialDays = 26,
  lastPaymentRef: initialReceipt = 'NL88491023',
  transactions: initialTransactions,
  onInitiateStkPush,
}) => {
  const [subscriptionState, setSubscriptionState] = useState(initialSubState);
  const [activePlan, setActivePlan] = useState(initialActivePlan);
  const [monthlyFee, setMonthlyFee] = useState(initialFee);
  const [daysRemaining, setDaysRemaining] = useState(initialDays);
  const [lastPaymentRef, setLastPaymentRef] = useState(initialReceipt);

  const [transactions, setTransactions] = useState<SubscriptionTransactionItem[]>(
    initialTransactions || [
      {
        id: 'tx-001',
        phoneNumber: '254722123456',
        amount: '25000.00',
        planCode: 'PORTFOLIO_TIER',
        mpesaReceiptNumber: 'NL88491023',
        transactionStatus: 'SUCCESS',
        subscriptionPeriodStart: new Date(Date.now() - 4 * 86400000).toISOString(),
        subscriptionPeriodEnd: new Date(Date.now() + 26 * 86400000).toISOString(),
        createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      },
      {
        id: 'tx-002',
        phoneNumber: '254722123456',
        amount: '7500.00',
        planCode: 'PROJECT_TIER',
        mpesaReceiptNumber: 'MK19283746',
        transactionStatus: 'SUCCESS',
        subscriptionPeriodStart: new Date(Date.now() - 34 * 86400000).toISOString(),
        subscriptionPeriodEnd: new Date(Date.now() - 4 * 86400000).toISOString(),
        createdAt: new Date(Date.now() - 34 * 86400000).toISOString(),
      },
    ]
  );

  const [showStkModal, setShowStkModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'PROJECT_TIER' | 'PORTFOLIO_TIER'>('PORTFOLIO_TIER');
  const [phoneNumber, setPhoneNumber] = useState('0722123456');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stkFeedback, setStkFeedback] = useState<string | null>(null);

  const handleInitiatePush = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStkFeedback(null);

    const amount = selectedPlan === 'PORTFOLIO_TIER' ? '25000.00' : '7500.00';
    let formattedPhone = phoneNumber.replace(/\+/g, '').replace(/\s+/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = `254${formattedPhone.slice(1)}`;
    }

    try {
      if (onInitiateStkPush) {
        await onInitiateStkPush({ phoneNumber: formattedPhone, planCode: selectedPlan, amount });
      }

      // Simulate instantaneous Daraja STK Push dispatch & callback
      const receiptNo = `QA${Date.now().toString().slice(-8)}`;
      const newTx: SubscriptionTransactionItem = {
        id: `tx-${Date.now()}`,
        phoneNumber: formattedPhone,
        amount,
        planCode: selectedPlan,
        mpesaReceiptNumber: receiptNo,
        transactionStatus: 'SUCCESS',
        subscriptionPeriodStart: new Date().toISOString(),
        subscriptionPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        createdAt: new Date().toISOString(),
      };

      setTransactions([newTx, ...transactions]);
      setActivePlan(selectedPlan);
      setSubscriptionState('ACTIVE');
      setMonthlyFee(amount);
      setDaysRemaining(30);
      setLastPaymentRef(receiptNo);

      setStkFeedback(`STK Push dispatched to ${formattedPhone}. Authorized KES ${amount}. Receipt: ${receiptNo}`);
      setTimeout(() => {
        setShowStkModal(false);
        setStkFeedback(null);
      }, 1500);
    } catch (err: any) {
      setStkFeedback(`Failed: ${err.message || 'M-Pesa STK push error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">ACTIVE</span>;
      case 'TRIAL':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">14-DAY TRIAL</span>;
      case 'GRACE_PERIOD':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">GRACE PERIOD</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">SUSPENDED</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800">Safaricom Daraja M-Pesa Subscription Billing</h2>
            {getStatusBadge(subscriptionState)}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Enterprise Tier Billing (ADR-006): Zero Seat Tax, Lipa Na M-Pesa Online Instant STK Push & Auto-Reconciliation
          </p>
        </div>
        <button
          onClick={() => setShowStkModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm shadow-sm transition-colors"
        >
          <span>Pay / Upgrade with M-Pesa</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Plan</p>
          <p className="text-xl font-bold text-slate-800 mt-1">
            {activePlan === 'PORTFOLIO_TIER' ? 'Portfolio Tier' : 'Single Project Tier'}
          </p>
          <p className="text-xs text-emerald-600 mt-1 font-medium">KES {monthlyFee} / Month</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Validity Remaining</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{daysRemaining} Days</p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-emerald-500 h-1.5 rounded-full"
              style={{ width: `${Math.min(100, (daysRemaining / 30) * 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Project Capacity</p>
          <p className="text-xl font-bold text-slate-800 mt-1">
            {activePlan === 'PORTFOLIO_TIER' ? 'Unlimited' : '1 Active Site'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Free Unlimited Subcontractor Seats</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Last M-Pesa Receipt</p>
          <p className="text-lg font-mono font-bold text-slate-800 mt-1">{lastPaymentRef || 'None'}</p>
          <p className="text-xs text-slate-400 mt-1">Safaricom Daraja Verified</p>
        </div>
      </div>

      {/* Plan Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Project Tier Card */}
        <div className={`p-6 rounded-xl border ${activePlan === 'PROJECT_TIER' ? 'border-emerald-500 ring-2 ring-emerald-100 bg-white' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Single Project</span>
              <h3 className="text-lg font-bold text-slate-800 mt-1">Project Tier</h3>
              <p className="text-2xl font-bold text-slate-900 mt-2">KES 7,500 <span className="text-xs font-normal text-slate-500">/ month</span></p>
            </div>
            {activePlan === 'PROJECT_TIER' && (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">Current Plan</span>
            )}
          </div>
          <ul className="mt-4 space-y-2 text-xs text-slate-600">
            <li className="flex items-center gap-2">✓ 1 Active Construction Project</li>
            <li className="flex items-center gap-2">✓ Zero Seat Tax: Free External Subcontractors & Clients</li>
            <li className="flex items-center gap-2">✓ JBC 1999 IPC & BORAQS BoQ Valuation Engine</li>
            <li className="flex items-center gap-2">✓ Offline-First PWA Site Attendance & Muster Roll</li>
            <li className="flex items-center gap-2">✓ M-Pesa Casual Wage Disbursements</li>
          </ul>
          <button
            onClick={() => { setSelectedPlan('PROJECT_TIER'); setShowStkModal(true); }}
            className={`w-full mt-5 py-2 px-4 rounded-lg font-medium text-xs transition-colors ${
              activePlan === 'PROJECT_TIER' ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {activePlan === 'PROJECT_TIER' ? 'Renew Single Project Tier' : 'Switch to Project Tier'}
          </button>
        </div>

        {/* Portfolio Tier Card */}
        <div className={`p-6 rounded-xl border ${activePlan === 'PORTFOLIO_TIER' ? 'border-emerald-500 ring-2 ring-emerald-100 bg-white' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Enterprise</span>
              <h3 className="text-lg font-bold text-slate-800 mt-1">Portfolio Tier</h3>
              <p className="text-2xl font-bold text-slate-900 mt-2">KES 25,000 <span className="text-xs font-normal text-slate-500">/ month</span></p>
            </div>
            {activePlan === 'PORTFOLIO_TIER' && (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">Current Plan</span>
            )}
          </div>
          <ul className="mt-4 space-y-2 text-xs text-slate-600">
            <li className="flex items-center gap-2">✓ Unlimited Active Construction Sites & Portfolios</li>
            <li className="flex items-center gap-2">✓ Direct Plant GPS Telematics & Remote Fuel Siphoning Detection</li>
            <li className="flex items-center gap-2">✓ Automated KRA E-TIMS & Electronic Tax Invoice Signing</li>
            <li className="flex items-center gap-2">✓ WhatsApp & SMS Two-Way Site Ops Webhooks & Emergency Alerts</li>
            <li className="flex items-center gap-2">✓ Dual-Moiety Retention Release & Contractor Performance Bonds</li>
          </ul>
          <button
            onClick={() => { setSelectedPlan('PORTFOLIO_TIER'); setShowStkModal(true); }}
            className={`w-full mt-5 py-2 px-4 rounded-lg font-medium text-xs transition-colors ${
              activePlan === 'PORTFOLIO_TIER' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {activePlan === 'PORTFOLIO_TIER' ? 'Renew Portfolio Tier' : 'Upgrade to Enterprise Portfolio Tier'}
          </button>
        </div>
      </div>

      {/* Transaction History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Daraja M-Pesa Subscription Transactions</h3>
            <p className="text-xs text-slate-500">Real-time payment audit log for tenant: {tenantName}</p>
          </div>
          <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded">
            {transactions.length} Transactions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Receipt / Ref</th>
                <th className="p-3">Plan Tier</th>
                <th className="p-3">Phone Number</th>
                <th className="p-3">Amount (KES)</th>
                <th className="p-3">Status</th>
                <th className="p-3">Valid Until</th>
                <th className="p-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono font-bold text-slate-800">
                    {tx.mpesaReceiptNumber || 'PENDING'}
                  </td>
                  <td className="p-3">
                    <span className="font-semibold text-slate-700">
                      {tx.planCode === 'PORTFOLIO_TIER' ? 'Portfolio Tier' : 'Project Tier'}
                    </span>
                  </td>
                  <td className="p-3 font-mono">{tx.phoneNumber}</td>
                  <td className="p-3 font-mono font-bold text-slate-800">KES {tx.amount}</td>
                  <td className="p-3">
                    {tx.transactionStatus === 'SUCCESS' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">SUCCESS</span>
                    ) : tx.transactionStatus === 'INITIATED' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">INITIATED</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">FAILED</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-500">
                    {tx.subscriptionPeriodEnd ? new Date(tx.subscriptionPeriodEnd).toLocaleDateString('en-KE') : '—'}
                  </td>
                  <td className="p-3 text-slate-400">
                    {new Date(tx.createdAt).toLocaleString('en-KE')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* STK Push Modal */}
      {showStkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base">Lipa Na M-Pesa Online (STK Push)</h3>
              <button
                onClick={() => setShowStkModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {stkFeedback && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                {stkFeedback}
              </div>
            )}

            <form onSubmit={handleInitiatePush} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Subscription Tier</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPlan('PROJECT_TIER')}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selectedPlan === 'PROJECT_TIER' ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className="font-bold text-slate-800">Project Tier</p>
                    <p className="text-emerald-700 font-mono font-semibold mt-0.5">KES 7,500/mo</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPlan('PORTFOLIO_TIER')}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selectedPlan === 'PORTFOLIO_TIER' ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className="font-bold text-slate-800">Portfolio Tier</p>
                    <p className="text-emerald-700 font-mono font-semibold mt-0.5">KES 25,000/mo</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">M-Pesa Phone Number</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="0712345678"
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">Enter Kenyan phone registered for M-Pesa</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center font-semibold">
                <span className="text-slate-600">Total Payable:</span>
                <span className="text-slate-900 font-bold text-sm">
                  KES {selectedPlan === 'PORTFOLIO_TIER' ? '25,000.00' : '7,500.00'}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStkModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg font-bold shadow-sm"
                >
                  {isSubmitting ? 'Dispatching STK Push...' : 'Authorize on Handset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
