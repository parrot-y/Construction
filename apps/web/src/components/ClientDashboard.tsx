import React, { useState } from 'react';
import { toCurrencyString } from '@construction/money';
import { AuthSession } from '../types/auth';
import MilestoneTimeline, { TimelineItem } from './MilestoneTimeline';
import PhotoEvidenceGallery from './PhotoEvidenceGallery';
import { PhotoEvidenceItem } from './PhotoLightboxModal';
import VarianceMonitorCard from './VarianceMonitorCard';
import VariationManagementView from './VariationManagementView';
import PracticalCompletionCard from './PracticalCompletionCard';
import SnaggingListView from './SnaggingListView';
import IndependentSiteReportView from './IndependentSiteReportView';
import ContractorTenderBoardView from './ContractorTenderBoardView';

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

export default function ClientDashboard({
  session,
  projectData = {
    id: 'project-rcp-2026',
    name: 'Riverside Commercial Plaza',
    code: 'RCP-2026',
    location: 'Riverside Drive, Nairobi',
    ncaRegistration: 'NCA-PRJ-2026-0891',
    startDate: '2026-01-15',
    expectedCompletionDate: '2026-12-15',
  },
  financials = {
    originalAgreedBudget: '45000000.00',
    approvedVariationsTotal: '900000.00',
    currentApprovedBudget: '45900000.00',
    totalSpentToDate: '4500000.00',
    remainingBalance: '41400000.00',
    budgetUsedPercentage: 9.8,
  },
  progress = {
    physicalProgressPercentage: 12.0,
    varianceDelta: -2.2,
    healthStatus: 'ON_TRACK',
    healthNotice: 'Expenditure is aligned with recorded physical progress.',
  },
  photos,
  timeline,
}: ClientDashboardProps): React.JSX.Element {
  const { user } = session;

  type CurrencyCode = 'KES' | 'USD' | 'GBP' | 'EUR' | 'AED';
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('KES');

  const exchangeRates: Record<CurrencyCode, { rate: number; symbol: string; label: string }> = {
    KES: { rate: 1.0, symbol: 'KES', label: 'Kenyan Shilling' },
    USD: { rate: 129.50, symbol: '$', label: 'US Dollar' },
    GBP: { rate: 166.80, symbol: '£', label: 'British Pound' },
    EUR: { rate: 140.20, symbol: '€', label: 'Euro' },
    AED: { rate: 35.25, symbol: 'AED', label: 'UAE Dirham' },
  };

  const formatWithCurrency = (kesStr: string, isAddition = false): string => {
    if (selectedCurrency === 'KES') {
      return `${isAddition ? '+ ' : ''}KES ${toCurrencyString(kesStr)}`;
    }
    const num = parseFloat(kesStr);
    if (isNaN(num)) return `${exchangeRates[selectedCurrency].symbol} 0.00`;
    const converted = num / exchangeRates[selectedCurrency].rate;
    const formatted = converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${isAddition ? '+ ' : ''}${exchangeRates[selectedCurrency].symbol} ${formatted}`;
  };

  const originalBudgetFormatted = toCurrencyString(financials.originalAgreedBudget);
  const variationsTotalFormatted = toCurrencyString(financials.approvedVariationsTotal);
  const currentBudgetFormatted = toCurrencyString(financials.currentApprovedBudget);
  const totalSpentFormatted = toCurrencyString(financials.totalSpentToDate);
  const remainingBalanceFormatted = toCurrencyString(financials.remainingBalance);

  // Kenyan standard 5% retention cap of contract sum
  const retentionCap = toCurrencyString('2250000.00');

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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Client / Property Developer Portal
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Project Visibility & Progress Verification</h2>
          <p className="text-xs text-slate-500">
            Real-time verified site progress, certified expenditure, and valuation certificates for {user.tenant.name}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">{projectData.name}</span>
            <span>•</span>
            <span className="font-mono text-slate-500">{projectData.location}</span>
            <span>•</span>
            <span className="font-mono text-slate-500">NCA: {projectData.ncaRegistration}</span>
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

      {/* 5 Plain-Language Financial Cards with Diaspora Multi-Currency Toggle */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-1 gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Financial Summary & Budget Control</h3>
            <p className="text-[11px] text-slate-500">
              {selectedCurrency === 'KES'
                ? 'Base contract currency: Kenyan Shilling (KES)'
                : `Diaspora converted estimate: 1 ${selectedCurrency} ≈ ${exchangeRates[selectedCurrency].rate.toFixed(2)} KES • Official valuation in KES`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <span className="text-[10px] font-semibold text-slate-500 uppercase px-1">Diaspora View:</span>
            {(['KES', 'USD', 'GBP', 'EUR', 'AED'] as CurrencyCode[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCurrency(c)}
                data-testid={`currency-toggle-${c.toLowerCase()}`}
                className={`px-2 py-0.5 text-xs font-bold rounded transition ${
                  selectedCurrency === c
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Card 1: Original Agreed Budget */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Original Agreed Budget
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-1 block">
              {formatWithCurrency(financials.originalAgreedBudget)}
            </span>
            {selectedCurrency !== 'KES' ? (
              <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                Base: KES {originalBudgetFormatted}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 mt-0.5 block">Approved Contract Sum</span>
            )}
          </div>

          {/* Card 2: Approved Variations Total */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Approved Variations Total
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-blue-700 mt-1 block">
              {formatWithCurrency(financials.approvedVariationsTotal, true)}
            </span>
            {selectedCurrency !== 'KES' ? (
              <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                Base: KES {variationsTotalFormatted}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 mt-0.5 block">Net approved scope changes</span>
            )}
          </div>

          {/* Card 3: Current Approved Budget */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Current Approved Budget
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-1 block">
              {formatWithCurrency(financials.currentApprovedBudget)}
            </span>
            {selectedCurrency !== 'KES' ? (
              <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                Base: KES {currentBudgetFormatted}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 mt-0.5 block">Baseline + Variations</span>
            )}
          </div>

          {/* Card 4: Total Spent to Date */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Spent to Date
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-emerald-700 mt-1 block">
              {formatWithCurrency(financials.totalSpentToDate)}
            </span>
            {selectedCurrency !== 'KES' ? (
              <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                Base: KES {totalSpentFormatted}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 mt-0.5 block">Total Certified Cost</span>
            )}
          </div>

          {/* Card 5: Remaining Balance */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 md:col-span-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Remaining Balance
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-1 block">
              {formatWithCurrency(financials.remainingBalance)}
            </span>
            {selectedCurrency !== 'KES' ? (
              <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                Base: KES {remainingBalanceFormatted}
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
              <span className="font-bold text-slate-900 font-mono">
                {`${financials.budgetUsedPercentage.toFixed(1)}% Consumed`}
              </span>
            </div>
            <span className="text-slate-500 font-mono text-[11px]">
              KES {totalSpentFormatted} of KES {currentBudgetFormatted}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
            <div
              className="bg-emerald-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, financials.budgetUsedPercentage))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Neutral Project Health Guard Card (Milestone M9 & M7) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
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
          <span className="text-base">📋</span>
          <div>
            <span className="font-semibold text-slate-900 block">Factual Status Notice:</span>
            <p className="mt-0.5 text-slate-600">{progress.healthNotice}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1 text-center">
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Physical Progress
            </span>
            <span className="text-lg font-bold text-emerald-700 mt-0.5 block">
              {physicalPctString}
            </span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Budget Consumed
            </span>
            <span className="text-lg font-bold text-slate-800 mt-0.5 block">
              {budgetPctString}
            </span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Variance Delta
            </span>
            <span
              className={`text-lg font-bold font-mono mt-0.5 block ${
                progress.varianceDelta > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {varianceDeltaString}
            </span>
          </div>
        </div>
      </div>

      {/* Variance Monitor & Neutral Health Guard (Milestone M7) */}
      <VarianceMonitorCard projectName={projectData.name} />

      {/* Certified IPCs & Valuation Payments Schedule (Diaspora Multi-Currency Converted) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                Certified Valuations Ledger
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Currency: {selectedCurrency} ({exchangeRates[selectedCurrency].label})
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
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Net Paid to Date</span>
            <span className="text-base font-mono font-bold text-emerald-700">
              {formatWithCurrency('4050000.00')}
            </span>
            <span className="text-[10px] text-slate-400 block">Gross Certified: {formatWithCurrency(financials.totalSpentToDate)}</span>
          </div>
        </div>

        {/* Dynamic Multi-Currency Valuation Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-slate-500 text-[10px] uppercase font-semibold block">Total Contract Sum:</span>
            <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">
              {formatWithCurrency(financials.originalAgreedBudget)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Base: KES {originalBudgetFormatted}</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-slate-500 text-[10px] uppercase font-semibold block">Gross Certified IPCs:</span>
            <span className="text-sm font-bold font-mono text-emerald-700 mt-0.5 block">
              {formatWithCurrency(financials.totalSpentToDate)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Base: KES {totalSpentFormatted}</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-slate-500 text-[10px] uppercase font-semibold block">Net Payments Disbursed:</span>
            <span className="text-sm font-bold font-mono text-blue-700 mt-0.5 block">
              {formatWithCurrency('4050000.00')}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">90% of Gross Certified</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-slate-500 text-[10px] uppercase font-semibold block">Monetary Progress Variance:</span>
            <span className="text-sm font-bold font-mono text-emerald-700 mt-0.5 block">
              {formatWithCurrency('1008000.00')} Favorable
            </span>
            <span className="text-[10px] text-emerald-600 font-medium">Under baseline estimate</span>
          </div>
        </div>

        {/* Certified IPCs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-600">
                <th className="py-2.5 px-3">Certificate Ref</th>
                <th className="py-2.5 px-3">Milestone Scope</th>
                <th className="py-2.5 px-3">Date Certified</th>
                <th className="py-2.5 px-3">Gross Certified ({selectedCurrency})</th>
                <th className="py-2.5 px-3">10% Retention ({selectedCurrency})</th>
                <th className="py-2.5 px-3">Net Payment ({selectedCurrency})</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/60">
                <td className="py-2.5 px-3 font-mono font-bold text-slate-800">IPC #01</td>
                <td className="py-2.5 px-3 text-slate-700">Substructure &amp; Foundation Excavation</td>
                <td className="py-2.5 px-3 text-slate-500 font-mono">2026-02-28</td>
                <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{formatWithCurrency('2500000.00')}</td>
                <td className="py-2.5 px-3 font-mono text-amber-700">{formatWithCurrency('250000.00')}</td>
                <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">{formatWithCurrency('2250000.00')}</td>
                <td className="py-2.5 px-3 text-right">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Paid
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/60">
                <td className="py-2.5 px-3 font-mono font-bold text-slate-800">IPC #02</td>
                <td className="py-2.5 px-3 text-slate-700">Ground Floor Columns &amp; Ring Beam</td>
                <td className="py-2.5 px-3 text-slate-500 font-mono">2026-03-31</td>
                <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{formatWithCurrency('2000000.00')}</td>
                <td className="py-2.5 px-3 font-mono text-amber-700">{formatWithCurrency('200000.00')}</td>
                <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">{formatWithCurrency('1800000.00')}</td>
                <td className="py-2.5 px-3 text-right">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Paid
                  </span>
                </td>
              </tr>
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
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
              Statutory Protection
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-1">Contract Retention Terms (Kenyan Standard)</h3>
            <p className="text-xs text-slate-500">EASMM & Kenyan standard contract rules enforced</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <span className="text-slate-500 block text-[11px]">Interim Certificate Deduction:</span>
              <span className="font-bold text-slate-800 text-sm">10% of Gross Certified Work</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <span className="text-slate-500 block text-[11px]">Maximum Retention Fund Cap:</span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                KES {retentionCap} (5% of Contract Sum)
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <span className="text-slate-500 block text-[11px]">Release Milestones:</span>
              <span className="font-medium text-slate-700 block">
                • 50% released at Practical Completion (Section Handover)<br />
                • 50% released at end of Defects Liability Period (DLP)
              </span>
            </div>
          </div>
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

      {/* Platform Contractor Tender Board & Bidding Interface (Milestone M33) */}
      <ContractorTenderBoardView
        projectId={projectData.id}
        projectName={projectData.name}
        userRole="CLIENT"
      />
    </div>
  );
}
