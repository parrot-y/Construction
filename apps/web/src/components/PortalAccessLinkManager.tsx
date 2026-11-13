import React, { useCallback, useEffect, useState } from 'react';
import { CopyWhatsAppButton } from '../ui';
import { PRODUCT_NAME } from '../lib/product';

export interface PortalLinkItem {
  id: string;
  portalType: 'CLIENT' | 'CONSULTANT' | 'SUBCONTRACTOR' | 'SUPPLIER' | 'COMPLIANCE';
  stakeholderName: string;
  stakeholderRole?: string;
  token?: string;
  linkUrl?: string;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
  lastUsedAt?: string | null;
  useCount?: number;
}

interface SubcontractorPackageOption {
  id: string;
  tradeCategory: string;
  firmName: string;
}

interface PortalAccessLinkManagerProps {
  projectId: string;
  onPreviewPortal?: (portalType: string, token: string, name: string, role?: string) => void;
}

export default function PortalAccessLinkManager({
  projectId = '',
  onPreviewPortal,
}: PortalAccessLinkManagerProps): React.JSX.Element {
  const [links, setLinks] = useState<PortalLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [portalType, setPortalType] = useState<'CLIENT' | 'CONSULTANT' | 'SUBCONTRACTOR' | 'SUPPLIER' | 'COMPLIANCE'>('CONSULTANT');
  const [stakeholderName, setStakeholderName] = useState('');
  const [stakeholderRole, setStakeholderRole] = useState('');
  const [subcontractorPackageId, setSubcontractorPackageId] = useState('');
  const [packages, setPackages] = useState<SubcontractorPackageOption[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const loadLinks = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/portals/links`, { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Failed to load portal links');
      setLinks(body.data || []);
    } catch (e: any) {
      setLoadError(e.message || 'Failed to load portal links');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  useEffect(() => {
    if (portalType !== 'SUBCONTRACTOR' || packages.length > 0 || !projectId) return;
    fetch(`/api/v1/projects/${projectId}/subcontractors`, { credentials: 'include' })
      .then((r) => r.json())
      .then((b) => setPackages((b.data || b || []).map((p: any) => ({ id: p.id, tradeCategory: p.trade_category || p.tradeCategory, firmName: p.firm_name || p.firmName }))))
      .catch(() => setPackages([]));
  }, [portalType, packages.length, projectId]);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stakeholderName.trim()) return;
    if (portalType === 'SUBCONTRACTOR' && !subcontractorPackageId) {
      setFeedback({ kind: 'err', text: 'Select the subcontractor work package this link is bound to.' });
      return;
    }

    setGenerating(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/portals/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          portalType,
          stakeholderName: stakeholderName.trim(),
          stakeholderRole: stakeholderRole.trim() || undefined,
          expiresInDays: 30,
          subcontractorPackageId: portalType === 'SUBCONTRACTOR' ? subcontractorPackageId : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Failed to create portal link');
      // Freshly created links carry the one-time token — keep it for Copy.
      setLinks((prev) => [{ ...body.data, token: body.data.token, linkUrl: body.data.linkUrl }, ...prev]);
      setFeedback({ kind: 'ok', text: `Link created for ${body.data.stakeholderName}. Copy it now — the token is shown only once.` });
      setShowModal(false);
      setStakeholderName('');
      setStakeholderRole('');
      setSubcontractorPackageId('');
    } catch (err: any) {
      setFeedback({ kind: 'err', text: err.message || 'Failed to create portal link' });
    } finally {
      setGenerating(false);
    }
  };

  const portalUrl = (link: PortalLinkItem) =>
    link.linkUrl
      ? `${window.location.origin}${link.linkUrl}`
      : `${window.location.origin}/?portal=${link.portalType.toLowerCase()}&token=${link.token}`;

  const handleCopy = (link: PortalLinkItem) => {
    // Canonical URL returned by the API at creation time.
    navigator.clipboard?.writeText(portalUrl(link));
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const whatsappMessage = (link: PortalLinkItem) =>
    `Hi ${link.stakeholderName}, here is your ${link.portalType.toLowerCase()} portal link${link.stakeholderRole ? ` for ${link.stakeholderRole}` : ''}: ${portalUrl(link)} — ${PRODUCT_NAME}`;

  const handleRegenerate = async (link: PortalLinkItem) => {
    setBusyId(link.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/portals/links/${link.id}/regenerate`, {
        method: 'POST', credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Regenerate failed');
      setLinks((prev) => [
        { ...body.data, token: body.data.token, linkUrl: body.data.linkUrl },
        ...prev.map((l) => (l.id === link.id ? { ...l, isActive: false } : l)),
      ]);
      setFeedback({ kind: 'ok', text: `New link generated for ${body.data.stakeholderName} — the previous token is revoked. Copy the new link now.` });
    } catch (err: any) {
      setFeedback({ kind: 'err', text: err.message || 'Regenerate failed' });
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (link: PortalLinkItem) => {
    setBusyId(link.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/portals/links/${link.id}`, {
        method: 'DELETE', credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Revoke failed');
      setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, isActive: false } : l)));
      setFeedback({ kind: 'ok', text: `Link for ${link.stakeholderName} revoked.` });
    } catch (err: any) {
      setFeedback({ kind: 'err', text: err.message || 'Revoke failed' });
    } finally {
      setBusyId(null);
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'CONSULTANT': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'SUBCONTRACTOR': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'SUPPLIER': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'COMPLIANCE': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never');

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4" data-testid="portal-link-manager">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">External Stakeholder Portals</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Share secure token links with architects, subcontractors, suppliers and regulators — no per-user seat needed.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3.5 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg shadow-sm transition"
          data-testid="generate-portal-link-btn"
        >
          + Generate Stakeholder Link
        </button>
      </div>

      {feedback && (
        <div className={`p-3 border text-xs rounded-lg flex justify-between items-center ${feedback.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="font-bold ml-2">×</button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500 py-6 text-center">Loading portal links…</p>
      ) : loadError ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex justify-between items-center">
          <span>{loadError}</span>
          <button onClick={loadLinks} className="font-semibold underline">Retry</button>
        </div>
      ) : links.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-lg">
          No portal links yet. Generate one to give an external stakeholder access to this project.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Portal</th>
                <th className="p-3">Stakeholder / Firm</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Last used</th>
                <th className="p-3">Uses</th>
                <th className="p-3">Expires</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {links.map((link) => (
                <tr key={link.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block ${getBadgeColor(link.portalType)}`}>
                      {link.portalType} PORTAL
                    </span>
                  </td>
                  <td className="p-3 font-semibold text-slate-900">{link.stakeholderName}</td>
                  <td className="p-3 text-slate-600">{link.stakeholderRole || '—'}</td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block ${link.isActive ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-500 bg-slate-100 border-slate-200'}`}>
                      {link.isActive ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">{fmt(link.lastUsedAt)}</td>
                  <td className="p-3 text-slate-600">{link.useCount ?? 0}</td>
                  <td className="p-3 text-slate-600">{fmt(link.expiresAt)}</td>
                  <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                    {link.token && link.isActive && (
                      <>
                        <button
                          onClick={() => handleCopy(link)}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
                        >
                          {copiedId === link.id ? 'Copied!' : 'Copy Link'}
                        </button>
                        <CopyWhatsAppButton message={whatsappMessage(link)} />
                      </>
                    )}
                    {link.isActive ? (
                      <>
                        <button
                          onClick={() => handleRegenerate(link)}
                          disabled={busyId === link.id}
                          className="px-2.5 py-1 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded transition disabled:opacity-50"
                        >
                          Regenerate
                        </button>
                        <button
                          onClick={() => handleRevoke(link)}
                          disabled={busyId === link.id}
                          className="px-2.5 py-1 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded transition disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleRegenerate(link)}
                        disabled={busyId === link.id}
                        className="px-2.5 py-1 text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded transition disabled:opacity-50"
                      >
                        Issue new link
                      </button>
                    )}
                    {onPreviewPortal && link.token && (
                      <button
                        onClick={() => onPreviewPortal(link.portalType, link.token!, link.stakeholderName, link.stakeholderRole)}
                        className="px-2.5 py-1 text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded transition"
                      >
                        Preview
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">Generate Portal Link</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">×</button>
            </div>
            <form onSubmit={handleCreateLink} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Portal type:</label>
                <select
                  value={portalType}
                  onChange={(e) => setPortalType(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="CONSULTANT">Consultant (Architect / Engineer)</option>
                  <option value="SUBCONTRACTOR">Subcontractor (trade package)</option>
                  <option value="SUPPLIER">Material Supplier</option>
                  <option value="COMPLIANCE">Compliance / NCA</option>
                  <option value="CLIENT">Client</option>
                </select>
              </div>
              {portalType === 'SUBCONTRACTOR' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work package (required):</label>
                  <select
                    value={subcontractorPackageId}
                    onChange={(e) => setSubcontractorPackageId(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    required
                  >
                    <option value="">Select package…</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>{p.tradeCategory} — {p.firmName}</option>
                    ))}
                  </select>
                  {packages.length === 0 && <p className="text-[11px] text-slate-500 mt-1">No subcontractor packages on this project yet.</p>}
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Stakeholder name / firm:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arch. Peter Mwangi / Bamburi Ready-Mix"
                  value={stakeholderName}
                  onChange={(e) => setStakeholderName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role / accreditation (optional):</label>
                <input
                  type="text"
                  placeholder="e.g. BORAQS A-742 / Plumbing & Drainage"
                  value={stakeholderRole}
                  onChange={(e) => setStakeholderRole(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                The token is shown once at creation. Existing links can be regenerated (old token revoked) or revoked.
              </p>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-3.5 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={generating} className="px-4 py-2 font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg disabled:opacity-50 transition">
                  {generating ? 'Generating…' : 'Create Access Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
