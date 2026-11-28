import React, { useState} from 'react';
import { formatKes, ResponsiveTable } from '../ui';
import MilestoneTimeline, { TimelineItem} from './MilestoneTimeline';
import { statusLabel } from '../lib/status-labels';
import { api, apiErrorMessage } from '../lib/api';

export type ClientDashboardView = 'overview' | 'sites' | 'messages' | 'quotes' | 'reporting' | 'request' | 'account';
export type ClientCurrencyCode = 'KES' | 'USD' | 'GBP' | 'EUR' | 'AED';

export interface ClientSiteItem {
  id: string;
  name: string;
  code?: string;
  status?: string;
  location?: string;
}

export interface ClientFinancialsShape {
  originalAgreedBudget: string;
  approvedVariationsTotal: string;
  currentApprovedBudget: string;
  totalSpentToDate: string;
  remainingBalance: string;
  budgetUsedPercentage: number;
}

export interface ClientProgressShape {
  physicalProgressPercentage: number;
  varianceDelta: number;
  healthStatus: 'ON_TRACK' | 'ATTENTION' | 'ACTION_REQUIRED';
  healthNotice: string;
}

export const ClientPortalNav: React.FC<{
  view: ClientDashboardView;
  setView: React.Dispatch<React.SetStateAction<ClientDashboardView>>;
}> = ({ view, setView }) => (
<nav className="flex gap-1.5 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 max-w-full overflow-x-auto" aria-label="Client portal sections">
        {([['overview', 'Home'], ['sites', 'My sites'], ['messages', 'Messages'], ['quotes', 'Quotes & proposals'], ['reporting', 'Site reporting'], ['request', 'Request a project'], ['account', 'Account']] as const).map(([v, label]) => (
<button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 ${view === v ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
            {label}
</button>
))}
</nav>
);

export const ClientSitesView: React.FC<{
  sites: ClientSiteItem[];
  activeProjectId: string;
  onOpenSite: (siteId: string) => void;
}> = ({ sites, activeProjectId, onOpenSite }) => (
<div className="space-y-3">
<div>
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">My sites</h3>
<p className="text-xs text-slate-500 dark:text-slate-400">Projects shared with you — progress, photos and reports.</p>
</div>
          {sites.length === 0 &&<p className="text-xs text-slate-600">No sites shared with you yet.</p>}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sites.map((st) => (
<button key={st.id}
                onClick={() => onOpenSite(st.id)}
                className={`text-left p-4 rounded-xl border transition ${activeProjectId === st.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-emerald-400'}`}>
<p className="text-sm font-bold text-slate-800 dark:text-slate-100">{st.name}</p>
<p className="text-[11px] text-slate-600 mt-0.5">{st.code}{st.location ? ` · ${st.location}` : ''}</p>
                {st.status &&<span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{statusLabel(st.status)}</span>}
</button>
))}
</div>
</div>
);

export const ClientHeaderBanner: React.FC<{
  tenantName: string;
  projectName: string;
  projectLocation: string;
  ncaRegistration: string;
  projectId: string;
}> = ({ tenantName, projectName, projectLocation, ncaRegistration, projectId }) => (
<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
<div>
<span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full ">
            Client / Property Developer Portal
</span>
<h2 className="text-xl font-bold text-slate-900 mt-1">Project Visibility & Progress Verification</h2>
<p className="text-xs text-slate-500">
            Real-time verified site progress, certified expenditure, and valuation certificates for {tenantName}
</p>
<div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
<span className="font-semibold text-slate-800">{projectName}</span>
<span>•</span>
<span className="text-slate-500">{projectLocation}</span>
<span>•</span>
<span className="tabular-nums text-slate-500">NCA: {ncaRegistration}</span>
</div>
</div>
<div className="flex flex-wrap items-center gap-2 shrink-0">
<a
            href={`/api/v1/projects/${projectId}/reports/ipc`}
            download
            data-testid="download-ipc-btn"
            className="px-3.5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
            title="Download Interim Payment Certificate (IPC PDF)"
          >
<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
</svg>
<span>Download IPC (PDF)</span>
</a>
<a
            href={`/api/v1/projects/${projectId}/reports/summary`}
            download
            data-testid="download-summary-btn"
            className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
            title="Download Executive Project Summary (PDF)"
          >
<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
</svg>
<span>Project Summary (PDF)</span>
</a>
<span className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
            Client Read-Only + Approvals
</span>
</div>
</div>
);

export const WaitingForYouPanel: React.FC<{ approvals: any[] }> = ({ approvals }) => (
<div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
<div className="flex items-center gap-2">
<span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
              Waiting for you
</span>
<span className="text-xs text-amber-800 font-semibold">{approvals.length} item{approvals.length === 1 ? '' : 's'} need your attention</span>
</div>
<div className="space-y-1.5">
            {approvals.slice(0, 6).map((a: any, i: number) => (
<div key={a.id || i} className="flex items-start justify-between gap-3 text-xs bg-white/70 border border-amber-100 rounded-lg px-3 py-2">
<span className="font-semibold text-slate-800 min-w-0 break-words">{a.title || a.certificate_no || 'Item'}</span>
<span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold">
                  {a.type === 'VARIATION' ? 'Variation order' : a.type === 'CERTIFICATE' ? 'Payment certificate' : a.type === 'QUOTE' ? 'Quote' : 'Approval'}
                  {a.amount ? ` • ${formatKes(String(a.amount))}` : ''}
</span>
</div>
))}
</div>
</div>
);

export const InvoicesPaymentsCard: React.FC<{
  paymentInstructions: any;
  invoices: any[];
  noticeSent: string | null;
  onNoticeSent: (id: string) => void;
}> = ({ paymentInstructions, invoices, noticeSent, onNoticeSent }) => (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
<div>
<span className="text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full">
              Invoices & Payments
</span>
<h3 className="text-base font-bold text-slate-900 mt-1">Your invoices and how to pay</h3>
</div>

        {paymentInstructions && (
<div className="p-3.5 bg-sky-50 border border-sky-200 rounded-lg text-xs text-slate-700 space-y-1">
<span className="font-semibold text-slate-900 block">Payment instructions</span>
            {paymentInstructions.paybill && <p>Paybill: <span className="tabular-nums font-bold">{paymentInstructions.paybill}</span></p>}
            {paymentInstructions.till && <p>Buy Goods Till: <span className="tabular-nums font-bold">{paymentInstructions.till}</span></p>}
            {paymentInstructions.bank && (
<p>Bank: {paymentInstructions.bank.bankName} — A/C {paymentInstructions.bank.accountNumber} ({paymentInstructions.bank.accountName})</p>
)}
            {!paymentInstructions.paybill && !paymentInstructions.till && !paymentInstructions.bank && (
<p className="text-slate-500">{JSON.stringify(paymentInstructions)}</p>
)}
</div>
)}

        {invoices.length === 0 ? (
<p className="text-xs text-slate-600">No invoices yet.</p>
) : (
<ResponsiveTable
            head={['Invoice', 'Status', 'Total', 'Balance due', 'Payments', '']}
            className="border-collapse text-xs"
            rows={invoices.slice(0, 10).map((inv: any) => {
              const invoiceStatusLabel: Record<string, string> = {
                DRAFT: 'Draft', SENT: 'Sent — awaiting payment', VIEWED: 'Viewed',
                PART_PAID: 'Part paid', PAID: 'Paid', OVERDUE: 'Overdue', CANCELLED: 'Cancelled',
              };
              const balance = parseFloat(inv.balance_due ?? inv.balanceDue ?? '0');
              const history = inv.payment_history || inv.paymentHistory || inv.payments || [];
              const notices = inv.payment_notices || inv.paymentNotices || [];
              return {
                key: inv.id,
                cells: [
                  { content: inv.title || `Invoice #${inv.invoice_no ?? ''}`, className: 'font-semibold text-slate-800' },
                  {
                    content: (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : balance > 0 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                        {invoiceStatusLabel[inv.status] || inv.status}
</span>
                    ),
                  },
                  { content: formatKes(String(inv.total ?? '0')), className: 'tabular-nums' },
                  { content: formatKes(String(balance)), className: 'tabular-nums font-bold text-slate-900' },
                  {
                    content: (
                      <>
                        {history.length > 0 ? `${history.length} payment${history.length === 1 ? '' : 's'} recorded` : '—'}
                        {notices.length > 0 && <span className="block text-[10px] text-sky-700">{notices.length} notice{notices.length === 1 ? '' : 's'} sent</span>}
                      </>
                    ),
                    className: 'text-slate-500',
                  },
                  {
                    content: (
                      <div className="flex flex-col items-end gap-1">
                        {balance > 0 && !['PAID', 'CANCELLED', 'DRAFT'].includes(inv.status) && (
<InvoicePayNotice invoice={inv} onSent={onNoticeSent} />
)}
                        {noticeSent === inv.id && <span className="text-[10px] font-bold text-emerald-700">Notice sent to contractor</span>}
                      </div>
                    ),
                    className: 'text-right',
                  },
                ],
              };
            })}
          />
)}
</div>
);

export const FinancialSummarySection: React.FC<{
  financials: ClientFinancialsShape;
  effectiveCurrency: ClientCurrencyCode;
  selectedCurrency: ClientCurrencyCode;
  setSelectedCurrency: React.Dispatch<React.SetStateAction<ClientCurrencyCode>>;
  fxFeed: { rates: Record<string, number>; asOf?: string; source?: string } | null;
  exchangeRates: Record<ClientCurrencyCode, { rate: number | undefined; symbol: string; label: string}>;
  exchangeRateText: string;
  formatWithCurrency: (kesStr: string, isAddition?: boolean) => string;
}> = ({ financials, effectiveCurrency, selectedCurrency, setSelectedCurrency, fxFeed, exchangeRateText, formatWithCurrency }) => (
<div className="space-y-3">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-1 gap-2">
<div>
<h3 className="text-sm font-bold text-slate-900">Financial Summary & Budget Control</h3>
<p className="text-[11px] text-slate-500">
              {effectiveCurrency === 'KES'
                ? 'Base contract currency: Kenyan Shilling (KES)'
                : fxFeed
                  ? `Diaspora converted estimate: 1 ${selectedCurrency} ≈ ${exchangeRateText} KES • Official valuation in KES`
                  : 'Exchange rates unavailable — showing KES'}
              {fxFeed?.asOf && <span className="block text-[10px] text-slate-600 mt-0.5">Rates as of {fxFeed.asOf}{fxFeed.source ? ` (${fxFeed.source})` : ''}</span>}
</p>
</div>
<div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
<span className="text-[10px] font-semibold text-slate-500 px-1">Diaspora View:</span>
            {(['KES', 'USD', 'GBP', 'EUR', 'AED'] as ClientCurrencyCode[])
              .map((c) => {
                const rateAvailable = c === 'KES' || (fxFeed?.rates?.[c] ?? 0) > 0;
                return (
<button
                key={c}
                type="button"
                disabled={!rateAvailable}
                title={rateAvailable ? undefined : 'Exchange rate unavailable — KES only'}
                onClick={() => rateAvailable && setSelectedCurrency(c)}
                data-testid={`currency-toggle-${c.toLowerCase()}`}
                className={`px-2 py-0.5 text-xs font-bold rounded transition ${
                  !rateAvailable
                    ? 'text-slate-300 cursor-not-allowed'
                    : selectedCurrency === c
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
}`}
              >
                {c}
</button>
);
              })}
</div>
</div>

<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Card 1: Original Agreed Budget */}
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<span className="text-[11px] font-semibold text-slate-500 block">
              Original Agreed Budget
</span>
<span className="text-base sm:text-lg font-bold tabular-nums text-slate-900 mt-1 block">
              {formatWithCurrency(financials.originalAgreedBudget)}
</span>
            {selectedCurrency !== 'KES' ? (
<span className="text-[10px] text-slate-600 tabular-nums mt-0.5 block">
                Base: {formatKes(financials.originalAgreedBudget)}
</span>
) : (
<span className="text-[11px] text-slate-600 mt-0.5 block">Approved Contract Sum</span>
)}
</div>

          {/* Card 2: Approved Variations Total */}
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<span className="text-[11px] font-semibold text-slate-500 block">
              Approved Variations Total
</span>
<span className="text-base sm:text-lg font-bold tabular-nums text-blue-700 mt-1 block">
              {formatWithCurrency(financials.approvedVariationsTotal, true)}
</span>
            {selectedCurrency !== 'KES' ? (
<span className="text-[10px] text-slate-600 tabular-nums mt-0.5 block">
                Base: {formatKes(financials.approvedVariationsTotal)}
</span>
) : (
<span className="text-[11px] text-slate-600 mt-0.5 block">Net approved scope changes</span>
)}
</div>

          {/* Card 3: Current Approved Budget */}
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<span className="text-[11px] font-semibold text-slate-500 block">
              Current Approved Budget
</span>
<span className="text-base sm:text-lg font-bold tabular-nums text-slate-900 mt-1 block">
              {formatWithCurrency(financials.currentApprovedBudget)}
</span>
            {selectedCurrency !== 'KES' ? (
<span className="text-[10px] text-slate-600 tabular-nums mt-0.5 block">
                Base: {formatKes(financials.currentApprovedBudget)}
</span>
) : (
<span className="text-[11px] text-slate-600 mt-0.5 block">Baseline + Variations</span>
)}
</div>

          {/* Card 4: Total Spent to Date */}
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<span className="text-[11px] font-semibold text-slate-500 block">
              Total Spent to Date
</span>
<span className="text-base sm:text-lg font-bold tabular-nums text-emerald-700 mt-1 block">
              {formatWithCurrency(financials.totalSpentToDate)}
</span>
            {selectedCurrency !== 'KES' ? (
<span className="text-[10px] text-slate-600 tabular-nums mt-0.5 block">
                Base: {formatKes(financials.totalSpentToDate)}
</span>
) : (
<span className="text-[11px] text-slate-600 mt-0.5 block">Total Certified Cost</span>
)}
</div>

          {/* Card 5: Remaining Balance */}
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 md:col-span-1">
<span className="text-[11px] font-semibold text-slate-500 block">
              Remaining Balance
</span>
<span className="text-base sm:text-lg font-bold tabular-nums text-slate-900 mt-1 block">
              {formatWithCurrency(financials.remainingBalance)}
</span>
            {selectedCurrency !== 'KES' ? (
<span className="text-[10px] text-slate-600 tabular-nums mt-0.5 block">
                Base: {formatKes(financials.remainingBalance)}
</span>
) : (
<span className="text-[11px] text-slate-600 mt-0.5 block">Available project funds</span>
)}
</div>
</div>

        {/* Visual Budget Progress Bar */}
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
<div className="flex justify-between items-center text-xs">
<div className="flex items-center gap-2">
<span className="font-semibold text-slate-700">Project Budget Utilization:</span>
<span className="font-bold text-slate-900 tabular-nums">
                {`${financials.budgetUsedPercentage.toFixed(1)}% Consumed`}
</span>
</div>
<span className="text-slate-500 tabular-nums text-[11px]">
              {formatKes(financials.totalSpentToDate)} of {formatKes(financials.currentApprovedBudget)}
</span>
</div>
<div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
<div
              className="bg-emerald-700 h-3 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, financials.budgetUsedPercentage))}%`}}
            />
</div>
</div>
</div>
);

export const ProjectHealthCard: React.FC<{
  healthBadge: { bg: string; dot: string; label: string };
  healthNotice: string;
  physicalPctString: string;
  budgetPctString: string;
  varianceDeltaString: string;
  varianceDelta: number;
}> = ({ healthBadge, healthNotice, physicalPctString, budgetPctString, varianceDeltaString, varianceDelta }) => (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
<div>
<span className="text-[10px] font-bold text-slate-600 block">
              Automated Variance Analytics
</span>
<h3 className="text-base font-bold text-slate-900 mt-0.5">Project Health & Alignment Guard</h3>
</div>
<div className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${healthBadge.bg}`}>
<span className={`w-2 h-2 rounded-full ${healthBadge.dot}`} />
<span>{healthBadge.label}</span>
</div>
</div>

<div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-start gap-2.5">
<span className="text-base"></span>
<div>
<span className="font-semibold text-slate-900 block">Factual Status Notice:</span>
<p className="mt-0.5 text-slate-600">{healthNotice}</p>
</div>
</div>

<div className="grid grid-cols-3 gap-3 pt-1 text-center">
<div className="bg-white p-3 rounded-lg border border-slate-200">
<span className="text-[11px] font-semibold text-slate-500 block">
              Physical Progress
</span>
<span className="text-lg font-bold text-emerald-700 mt-0.5 block">
              {physicalPctString}
</span>
</div>

<div className="bg-white p-3 rounded-lg border border-slate-200">
<span className="text-[11px] font-semibold text-slate-500 block">
              Budget Consumed
</span>
<span className="text-lg font-bold text-slate-800 mt-0.5 block">
              {budgetPctString}
</span>
</div>

<div className="bg-white p-3 rounded-lg border border-slate-200">
<span className="text-[11px] font-semibold text-slate-500 block">
              Variance Delta
</span>
<span
              className={`text-lg font-bold tabular-nums mt-0.5 block ${
                varianceDelta > 0 ? 'text-amber-700' : 'text-emerald-700'
}`}
            >
              {varianceDeltaString}
</span>
</div>
</div>
</div>
);

export const CertifiedIpcsCard: React.FC<{
  effectiveCurrency: ClientCurrencyCode;
  selectedCurrency: ClientCurrencyCode;
  currencyLabel: string;
  financials: ClientFinancialsShape;
  progress: ClientProgressShape;
  paymentCertificates: any[] | null;
  hydrated: boolean;
  formatWithCurrency: (kesStr: string, isAddition?: boolean) => string;
}> = ({ effectiveCurrency, selectedCurrency, currencyLabel, financials, progress, paymentCertificates, hydrated, formatWithCurrency }) => (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div>
<div className="flex items-center gap-2">
<span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                Certified Valuations Ledger
</span>
<span className="text-xs text-slate-500">
                Currency: {effectiveCurrency} ({currencyLabel})
</span>
</div>
<h3 className="text-base font-bold text-slate-900 mt-1">
              Certified IPCs, Contractor Payments &amp; Variance Schedule
</h3>
<p className="text-xs text-slate-500">
              Interim Payment Certificates certified by Quantity Surveyor and paid by Client Developer.
</p>
</div>

<div className="text-left sm:text-right text-xs">
<span className="text-[10px] text-slate-600 font-semibold block">Total Net Paid to Date</span>
<span className="text-base tabular-nums font-bold text-emerald-700">
              {formatWithCurrency(String((paymentCertificates || []).filter((c: any) => c.status === 'PAID').reduce((a: number, c: any) => a + parseFloat(c.net_payable || '0'), 0)))}
</span>
<span className="text-[10px] text-slate-600 block">Gross Certified: {formatWithCurrency(financials.totalSpentToDate)}</span>
</div>
</div>

        {/* Dynamic Multi-Currency Valuation Summary Bar */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-slate-500 text-[10px] font-semibold block">Total Contract Sum:</span>
<span className="text-sm font-bold tabular-nums text-slate-900 mt-0.5 block">
              {formatWithCurrency(financials.originalAgreedBudget)}
</span>
<span className="text-[10px] text-slate-600 tabular-nums">Base: {formatKes(financials.originalAgreedBudget)}</span>
</div>

<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-slate-500 text-[10px] font-semibold block">Gross Certified IPCs:</span>
<span className="text-sm font-bold tabular-nums text-emerald-700 mt-0.5 block">
              {formatWithCurrency(financials.totalSpentToDate)}
</span>
<span className="text-[10px] text-slate-600 tabular-nums">Base: {formatKes(financials.totalSpentToDate)}</span>
</div>

<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-slate-500 text-[10px] font-semibold block">Net Payments Disbursed:</span>
<span className="text-sm font-bold tabular-nums text-blue-700 mt-0.5 block">
              {formatWithCurrency(String((paymentCertificates || []).reduce((a: number, c: any) => a + parseFloat(c.net_payable || '0'), 0)))}
</span>
<span className="text-[10px] text-slate-600">Sum of net payable on certified IPCs</span>
</div>

{hydrated && progress.varianceDelta !== 0 && (
<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-slate-500 text-[10px] font-semibold block">Progress vs plan:</span>
<span className={`text-sm font-bold tabular-nums mt-0.5 block ${progress.varianceDelta >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {progress.varianceDelta >= 0 ? '+' : ''}{progress.varianceDelta.toFixed(1)} pts
</span>
<span className="text-[10px] text-slate-500 font-medium">{progress.healthNotice}</span>
</div>
)}
</div>

        {/* Certified IPCs Table */}
<ResponsiveTable
            head={['Certificate Ref', `Milestone Scope`, 'Date Certified', `Gross Certified (${selectedCurrency})`, `Retention Held (${selectedCurrency})`, `Net Payment (${selectedCurrency})`, 'Status']}
            className="border-collapse text-xs"
            empty={hydrated ? 'No certified payment certificates yet.' : 'Loading certificates…'}
            rows={(paymentCertificates || []).map((c: any) => ({
              key: c.id,
              className: 'hover:bg-slate-50/60',
              cells: [
                { content: c.certificate_no, className: 'font-mono tabular-nums font-bold text-slate-800' },
                { content: `${c.period_start} → ${c.period_end}`, className: 'text-slate-700' },
                { content: c.certified_at ? c.certified_at.split('T')[0] : '—', className: 'text-slate-500 font-mono tabular-nums' },
                { content: formatWithCurrency(c.this_period_amount), className: 'font-mono tabular-nums font-bold text-slate-900' },
                { content: formatWithCurrency(c.retention_held), className: 'tabular-nums text-amber-700' },
                { content: formatWithCurrency(c.net_payable), className: 'tabular-nums font-bold text-emerald-700' },
                {
                  content: (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${c.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-sky-100 text-sky-800 border-sky-300'}`}>
                      {c.status === 'PAID' ? 'Paid' : 'Certified'}
</span>
                  ),
                  className: 'text-right',
                },
              ],
            }))}
          />
</div>
);

export const MilestonesRetentionSection: React.FC<{
  timeline: TimelineItem[] | undefined;
  projectName: string;
  projectCode: string;
  ncaRegistration: string;
  retentionTerms: any;
}> = ({ timeline, projectName, projectCode, ncaRegistration, retentionTerms }) => (
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Milestone Timeline Component */}
<MilestoneTimeline
          items={timeline}
          projectName={projectName}
          projectCode={projectCode}
          ncaRegistration={ncaRegistration}
        />

        {/* Retention Fund & Contract Terms Card */}
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
<div>
<span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
              Statutory Protection
</span>
<h3 className="text-base font-bold text-slate-900 mt-1">Contract Retention Terms</h3>
<p className="text-xs text-slate-500">{retentionTerms ? 'Terms set by your contractor' : 'Standard Kenyan schedule (contractor has not set custom terms)'}</p>
</div>

        {(() => {
          // Tenant-configured terms (camelCase from company settings, or the
          // API default snake_case shape) — never hard-code percentages.
          const rt = retentionTerms || {};
          const interim = rt.interimDeductionRatePct ?? rt.interim_deduction_rate;
          const capRate = rt.maxCapRatePct ?? rt.max_cap_rate;
          const capAmount = rt.maxCapAmount ?? rt.max_cap_amount;
          const schedule = rt.releaseSchedule ?? rt.release_schedule;
          const scheduleText = typeof schedule === 'string'
            ? schedule
            : Array.isArray(schedule)
              ? schedule.map((s: any) => s.description || `${s.percentage ?? s.rate ?? ''} at ${s.milestone ?? 'milestone'}`).join(' • ')
              : null;
          return (
<div className="space-y-3 text-xs">
<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
<span className="text-slate-500 block text-[11px]">Interim Certificate Deduction:</span>
<span className="font-bold text-slate-800 text-sm">
                  {interim
                    ? `${String(interim)} per certificate${capRate ? `, capped at ${String(capRate)} of the contract sum` : ''}`
                    : 'Not specified by contractor'}
</span>
</div>

<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
<span className="text-slate-500 block text-[11px]">Maximum Retention Fund Cap:</span>
<span className="font-bold text-slate-800 text-sm">
                  {capAmount ? `${formatKes(String(capAmount))} ` : ''}{capRate ? <span className="font-normal text-slate-500">({String(capRate)} of Contract Sum)</span> : (!capAmount ? 'Not specified by contractor' : null)}
</span>
</div>

{scheduleText && (
<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
<span className="text-slate-500 block text-[11px]">Release Schedule:</span>
<span className="font-medium text-slate-700 block">{scheduleText}</span>
</div>
)}
</div>
);
        })()}
</div>
</div>
);

/** Stage-2: client reports "I have paid" — a notice only, never mutates the invoice. */
export function InvoicePayNotice({ invoice, onSent }: { invoice: any; onSent: (id: string) => void }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(invoice.balance_due ?? invoice.balanceDue ?? ''));
  const [method, setMethod] = useState('M_PESA');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await api.post(`/api/v1/client/invoices/${invoice.id}/payment-notice`, {
        amount: parseFloat(amount) || 0,
        method,
        reference: reference || undefined,
        note: note || undefined,
      });
      onSent(invoice.id);
      setOpen(false);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not send notice'));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 transition"
      >
        I've paid — notify
      </button>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1.5 items-end">
      <div className="flex gap-1.5 items-center">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          inputMode="decimal"
          className="w-20 px-2 py-1 text-[11px] border border-slate-300 rounded"
        />
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-1.5 py-1 text-[11px] border border-slate-300 rounded">
          <option value="M_PESA">M-Pesa</option>
          <option value="BANK">Bank transfer</option>
          <option value="CHEQUE">Cheque</option>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
        </select>
      </div>
      <input
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder="Payment reference"
        className="w-44 px-2 py-1 text-[11px] border border-slate-300 rounded"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="w-44 px-2 py-1 text-[11px] border border-slate-300 rounded"
      />
      {method === 'M_PESA' && (
        <span className="text-[10px] text-amber-700">
          M-Pesa cap: {formatKes(150000)} per transaction — pay in parts if needed{(parseFloat(amount) || 0) > 150000 ? ' — this amount exceeds it' : ''}
        </span>
      )}
      {error && <span className="text-[10px] text-rose-700">{error}</span>}
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-sky-700 text-white hover:bg-sky-800 disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send notice'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-2 py-1 text-[10px] font-semibold text-slate-500">
          Cancel
        </button>
      </div>
      <span className="text-[9px] text-slate-600">Notifies contractor — invoice unchanged until they confirm.</span>
    </div>
  );
}
