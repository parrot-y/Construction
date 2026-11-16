import React, { useEffect, useState } from 'react';
import { formatKes, ResponsiveTable } from '../ui';
import { AuthSession } from '../types/auth';
import PhotoEvidenceGallery from './PhotoEvidenceGallery';
import VariationManagementView from './VariationManagementView';

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
  const [projectId, setProjectId] = useState('');
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
        setProjectId(pid);

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

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
            Approvals
          </span>
          <span className="text-xs text-amber-800 font-semibold">
            {approvals.length > 0
              ? `${approvals.length} item${approvals.length === 1 ? '' : 's'} awaiting your review`
              : 'Nothing awaiting your review right now'}
          </span>
        </div>
        {approvals.length > 0 && (
          <div className="space-y-1.5">
            {approvals.slice(0, 8).map((a: any, i: number) => (
              <div key={a.id || i} className="text-xs bg-white/70 border border-amber-100 rounded-lg px-3 py-2 space-y-1.5">
                <p className="font-semibold text-slate-800 break-words" data-testid="owner-approval-title">{a.title || 'Item'}</p>
                <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold">
                  {plainStatus(a.status)}
                  {a.amount ? ` • ${formatKes(String(a.amount))}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {projectId && (
        <VariationManagementView
          projectId={projectId}
          userRole="OWNER"
          canRequest={false}
          canReview={true}
          canApprove={true}
        />
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
            <span className="text-base font-bold tabular-nums text-slate-900 mt-1 block">
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
          <ResponsiveTable
            head={['Certificate', 'Period', 'Net payable', 'Status']}
            className="border-collapse text-xs"
            empty="No certificates issued yet."
            rows={certs.map((c: any) => ({
              key: c.id,
              cells: [
                { content: c.certificate_no, className: 'font-mono tabular-nums font-bold text-slate-800' },
                { content: `${c.period_start} → ${c.period_end}`, className: 'text-slate-600' },
                { content: formatKes(String(c.net_payable ?? '0')), className: 'font-mono tabular-nums' },
                {
                  content: (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${c.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-sky-100 text-sky-800 border-sky-300'}`}>
                      {plainStatus(c.status)}
</span>
                  ),
                },
              ],
            }))}
          />
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Invoices</h3>
        {invoices.length === 0 ? (
          <p className="text-xs text-slate-400">{loading ? 'Loading…' : 'No invoices yet.'}</p>
        ) : (
          <ResponsiveTable
            head={['Invoice', 'Total', 'Balance due', 'Status']}
            className="border-collapse text-xs"
            empty="No invoices yet."
            rows={invoices.slice(0, 10).map((inv: any) => ({
              key: inv.id,
              cells: [
                { content: inv.title || `Invoice #${inv.invoice_no ?? ''}`, className: 'font-semibold text-slate-800' },
                { content: formatKes(String(inv.total ?? '0')), className: 'font-mono tabular-nums' },
                { content: formatKes(String(inv.balance_due ?? inv.balanceDue ?? '0')), className: 'font-mono tabular-nums font-bold' },
                {
                  content: (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border bg-slate-100 text-slate-700 border-slate-300">
                      {plainStatus(inv.status)}
</span>
                  ),
                },
              ],
            }))}
          />
        )}
      </div>

      <PhotoEvidenceGallery photos={photos} />
    </div>
  );
}
