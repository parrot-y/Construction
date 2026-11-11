import React, { useEffect, useState} from 'react';
import { formatKes } from '../ui';
import { AuthSession} from '../types/auth';
import MilestoneTimeline, { TimelineItem} from './MilestoneTimeline';
import PhotoEvidenceGallery from './PhotoEvidenceGallery';
import { PhotoEvidenceItem} from './PhotoLightboxModal';
import VarianceMonitorCard from './VarianceMonitorCard';
import VariationManagementView from './VariationManagementView';
import PracticalCompletionCard from './PracticalCompletionCard';
import SnaggingListView from './SnaggingListView';
import IndependentSiteReportView from './IndependentSiteReportView';
import ContractorTenderBoardView from './ContractorTenderBoardView';
import { isModuleEnabled } from '../lib/modules';
import ClientQuotesView from './ClientQuotesView';
import AnnouncementsView from './AnnouncementsView';
import InboxView from './InboxView';
import ClientRequestView from './ClientRequestView';
import ClientAccountView from './ClientAccountView';

interface ClientDashboardProps {
  session: AuthSession;
  projectData?: {
    id: string;
    name: string;
    code: string;
    location: string;
    ncaRegistration: string;
    startDate?: string;
    expectedCompletionDate?: string;
};
  financials?: {
    originalAgreedBudget: string;
    approvedVariationsTotal: string;
    currentApprovedBudget: string;
    totalSpentToDate: string;
    remainingBalance: string;
    budgetUsedPercentage: number;
};
  progress?: {
    physicalProgressPercentage: number;
    varianceDelta: number;
    healthStatus: 'ON_TRACK' | 'ATTENTION' | 'ACTION_REQUIRED';
    healthNotice: string;
};
  photos?: PhotoEvidenceItem[];
  timeline?: TimelineItem[];
}

const DEFAULT_PROJECT = {
  id: '',
  name: '',
  code: '',
  location: '',
  ncaRegistration: '',
  startDate: '',
  expectedCompletionDate: '',
};
const DEFAULT_FINANCIALS = {
  originalAgreedBudget: '0.00',
  approvedVariationsTotal: '0.00',
  currentApprovedBudget: '0.00',
  totalSpentToDate: '0.00',
  remainingBalance: '0.00',
  budgetUsedPercentage: 0,
};
const DEFAULT_PROGRESS = {
  physicalProgressPercentage: 0,
  varianceDelta: 0,
  healthStatus: 'ON_TRACK' as const,
  healthNotice: 'No progress data recorded yet.',
};

export default function ClientDashboard({
  session,
  projectData: projectDataProp,
  financials: financialsProp,
  progress: progressProp,
  photos: photosProp,
  timeline: timelineProp,
}: ClientDashboardProps): React.JSX.Element {
  const { user} = session;

  const [projectData, setProjectData] = useState(projectDataProp ?? DEFAULT_PROJECT);
  const [view, setView] = useState<'overview' | 'sites' | 'messages' | 'quotes' | 'reporting' | 'request' | 'account'>('overview');
  const [sites, setSites] = useState<{ id: string; name: string; code?: string; status?: string; location?: string}[]>([]);
  const [financials, setFinancials] = useState(financialsProp ?? DEFAULT_FINANCIALS);
  const [progress, setProgress] = useState(progressProp ?? DEFAULT_PROGRESS);
  const [paymentCertificates, setPaymentCertificates] = useState<any[] | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [photos, setPhotos] = useState(photosProp);
  const [timeline, setTimeline] = useState(timelineProp);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [paymentInstructions, setPaymentInstructions] = useState<any>(null);
  const [retentionTerms, setRetentionTerms] = useState<any>(null);
  const [noticeSent, setNoticeSent] = useState<string | null>(null);

  // Hydrate from the live client-portal endpoint (real project data).
  const loadProject = async (pid: string) => {
      try {
        const res = await fetch(`/api/v1/projects/${pid}/client-portal`, { credentials: 'include'});
        if (!res.ok) return;
        const json = await res.json();
        const d = json.data || json;
        if (!d?.project) return;
        setProjectData({
          id: d.project.id,
          name: d.project.name,
          code: d.project.code,
          location: d.project.location || '',
          ncaRegistration: d.project.nca_registration_no || '',
          startDate: d.project.start_date || '',
          expectedCompletionDate: d.project.expected_completion_date || '',
});
        if (d.financials) setFinancials({
          originalAgreedBudget: d.financials.original_agreed_budget,
          approvedVariationsTotal: d.financials.approved_variations_total,
          currentApprovedBudget: d.financials.current_approved_budget,
          totalSpentToDate: d.financials.total_spent_to_date,
          remainingBalance: d.financials.remaining_balance,
          budgetUsedPercentage: d.financials.budget_used_percentage,
});
        if (d.progress) setProgress({
          physicalProgressPercentage: d.progress.physical_progress_percentage,
          varianceDelta: d.progress.variance_delta,
          healthStatus: d.progress.health_status,
          healthNotice: d.progress.health_notice,
});
        if (d.photo_evidence) setPhotos(d.photo_evidence.map((p: any) => ({
          id: p.id,
          caption: p.caption || 'Site photo evidence',
          photo_url: p.photo_url || (p.storage_key ? `/uploads/${p.storage_key}` : ''),
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          captured_at: p.captured_at || p.taken_at || '',
          weather: p.weather,
          recorded_by_name: p.recorded_by_name,
})));
        if (d.timeline) setTimeline(d.timeline.map((t: any) => ({
          id: t.id, percentage: t.percentage, notes: t.notes,
          recordedAt: t.recorded_at, itemDescription: t.item_description,
          sectionCode: t.section_code,
})));
        if (Array.isArray(d.payment_certificates)) setPaymentCertificates(d.payment_certificates);
        if (d.retention_terms) setRetentionTerms(d.retention_terms);
        if (d.payment_instructions) setPaymentInstructions(d.payment_instructions);
        setHydrated(true);
} catch { /* keep demo defaults */}
};

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const plist = await fetch('/api/v1/projects', { credentials: 'include'});
        if (!plist.ok) return;
        const pj = await plist.json();
        const list = pj.data || [];
        if (!cancelled) setSites(list.map((p: any) => ({ id: p.id, name: p.name, code: p.code, status: p.status, location: p.location})));
        const first = list[0];
        if (!first?.id || cancelled) return;
        await loadProject(first.id);
} catch { /* keep demo defaults */}
})();
    return () => { cancelled = true;};
}, []);

  // Stage-2: "Waiting for you" approvals feed + client invoices + dated FX rates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [appr, inv, fx] = await Promise.all([
          fetch('/api/v1/me/approvals', { credentials: 'include'}),
          fetch('/api/v1/me/invoices', { credentials: 'include'}),
          fetch('/api/v1/fx-rates', { credentials: 'include'}),
        ]);
        if (cancelled) return;
        if (appr.ok) {
          const j = await appr.json();
          const d = j.data ?? j;
          setApprovals(Array.isArray(d) ? d : d?.items || d?.approvals || []);
        }
        if (inv.ok) {
          const j = await inv.json();
          const d = j.data ?? j;
          const list = Array.isArray(d) ? d : d?.invoices || [];
          setInvoices(list);
          const pi = d?.paymentInstructions ?? j.paymentInstructions ?? null;
          if (pi) setPaymentInstructions((prev: any) => prev ?? pi);
        }
        if (fx.ok) {
          const j = await fx.json();
          const d = j.data ?? j;
          if (d?.rates) setFxFeed(d);
        }
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true;};
  }, []);

  type CurrencyCode = 'KES' | 'USD' | 'GBP' | 'EUR' | 'AED';
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('KES');
  const [fxFeed, setFxFeed] = useState<{ rates: Record<string, number>; asOf?: string; source?: string } | null>(null);

  // Stage-2: rates come from GET /api/v1/fx-rates (dated + sourced), never hard-coded.
  const exchangeRates: Record<CurrencyCode, { rate: number | undefined; symbol: string; label: string}> = {
    KES: { rate: 1.0, symbol: 'KES', label: 'Kenyan Shilling'},
    USD: { rate: fxFeed?.rates?.USD, symbol: '$', label: 'US Dollar'},
    GBP: { rate: fxFeed?.rates?.GBP, symbol: '£', label: 'British Pound'},
    EUR: { rate: fxFeed?.rates?.EUR, symbol: '€', label: 'Euro'},
    AED: { rate: fxFeed?.rates?.AED, symbol: 'AED', label: 'UAE Dirham'},
};

  const effectiveCurrency: CurrencyCode =
    selectedCurrency !== 'KES' && !(fxFeed?.rates?.[selectedCurrency] ?? 0) ? 'KES' : selectedCurrency;

  const formatWithCurrency = (kesStr: string, isAddition = false): string => {
    const rate = exchangeRates[effectiveCurrency].rate ?? 0;
    // Never convert without a dated, sourced rate feed — show honest KES instead.
    if (effectiveCurrency === 'KES' || !fxFeed || !(rate > 0)) {
      return `${isAddition ? '+ ' : ''}${formatKes(kesStr)}`;
}
    const num = parseFloat(kesStr);
    if (isNaN(num)) return `${exchangeRates[effectiveCurrency].symbol} 0.00`;
    const converted = num / rate;
    const formatted = converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2});
    return `${isAddition ? '+ ' : ''}${exchangeRates[effectiveCurrency].symbol} ${formatted}`;
};


  const getHealthBadge = (status: 'ON_TRACK' | 'ATTENTION' | 'ACTION_REQUIRED') => {
    switch (status) {
      case 'ON_TRACK':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-500',
          label: 'ON TRACK • Normal Alignment',
};
      case 'ATTENTION':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          dot: 'bg-amber-500',
          label: 'ATTENTION • Moderate Disparity',
};
      case 'ACTION_REQUIRED':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200',
          dot: 'bg-rose-500',
          label: 'ACTION REQUIRED • Significant Disparity',
};
}
};

  const healthBadge = getHealthBadge(progress.healthStatus);
  const physicalPctString = `${progress.physicalProgressPercentage.toFixed(1)}%`;
  const budgetPctString = `${financials.budgetUsedPercentage.toFixed(1)}%`;
  const varianceDeltaString = progress.varianceDelta > 0
    ? `+${progress.varianceDelta.toFixed(1)}%`
    : `${progress.varianceDelta.toFixed(1)}%`;

  return (
<div className="space-y-4">
<nav className="flex gap-1.5 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 w-fit" aria-label="Client portal sections">
        {([['overview', 'Home'], ['sites', 'My sites'], ['messages', 'Messages'], ['quotes', 'Quotes & proposals'], ['reporting', 'Site reporting'], ['request', 'Request a project'], ['account', 'Account']] as const).map(([v, label]) => (
<button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${view === v ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
            {label}
</button>
))}
</nav>
      {view === 'sites' ? (
<div className="space-y-3">
<div>
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">My sites</h3>
<p className="text-xs text-slate-500 dark:text-slate-400">Projects shared with you — progress, photos and reports.</p>
</div>
          {sites.length === 0 &&<p className="text-xs text-slate-400">No sites shared with you yet.</p>}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sites.map((st) => (
<button key={st.id}
                onClick={() => { void loadProject(st.id); setView('overview');}}
                className={`text-left p-4 rounded-xl border transition ${projectData.id === st.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-emerald-400'}`}>
<p className="text-sm font-bold text-slate-800 dark:text-slate-100">{st.name}</p>
<p className="text-[11px] text-slate-400 mt-0.5">{st.code}{st.location ? ` · ${st.location}` : ''}</p>
                {st.status &&<span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{st.status}</span>}
</button>
))}
</div>
</div>
) : view === 'messages' ? (
<InboxView currentUserId={user.id} />
) : view === 'quotes' ? (
<ClientQuotesView />
) : view === 'reporting' ? (
<IndependentSiteReportView projectId={projectData.id} projectName={projectData.name} userRole="CLIENT" />
) : view === 'request' ? (
<ClientRequestView />
) : view === 'account' ? (
<ClientAccountView session={session} />
) : (
<div className="space-y-6">
      {/* Header Banner */}
<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
<div>
<span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full ">
            Client / Property Developer Portal
</span>
<h2 className="text-xl font-bold text-slate-900 mt-1">Project Visibility & Progress Verification</h2>
<p className="text-xs text-slate-500">
            Real-time verified site progress, certified expenditure, and valuation certificates for {user.tenant.name}
</p>
<div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
<span className="font-semibold text-slate-800">{projectData.name}</span>
<span>•</span>
<span className="text-slate-500">{projectData.location}</span>
<span>•</span>
<span className="tabular-nums text-slate-500">NCA: {projectData.ncaRegistration}</span>
</div>
</div>
<div className="flex flex-wrap items-center gap-2 shrink-0">
<a
            href={`/api/v1/projects/${projectData.id}/reports/ipc`}
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
            href={`/api/v1/projects/${projectData.id}/reports/summary`}
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

      {/* Stage-2: "Waiting for you" — items needing client/owner attention */}
      {approvals.length > 0 && (
<div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
<div className="flex items-center gap-2">
<span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
              Waiting for you
</span>
<span className="text-xs text-amber-800 font-semibold">{approvals.length} item{approvals.length === 1 ? '' : 's'} need your attention</span>
</div>
<div className="space-y-1.5">
            {approvals.slice(0, 6).map((a: any, i: number) => (
<div key={a.id || i} className="flex items-center justify-between gap-3 text-xs bg-white/70 border border-amber-100 rounded-lg px-3 py-2">
<span className="font-semibold text-slate-800 truncate">{a.title || a.certificate_no || 'Item'}</span>
<span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold">
                  {a.type === 'VARIATION' ? 'Variation order' : a.type === 'CERTIFICATE' ? 'Payment certificate' : a.type === 'QUOTE' ? 'Quote' : 'Approval'}
                  {a.amount ? ` • ${formatKes(String(a.amount))}` : ''}
</span>
</div>
))}
</div>
</div>
)}

      {/* Stage-2: Invoices, balances, payment history & contractor payment instructions */}
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
<p className="text-xs text-slate-400">No invoices yet.</p>
) : (
<div className="overflow-x-auto">
<table className="w-full text-left text-xs border-collapse">
<thead>
<tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
<th className="py-2 px-3">Invoice</th>
<th className="py-2 px-3">Status</th>
<th className="py-2 px-3">Total</th>
<th className="py-2 px-3">Balance due</th>
<th className="py-2 px-3">Payments</th>
<th className="py-2 px-3"></th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
              {invoices.slice(0, 10).map((inv: any) => {
                const statusLabel: Record<string, string> = {
                  DRAFT: 'Draft', SENT: 'Sent — awaiting payment', VIEWED: 'Viewed',
                  PART_PAID: 'Part paid', PAID: 'Paid', OVERDUE: 'Overdue', CANCELLED: 'Cancelled',
                };
                const balance = parseFloat(inv.balance_due ?? inv.balanceDue ?? '0');
                const history = inv.payment_history || inv.paymentHistory || inv.payments || [];
                const notices = inv.payment_notices || inv.paymentNotices || [];
                return (
<tr key={inv.id}>
<td className="py-2 px-3 font-semibold text-slate-800">{inv.title || `Invoice #${inv.invoice_no ?? ''}`}</td>
<td className="py-2 px-3">
<span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : balance > 0 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                        {statusLabel[inv.status] || inv.status}
</span>
</td>
<td className="py-2 px-3 tabular-nums">{formatKes(String(inv.total ?? '0'))}</td>
<td className="py-2 px-3 tabular-nums font-bold text-slate-900">{formatKes(String(balance))}</td>
<td className="py-2 px-3 text-slate-500">
                        {history.length > 0 ? `${history.length} payment${history.length === 1 ? '' : 's'} recorded` : '—'}
                        {notices.length > 0 && <span className="block text-[10px] text-sky-600">{notices.length} notice{notices.length === 1 ? '' : 's'} sent</span>}
</td>
<td className="py-2 px-3 text-right">
                        {balance > 0 && !['PAID', 'CANCELLED', 'DRAFT'].includes(inv.status) && (
<InvoicePayNotice invoice={inv} onSent={(id) => { setNoticeSent(id); setTimeout(() => setNoticeSent(null), 4000); }} />
)}
                        {noticeSent === inv.id && <span className="text-[10px] font-bold text-emerald-700">Notice sent to contractor</span>}
</td>
</tr>
);
              })}
</tbody>
</table>
</div>
)}
</div>

      {/* 5 Plain-Language Financial Cards with Diaspora Multi-Currency Toggle */}
<div className="space-y-3">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-1 gap-2">
<div>
<h3 className="text-sm font-bold text-slate-900">Financial Summary & Budget Control</h3>
<p className="text-[11px] text-slate-500">
              {effectiveCurrency === 'KES'
                ? 'Base contract currency: Kenyan Shilling (KES)'
                : fxFeed
                  ? `Diaspora converted estimate: 1 ${selectedCurrency} ≈ ${exchangeRates[effectiveCurrency].rate?.toFixed(2) ?? '0'} KES • Official valuation in KES`
                  : 'Exchange rates unavailable — showing KES'}
              {fxFeed?.asOf && <span className="block text-[10px] text-slate-400 mt-0.5">Rates as of {fxFeed.asOf}{fxFeed.source ? ` (${fxFeed.source})` : ''}</span>}
</p>
</div>
<div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
<span className="text-[10px] font-semibold text-slate-500 px-1">Diaspora View:</span>
            {(['KES', 'USD', 'GBP', 'EUR', 'AED'] as CurrencyCode[])
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
<span className="text-[10px] text-slate-400 tabular-nums mt-0.5 block">
                Base: {formatKes(financials.originalAgreedBudget)}
</span>
) : (
<span className="text-[11px] text-slate-400 mt-0.5 block">Approved Contract Sum</span>
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
<span className="text-[10px] text-slate-400 tabular-nums mt-0.5 block">
                Base: {formatKes(financials.approvedVariationsTotal)}
</span>
) : (
<span className="text-[11px] text-slate-400 mt-0.5 block">Net approved scope changes</span>
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
<span className="text-[10px] text-slate-400 tabular-nums mt-0.5 block">
                Base: {formatKes(financials.currentApprovedBudget)}
</span>
) : (
<span className="text-[11px] text-slate-400 mt-0.5 block">Baseline + Variations</span>
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
<span className="text-[10px] text-slate-400 tabular-nums mt-0.5 block">
                Base: {formatKes(financials.totalSpentToDate)}
</span>
) : (
<span className="text-[11px] text-slate-400 mt-0.5 block">Total Certified Cost</span>
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
<span className="text-[10px] text-slate-400 tabular-nums mt-0.5 block">
                Base: {formatKes(financials.remainingBalance)}
</span>
) : (
<span className="text-[11px] text-slate-400 mt-0.5 block">Available project funds</span>
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
              className="bg-emerald-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, financials.budgetUsedPercentage))}%`}}
            />
</div>
</div>
</div>

      {/* Neutral Project Health Guard Card (Milestone M9 & M7) */}
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
<div>
<span className="text-[10px] font-bold text-slate-400 block">
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
<p className="mt-0.5 text-slate-600">{progress.healthNotice}</p>
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
                progress.varianceDelta > 0 ? 'text-amber-700' : 'text-emerald-700'
}`}
            >
              {varianceDeltaString}
</span>
</div>
</div>
</div>

      {/* Variance Monitor & Neutral Health Guard (Milestone M7) */}
<VarianceMonitorCard
        projectName={projectData.name}
        approvedBudget={financials.currentApprovedBudget}
        approvedCost={financials.totalSpentToDate}
        pendingCost="0.00"
        detailedVariance={
          hydrated && progress.physicalProgressPercentage != null && financials.budgetUsedPercentage != null
            ? {
                costConsumptionPercentage: String(financials.budgetUsedPercentage),
                physicalProgressPercentage: String(progress.physicalProgressPercentage),
                differencePercentage: `${progress.varianceDelta > 0 ? '+' : ''}${progress.varianceDelta}%`,
                status: progress.healthStatus,
                statusLabel: progress.healthStatus === 'ON_TRACK' ? 'On Track' : progress.healthStatus === 'ATTENTION' ? 'Attention' : 'Action Required',
                severity: progress.healthStatus === 'ON_TRACK' ? 'info' : progress.healthStatus === 'ATTENTION' ? 'warning' : 'critical',
                message: progress.healthNotice || 'Expenditure vs recorded progress.',
              }
            : undefined
        }
      />

      {/* Certified IPCs & Valuation Payments Schedule (Diaspora Multi-Currency Converted) */}
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div>
<div className="flex items-center gap-2">
<span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                Certified Valuations Ledger
</span>
<span className="text-xs text-slate-500">
                Currency: {effectiveCurrency} ({exchangeRates[effectiveCurrency].label})
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
<span className="text-[10px] text-slate-400 font-semibold block">Total Net Paid to Date</span>
<span className="text-base tabular-nums font-bold text-emerald-700">
              {formatWithCurrency(String((paymentCertificates || []).filter((c: any) => c.status === 'PAID').reduce((a: number, c: any) => a + parseFloat(c.net_payable || '0'), 0)))}
</span>
<span className="text-[10px] text-slate-400 block">Gross Certified: {formatWithCurrency(financials.totalSpentToDate)}</span>
</div>
</div>

        {/* Dynamic Multi-Currency Valuation Summary Bar */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-slate-500 text-[10px] font-semibold block">Total Contract Sum:</span>
<span className="text-sm font-bold tabular-nums text-slate-900 mt-0.5 block">
              {formatWithCurrency(financials.originalAgreedBudget)}
</span>
<span className="text-[10px] text-slate-400 tabular-nums">Base: {formatKes(financials.originalAgreedBudget)}</span>
</div>

<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-slate-500 text-[10px] font-semibold block">Gross Certified IPCs:</span>
<span className="text-sm font-bold tabular-nums text-emerald-700 mt-0.5 block">
              {formatWithCurrency(financials.totalSpentToDate)}
</span>
<span className="text-[10px] text-slate-400 tabular-nums">Base: {formatKes(financials.totalSpentToDate)}</span>
</div>

<div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
<span className="text-slate-500 text-[10px] font-semibold block">Net Payments Disbursed:</span>
<span className="text-sm font-bold tabular-nums text-blue-700 mt-0.5 block">
              {formatWithCurrency(String((paymentCertificates || []).reduce((a: number, c: any) => a + parseFloat(c.net_payable || '0'), 0)))}
</span>
<span className="text-[10px] text-slate-400">Sum of net payable on certified IPCs</span>
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
<div className="overflow-x-auto">
<table className="w-full text-left text-xs border-collapse">
<thead>
<tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
<th className="py-2.5 px-3">Certificate Ref</th>
<th className="py-2.5 px-3">Milestone Scope</th>
<th className="py-2.5 px-3">Date Certified</th>
<th className="py-2.5 px-3">Gross Certified ({selectedCurrency})</th>
<th className="py-2.5 px-3">Retention Held ({selectedCurrency})</th>
<th className="py-2.5 px-3">Net Payment ({selectedCurrency})</th>
<th className="py-2.5 px-3 text-right">Status</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
{(paymentCertificates || []).map((c: any) => (
<tr key={c.id} className="hover:bg-slate-50/60">
<td className="py-2.5 px-3 font-mono tabular-nums font-bold text-slate-800">{c.certificate_no}</td>
<td className="py-2.5 px-3 text-slate-700">{c.period_start} → {c.period_end}</td>
<td className="py-2.5 px-3 text-slate-500 font-mono tabular-nums">{c.certified_at ? c.certified_at.split('T')[0] : '—'}</td>
<td className="py-2.5 px-3 font-mono tabular-nums font-bold text-slate-900">{formatWithCurrency(c.this_period_amount)}</td>
<td className="py-2.5 px-3 tabular-nums text-amber-700">{formatWithCurrency(c.retention_held)}</td>
<td className="py-2.5 px-3 tabular-nums font-bold text-emerald-700">{formatWithCurrency(c.net_payable)}</td>
<td className="py-2.5 px-3 text-right">
<span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${c.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-sky-100 text-sky-800 border-sky-300'}`}>
                    {c.status === 'PAID' ? 'Paid' : 'Certified'}
</span>
</td>
</tr>
))}
{hydrated && (paymentCertificates || []).length === 0 && (
<tr><td colSpan={7} className="py-8 text-center text-slate-400">No certified payment certificates yet.</td></tr>
)}
{!hydrated && (
<tr><td colSpan={7} className="py-8 text-center text-slate-400">Loading certificates…</td></tr>
)}
</tbody>
</table>
</div>
</div>

      {/* Project Milestones Timeline & Kenyan Retention Terms */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Milestone Timeline Component */}
<MilestoneTimeline
          items={timeline}
          projectName={projectData.name}
          projectCode={projectData.code}
          ncaRegistration={projectData.ncaRegistration}
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

      {/* Variation Orders & Client Approvals Ledger (Milestone M8 & M9) */}
<VariationManagementView
        projectId={projectData.id}
        userRole="CLIENT"
        canRequest={false}
        canReview={false}
        canApprove={true}
      />

      {/* Verified Photo Evidence Gallery (Milestone M9) */}
<PhotoEvidenceGallery photos={photos} />

      {/* Practical Completion & Retention Release Card */}
<PracticalCompletionCard
        projectName={projectData.name}
        projectCode={projectData.code}
        contractSum={financials.originalAgreedBudget}
      />

      {/* Defects Snagging Verification Register */}
<SnaggingListView
        projectId={projectData.id}
        projectName={projectData.name}
        canAdd={false}
        canRectify={false}
        canVerify={true}
      />

      {/* Platform Diaspora Independent Site Inspection Reports (Milestone M33) */}
<IndependentSiteReportView
        projectId={projectData.id}
        projectName={projectData.name}
        userRole="CLIENT"
      />

      {/* Contractor Tender Board — peripheral module */}
{isModuleEnabled('tenders') && (
<ContractorTenderBoardView
        projectId={projectData.id}
        projectName={projectData.name}
        userRole="CLIENT"
      />
)}

      {/* Quotes & Proposals addressed to this client (Gate-4 S1) */}
<ClientQuotesView />

<AnnouncementsView canManage={false} />
</div>
)}
</div>
);
}

/** Stage-2: client reports "I have paid" — a notice only, never mutates the invoice. */
function InvoicePayNotice({ invoice, onSent }: { invoice: any; onSent: (id: string) => void }): React.JSX.Element {
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
      const res = await fetch(`/api/v1/client/invoices/${invoice.id}/payment-notice`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount) || 0,
          method,
          reference: reference || undefined,
          note: note || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Could not send notice');
      }
      onSent(invoice.id);
      setOpen(false);
    } catch (e: any) {
      setError(e.message || 'Could not send notice');
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
      {error && <span className="text-[10px] text-rose-600">{error}</span>}
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
      <span className="text-[9px] text-slate-400">Notifies contractor — invoice unchanged until they confirm.</span>
    </div>
  );
}
