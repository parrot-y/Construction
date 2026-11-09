import React from 'react';
import { formatKes } from '../ui';

export interface PracticalCompletionCardProps {
  projectName?: string;
  projectCode?: string;
  contractSum?: string | number;
  retentionRate?: number; // Kenyan standard 5% cap
  practicalCompletionDate?: string;
  dlpDurationMonths?: number;
  dlpDaysRemaining?: number;
  dlpExpiryDate?: string;
  architectName?: string;
  architectBoraqsNo?: string;
  qsName?: string;
  qsBoraqsNo?: string;
  firstMoietyReleased?: boolean;
  firstMoietyAmount?: string | number;
  secondMoietyStatus?: 'HELD_IN_ESCROW' | 'RELEASED' | 'PENDING_INSPECTION';
  secondMoietyAmount?: string | number;
}

export default function PracticalCompletionCard({
  projectName = '',
  projectCode = '',
  contractSum,
  retentionRate = 0.05,
  practicalCompletionDate,
  dlpDurationMonths = 6,
  dlpDaysRemaining,
  dlpExpiryDate,
  architectName,
  architectBoraqsNo,
  qsName,
  qsBoraqsNo,
  firstMoietyReleased,
  firstMoietyAmount,
  secondMoietyStatus,
  secondMoietyAmount,
}: PracticalCompletionCardProps): React.JSX.Element {

  // DLP duration 6 months ≈ 182 days — only when real DLP data is supplied
  const totalDlpDays = (dlpDurationMonths ?? 6) * 30.5;
  const dlpProgressPct = dlpDaysRemaining != null
    ? Math.min(100, Math.round(((totalDlpDays - dlpDaysRemaining) / totalDlpDays) * 100))
    : null;

  return (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
      {/* Header */}
<div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
<div>
<div className="flex items-center gap-2">
<span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Project Closeout & Statutory Handover
</span>
<span className="text-xs text-slate-400 font-mono">BORAQS Standard</span>
</div>
<h3 className="text-lg font-bold text-slate-900 mt-1">
            Practical Completion & Retention Release Card
</h3>
<p className="text-xs text-slate-500">
            Certificate of Practical Completion, First Moiety release, 6-Month DLP countdown, and Second Moiety escrow
</p>
</div>

<div className="flex items-center gap-2">
<span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
<span>PRACTICAL COMPLETION ACHIEVED</span>
</span>
</div>
</div>

<div className="p-5 space-y-6">
        {/* SECTION 1: CERTIFICATE OF PRACTICAL COMPLETION & PROFESSIONAL DETAILS */}
<div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-4 sm:p-5 space-y-3">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div>
<span className="text-[10px] font-bold text-emerald-800 block">
                Official Statutory Certificate
</span>
<h4 className="text-base font-bold text-slate-900 mt-0.5">
                Certificate of Practical Completion
</h4>
</div>
<div className="flex items-center gap-2">
<span className="px-2.5 py-0.5 bg-emerald-700 text-white text-[11px] font-bold rounded">
                ISSUED
</span>
<span className="text-xs font-mono font-medium text-slate-600">
                {`Date: ${practicalCompletionDate ?? '—'}`}
</span>
</div>
</div>

<p className="text-xs text-slate-700 leading-relaxed font-sans">
            The Lead Consultant Architect and Quantity Surveyor certify that the Works for{' '}
<span className="font-semibold text-slate-900">{projectName || '—'} ({projectCode || '—'})</span> have
            reached Practical Completion in accordance with the Contract conditions and are fit for
            beneficial occupation by the Client.
</p>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-100 text-xs">
<div className="p-3 bg-white rounded-lg border border-emerald-100 flex items-start gap-2.5">
<span className="text-lg"></span>
<div>
<span className="text-[10px] font-semibold text-slate-400 block">
                  Lead Consultant Architect
</span>
<span className="font-bold text-slate-900 block">{architectName ?? '—'}</span>
<span className="text-[11px] font-mono text-emerald-800 font-semibold">
                  {architectBoraqsNo ? `BORAQS Reg. No. ${architectBoraqsNo}` : '—'}
</span>
</div>
</div>

<div className="p-3 bg-white rounded-lg border border-emerald-100 flex items-start gap-2.5">
<span className="text-lg"></span>
<div>
<span className="text-[10px] font-semibold text-slate-400 block">
                  Lead Quantity Surveyor
</span>
<span className="font-bold text-slate-900 block">{qsName ?? '—'}</span>
<span className="text-[11px] font-mono text-emerald-800 font-semibold">
                  {qsBoraqsNo ? `BORAQS Reg. No. ${qsBoraqsNo}` : '—'}
</span>
</div>
</div>
</div>
</div>

        {/* SECTION 2: RETENTION RELEASE SPLIT (FIRST & SECOND MOIETY) */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* First Moiety Card */}
<div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 relative overflow-hidden">
<div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none" />
<div className="flex justify-between items-start">
<div>
<span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  First Moiety (50%)
</span>
<h5 className="text-sm font-bold text-slate-900 mt-1">
                  Practical Completion Retention Release
</h5>
</div>
<span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-200">
                {firstMoietyReleased == null ? '—' : firstMoietyReleased ? 'RELEASED' : 'PENDING'}
</span>
</div>

<div className="space-y-1">
<span className="text-2xl font-bold font-mono text-emerald-700 block">
                {formatKes(firstMoietyAmount)}
</span>
<span className="text-[11px] text-slate-500 block">
                50% of total {'—'} retention fund ({(retentionRate * 100).toFixed(0)}% of {formatKes(contractSum)} contract sum)
</span>
</div>

<div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
<div className="flex justify-between">
<span>Release Status:</span>
<span className="font-semibold text-emerald-700">
                  {firstMoietyReleased == null ? '—' : firstMoietyReleased ? 'Released to Contractor ' : 'Pending Certification'}
</span>
</div>
<div className="flex justify-between">
<span>Payment Certificate:</span>
<span className="font-mono text-slate-800">IPC #10-FIN-RET1</span>
</div>
</div>
</div>

          {/* Second Moiety Card */}
<div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 relative overflow-hidden">
<div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none" />
<div className="flex justify-between items-start">
<div>
<span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  Second Moiety (Final 50%)
</span>
<h5 className="text-sm font-bold text-slate-900 mt-1">
                  Defects Liability Escrow Fund
</h5>
</div>
<span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full border border-amber-200">
                {secondMoietyStatus === 'HELD_IN_ESCROW'
                  ? 'HELD IN ESCROW'
                  : secondMoietyStatus === 'RELEASED'
                  ? 'RELEASED'
                  : 'PENDING INSPECTION'}
</span>
</div>

<div className="space-y-1">
<span className="text-2xl font-bold font-mono text-slate-800 block">
                {formatKes(secondMoietyAmount)}
</span>
<span className="text-[11px] text-slate-500 block">
                Final 50% release conditioned upon Certificate of Making Good Defects
</span>
</div>

<div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
<div className="flex justify-between">
<span>Release Condition:</span>
<span className="font-semibold text-amber-800">End of 6-Month DLP Period</span>
</div>
<div className="flex justify-between">
<span>Target Release Date:</span>
<span className="font-mono text-slate-800">{dlpExpiryDate ?? '—'}</span>
</div>
</div>
</div>
</div>

        {/* SECTION 3: 6-MONTH DEFECTS LIABILITY PERIOD (DLP) COUNTDOWN */}
<div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div>
<span className="text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                Contractual Warranty Window
</span>
<h4 className="text-base font-bold text-slate-900 mt-1">
                6-Month Defects Liability Period (DLP) Countdown
</h4>
</div>

<div className="text-right">
<span className="text-xl font-mono font-bold text-purple-900 block">
                {dlpDaysRemaining != null ? `${dlpDaysRemaining} Days Remaining` : '—'}
</span>
<span className="text-[11px] text-slate-500 font-mono block">
                {dlpExpiryDate ? `Expires ${dlpExpiryDate}` : '—'}
</span>
</div>
</div>

          {/* Progress Bar */}
<div className="space-y-1.5">
<div className="flex justify-between text-[11px] font-mono text-slate-600">
<span>Practical Completion ({practicalCompletionDate ?? '—'})</span>
<span>{dlpProgressPct != null ? `${dlpProgressPct}% Elapsed` : '—'}</span>
<span>DLP Expiry ({dlpExpiryDate ?? '—'})</span>
</div>
<div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden border border-slate-300">
<div
                className="bg-purple-600 h-full rounded-full transition-all"
                style={{ width: `${dlpProgressPct ?? 0}%`}}
              />
</div>
</div>

<div className="p-3 bg-white rounded-lg border border-purple-100 text-xs text-slate-700 flex items-start gap-2.5">
<span className="text-base"></span>
<div>
<span className="font-semibold text-slate-900 block">
                Contractor Statutory Obligation:
</span>
<p className="mt-0.5 text-slate-600 leading-relaxed">
                During this 6-month period, the main contractor is contractually obliged under
                Kenyan standard Joint Building Council (JBC) terms to rectify any patent or latent defects
                noted by the Architect or Client at zero additional cost.
</p>
</div>
</div>
</div>

        {/* SECTION 4: CERTIFICATE OF MAKING GOOD DEFECTS */}
<div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
<div>
<span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                Final Closeout Certificate
</span>
<h4 className="text-base font-bold text-slate-900 mt-1">
                Certificate of Making Good Defects
</h4>
</div>
<span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-xs font-semibold">
              {secondMoietyStatus ? 'PENDING FINAL INSPECTION' : '—'}
</span>
</div>

<p className="text-xs text-slate-600 leading-relaxed">
            Joint final inspection scheduled for{' '}
<span className="font-semibold text-slate-900">{dlpExpiryDate ?? '—'}</span>. Upon sign-off of
            this certificate, the final 50% Second Moiety ({formatKes(secondMoietyAmount)}) will be released
            and the Final Account settled.
</p>

<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
<div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[10px] text-slate-400 font-semibold block">
                Final Inspection Date
</span>
<span className="font-mono font-bold text-slate-800 mt-0.5 block">{dlpExpiryDate ?? '—'}</span>
</div>
<div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[10px] text-slate-400 font-semibold block">
                Final Retention Release
</span>
<span className="font-mono font-bold text-emerald-700 mt-0.5 block">
                {formatKes(secondMoietyAmount)}
</span>
</div>
<div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
<span className="text-[10px] text-slate-400 font-semibold block">
                Final Account Status
</span>
<span className="font-bold text-slate-700 mt-0.5 block">In Preparation</span>
</div>
</div>
</div>
</div>
</div>
);
}
