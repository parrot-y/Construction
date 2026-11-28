import React, { useEffect, useState} from 'react';
import { formatKes } from '../ui';
import { AuthSession} from '../types/auth';
import { TimelineItem} from './MilestoneTimeline';
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
import { api } from '../lib/api';
import {
  CertifiedIpcsCard,
  ClientHeaderBanner,
  ClientPortalNav,
  ClientSitesView,
  FinancialSummarySection,
  InvoicesPaymentsCard,
  MilestonesRetentionSection,
  ProjectHealthCard,
  WaitingForYouPanel,
} from './ClientDashboard.parts';

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
        const json = await api.get<any>(`/api/v1/projects/${pid}/client-portal`);
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
        const pj = await api.get<any>('/api/v1/projects');
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
          api.get<any>('/api/v1/me/approvals').catch(() => null),
          api.get<any>('/api/v1/me/invoices').catch(() => null),
          api.get<any>('/api/v1/fx-rates').catch(() => null),
        ]);
        if (cancelled) return;
        if (appr) {
          const j = appr;
          const d = j.data ?? j;
          setApprovals(Array.isArray(d) ? d : d?.items || d?.approvals || []);
        }
        if (inv) {
          const j = inv;
          const d = j.data ?? j;
          const list = Array.isArray(d) ? d : d?.invoices || [];
          setInvoices(list);
          const pi = d?.paymentInstructions ?? j.paymentInstructions ?? null;
          if (pi) setPaymentInstructions((prev: any) => prev ?? pi);
        }
        if (fx) {
          const j = fx;
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
          dot: 'bg-emerald-700',
          label: 'ON TRACK • Normal Alignment',
};
      case 'ATTENTION':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          dot: 'bg-amber-700',
          label: 'ATTENTION • Moderate Disparity',
};
      case 'ACTION_REQUIRED':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200',
          dot: 'bg-rose-700',
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
<ClientPortalNav view={view} setView={setView} />
      {view === 'sites' ? (
<ClientSitesView
          sites={sites}
          activeProjectId={projectData.id}
          onOpenSite={(siteId) => { void loadProject(siteId); setView('overview');}}
        />
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
<ClientHeaderBanner
        tenantName={user.tenant.name}
        projectName={projectData.name}
        projectLocation={projectData.location}
        ncaRegistration={projectData.ncaRegistration}
        projectId={projectData.id}
      />

      {/* Stage-2: "Waiting for you" — items needing client/owner attention */}
      {approvals.length > 0 && (
<WaitingForYouPanel approvals={approvals} />
)}

      {/* Stage-2: Invoices, balances, payment history & contractor payment instructions */}
<InvoicesPaymentsCard
        paymentInstructions={paymentInstructions}
        invoices={invoices}
        noticeSent={noticeSent}
        onNoticeSent={(id) => { setNoticeSent(id); setTimeout(() => setNoticeSent(null), 4000); }}
      />

      {/* 5 Plain-Language Financial Cards with Diaspora Multi-Currency Toggle */}
<FinancialSummarySection
        financials={financials}
        effectiveCurrency={effectiveCurrency}
        selectedCurrency={selectedCurrency}
        setSelectedCurrency={setSelectedCurrency}
        fxFeed={fxFeed}
        exchangeRates={exchangeRates}
        exchangeRateText={exchangeRates[effectiveCurrency].rate?.toFixed(2) ?? '0'}
        formatWithCurrency={formatWithCurrency}
      />

      {/* Neutral Project Health Guard Card (Milestone M9 & M7) */}
<ProjectHealthCard
        healthBadge={healthBadge}
        healthNotice={progress.healthNotice}
        physicalPctString={physicalPctString}
        budgetPctString={budgetPctString}
        varianceDeltaString={varianceDeltaString}
        varianceDelta={progress.varianceDelta}
      />

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
<CertifiedIpcsCard
        effectiveCurrency={effectiveCurrency}
        selectedCurrency={selectedCurrency}
        currencyLabel={exchangeRates[effectiveCurrency].label}
        financials={financials}
        progress={progress}
        paymentCertificates={paymentCertificates}
        hydrated={hydrated}
        formatWithCurrency={formatWithCurrency}
      />

      {/* Project Milestones Timeline & Kenyan Retention Terms */}
<MilestonesRetentionSection
        timeline={timeline}
        projectName={projectData.name}
        projectCode={projectData.code}
        ncaRegistration={projectData.ncaRegistration}
        retentionTerms={retentionTerms}
      />

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
