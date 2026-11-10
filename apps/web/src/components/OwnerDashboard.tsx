import React, { useEffect, useState } from 'react';
import { formatKes } from '../ui';
import { AuthSession } from '../types/auth';
import PhotoEvidenceGallery from './PhotoEvidenceGallery';

interface OwnerDashboardProps {
  session: AuthSession;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', SENT: 'Sent', VIEWED: 'Viewed', PART_PAID: 'Part paid',
  PAID: 'Paid', OVERDUE: 'Overdue', CANCELLED: 'Cancelled',
  SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under review', PM_REVIEW: 'Under review',
  OWNER_REVIEW: 'Waiting for your review', QS_EVALUATED: 'Evaluated',
  APPROVED: 'Approved', APPROVED_FOR_PAYMENT: 'Approved for payment',
  CERTIFIED: 'Certified', REJECTED: 'Rejected',
};

function plainStatus(s?: string): string {
  if (!s) return '—';
  return STATUS_LABELS[s] || s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Stage-2: dedicated, read-mostly OWNER dashboard — project summary,
 * approvals, certificates, invoices, progress and shared photos.
 * Owners read and acknowledge; they never create or certify.
 */
export default function OwnerDashboard({ session }: OwnerDashboardProps): React.JSX.Element {
  const { user } = session;
  const [project, setProject] = useState<any>(null);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const plist = await fetch('/api/v1/projects', { credentials: 'include' });
        if (!plist.ok) return;
        const pj = await plist.json();
        const list = pj.data || [];
        if (cancelled || list.length === 0) return;
        const pid = list[0].id;

        const [portal, appr, inv] = await Promise.all([
          fetch(`/api/v1/projects/${pid}/client-portal`, { credentials: 'include' }),
          fetch('/api/v1/me/approvals', { credentials: 'include' }),
          fetch('/api/v1/me/invoices', { credentials: 'include' }),
        ]);
        if (cancelled) return;

        if (portal.ok) {
          const j = await portal.json();
          const d = j.data || j;
          setProject(d);
          if (Array.isArray(d?.photo_evidence)) {
            setPhotos(d.photo_evidence.map((p: any) => ({
              id: p.id,
              caption: p.caption || 'Site photo',
              photo_url: p.photo_url || (p.storage_key ? `/uploads/${p.storage_key}` : ''),
              captured_at: p.captured_at || p.taken_at || '',
              recorded_by_name: p.recorded_by_name,
            })));
          }
        }
        if (appr.ok) {
          const j = await appr.json();
          const d = j.data ?? j;
          setApprovals(Array.isArray(d) ? d : d?.items || d?.approvals || []);
        }
        if (inv.ok) {
          const j = await inv.json();
          const d = j.data ?? j;
          setInvoices(Array.isArray(d) ? d : d?.invoices || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const f = project?.financials || {};
  const prog = project?.progress || {};
  const certs = project?.payment_certificates || [];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 pb-10">
      <header className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            Owner Portal — {user.tenant.name}
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-1">
            {project?.project?.name || 'Project overview'}
          </h2>
          <p className="text-xs text-slate-500">
            {project?.project?.location || ''} • Read-only oversight
          </p>
        </div>
        <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
          You review and acknowledge — the contractor manages delivery
        </span>
      </header>

      {approvals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
              Waiting for you
            </span>
            <span className="text-xs text-amber-800 font-semibold">
              {approvals.length} item{approvals.length === 1 ? '' : 's'} need your review
            </span>
          </div>
          <div className="space-y-1.5">
            {approvals.slice(0, 8).map((a: any, i: number) => (
              <div key={a.id || i} className="flex items-center justify-between gap-3 text-xs bg-white/70 border border-amber-100 rounded-lg px-3 py-2">
                <span className="font-semibold text-slate-800 truncate">{a.title || 'Item'}</span>
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold">
                  {plainStatus(a.status)}
                  {a.amount ? ` • ${formatKes(String(a.amount))}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Contract sum', f.original_agreed_budget],
          ['Certified to date', f.total_spent_to_date],
          ['Remaining balance', f.remaining_balance],
          ['Physical progress', prog.physical_progress_percentage != null ? `${Number(prog.physical_progress_percentage).toFixed(1)}%` : '—'],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 block">{label}</span>
            <span className="text-base font-bold font-mono text-slate-900 mt-1 block">
              {String(label).includes('progress') ? value : formatKes(String(value ?? '0'))}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Payment certificates</h3>
        {certs.length === 0 ? (
          <p className="text-xs text-slate-400">{loading ? 'Loading…' : 'No certificates issued yet.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                  <th className="py-2 px-3">Certificate</th>
                  <th className="py-2 px-3">Period</th>
                  <th className="py-2 px-3">Net payable</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {certs.map((c: any) => (
                  <tr key={c.id}>
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{c.certificate_no}</td>
                    <td className="py-2 px-3 text-slate-600">{c.period_start} → {c.period_end}</td>
                    <td className="py-2 px-3 font-mono">{formatKes(String(c.net_payable ?? '0'))}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${c.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-sky-100 text-sky-800 border-sky-300'}`}>
                        {plainStatus(c.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Invoices</h3>
        {invoices.length === 0 ? (
          <p className="text-xs text-slate-400">{loading ? 'Loading…' : 'No invoices yet.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                  <th className="py-2 px-3">Invoice</th>
                  <th className="py-2 px-3">Total</th>
                  <th className="py-2 px-3">Balance due</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.slice(0, 10).map((inv: any) => (
                  <tr key={inv.id}>
                    <td className="py-2 px-3 font-semibold text-slate-800">{inv.title || `Invoice #${inv.invoice_no ?? ''}`}</td>
                    <td className="py-2 px-3 font-mono">{formatKes(String(inv.total ?? '0'))}</td>
                    <td className="py-2 px-3 font-mono font-bold">{formatKes(String(inv.balance_due ?? inv.balanceDue ?? '0'))}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border bg-slate-100 text-slate-700 border-slate-300">
                        {plainStatus(inv.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PhotoEvidenceGallery photos={photos} />
    </div>
  );
}
