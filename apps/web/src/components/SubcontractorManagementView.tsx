import React, { useEffect, useState} from 'react';
import { formatKes } from '../ui';
import { api, apiErrorMessage } from '../lib/api';

export interface SubcontractorPackage {
  id: string;
  firm_name: string;
  trade_category: string;
  contact_person?: string | null;
  phone_number?: string | null;
  subcontract_sum: string | number;
  retention_rate_pct: string | number;
  scope_description?: string | null;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'COMPLETED' | 'TERMINATED';
  awarded_date?: string | null;
  created_at: string;
  contractor_id?: string | null;
  contractorId?: string | null;
  contractorFirmName?: string | null;
  contractorKraPin?: string | null;
}

interface ContractorFirmOption {
  id: string;
  firmName: string;
  kraPin?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  workCategories?: string[];
}

interface SubcontractorManagementViewProps {
  projectId: string;
  canAward?: boolean;
  initialPackages?: SubcontractorPackage[];
  onPackageAwarded?: (pkg: Partial<SubcontractorPackage>) => void;
  onStatusChanged?: (packageId: string, status: SubcontractorPackage['status']) => void;
}

export default function SubcontractorManagementView({
  projectId,
  canAward = true,
  initialPackages = [],
  onPackageAwarded,
  onStatusChanged,
}: SubcontractorManagementViewProps) {
  const [packages, setPackages] = useState<SubcontractorPackage[]>(initialPackages);
  const [tradeFilter, setTradeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState<boolean>(false);

  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const json = await api.get<any>(`/api/v1/projects/${projectId}/subcontractors`);
      const list = (json.packages || []) as any[];
      setPackages(list.map((p) => ({
        ...p,
        subcontract_sum: p.subcontract_sum?.toString?.() ?? String(p.subcontract_sum ?? 0),
        retention_rate_pct: p.retention_rate_pct?.toString?.() ?? String(p.retention_rate_pct ?? 0),
        awarded_date: p.awarded_date ?? null,
        status: (p.status === 'AWARDED' ? 'PENDING' : p.status) as SubcontractorPackage['status'],
})));
} catch {
      setPackages([]);
} finally {
      setLiveLoaded(true);
}
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);

  // Form State
  const [newFirmName, setNewFirmName] = useState<string>('');
  const [newTradeCategory, setNewTradeCategory] = useState<string>('PLUMBING');
  const [newContactPerson, setNewContactPerson] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newSum, setNewSum] = useState<string>('1500000.00');
  const [newRetention, setNewRetention] = useState<string>('5.00');
  const [newScope, setNewScope] = useState<string>('');
  const [contractors, setContractors] = useState<ContractorFirmOption[]>([]);
  const [selectedContractorId, setSelectedContractorId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // CB5 — approved firms from the contractor master can be linked to a
  // package; picking one prefills the firm details.
  useEffect(() => {
    if (!isLive) return;
    void (async () => {
      try {
        const json = await api.get<{ contractors: ContractorFirmOption[] }>(`/api/v1/contractors?status=APPROVED&limit=200`);
        setContractors(json.contractors ?? []);
      } catch { /* register optional — free-text firm entry still works */ }
    })();
  }, [isLive]);

  const pickContractor = (id: string) => {
    setSelectedContractorId(id);
    const firm = contractors.find((c) => c.id === id);
    if (firm) {
      setNewFirmName(firm.firmName);
      setNewContactPerson(firm.contactPerson ?? '');
      setNewPhone(firm.phone ?? '');
    }
  };

  const filtered = packages.filter((p) => {
    const matchesTrade = tradeFilter === 'ALL' || p.trade_category === tradeFilter;
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesTrade && matchesStatus;
});

  const totalCommitmentKes = packages.reduce(
    (sum, p) => sum + (Number(p.subcontract_sum) || 0),
    0
);
  const activeCount = packages.filter((p) => p.status === 'ACTIVE').length;

  const handleAwardPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!newFirmName.trim() || !newSum) return;
    setSaving(true);
    setFormError(null);

    const created: SubcontractorPackage = {
      id: `sub-${Date.now()}`,
      firm_name: newFirmName.trim(),
      trade_category: newTradeCategory,
      contact_person: newContactPerson.trim() || null,
      phone_number: newPhone.trim() || null,
      subcontract_sum: newSum,
      retention_rate_pct: newRetention,
      scope_description: newScope.trim() || null,
      status: 'ACTIVE',
      awarded_date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
};

    if (isLive) {
      try {
        await api.post(`/api/v1/projects/${projectId}/subcontractors`, {
          tradeCategory: created.trade_category,
          firmName: created.firm_name,
          contactPerson: created.contact_person,
          phoneNumber: created.phone_number,
          subcontractSum: String(created.subcontract_sum),
          retentionRatePct: String(created.retention_rate_pct),
          status: 'ACTIVE',
          scopeDescription: created.scope_description,
          contractorId: selectedContractorId || null,
});
        await reload();
        setShowModal(false);
        setNewFirmName('');
        setNewContactPerson('');
        setNewPhone('');
        setNewSum('1500000.00');
        setNewScope('');
        setSelectedContractorId('');
        if (onPackageAwarded) onPackageAwarded(created);
      } catch (err) {
        // Server rejections and transport failures both surface honestly —
        // the modal stays open with the entered data intact.
        setFormError(apiErrorMessage(err, 'Failed to award subcontract package'));
      } finally {
        setSaving(false);
      }
      return;
}

    setPackages([...packages, created]);
    if (onPackageAwarded) onPackageAwarded(created);
    setShowModal(false);
    setNewFirmName('');
    setNewContactPerson('');
    setNewPhone('');
    setNewSum('1500000.00');
    setNewScope('');
    setSaving(false);
};

  const handleStatusUpdate = (packageId: string, status: SubcontractorPackage['status']) => {
    if (isLive) {
      void (async () => {
        try {
          await api.patch(`/api/v1/projects/${projectId}/subcontractors/${packageId}`, { status: status === 'PENDING' ? 'AWARDED' : status});
          await reload();
} catch { /* ignore */}
})();
      return;
}
    setPackages(
      packages.map((p) => (p.id === packageId ? { ...p, status} : p))
);
    if (onStatusChanged) onStatusChanged(packageId, status);
};

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading subcontractor packages...</div>;
}

  const getStatusBadge = (status: SubcontractorPackage['status']) => {
    switch (status) {
      case 'ACTIVE':
        return<span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">Active</span>;
      case 'COMPLETED':
        return<span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">Completed</span>;
      case 'SUSPENDED':
        return<span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">Suspended</span>;
      case 'TERMINATED':
        return<span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">Terminated</span>;
      default:
        return<span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">Pending</span>;
}
};

  return (
<div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" data-testid="subcontractor-management-view" data-project-id={projectId}>
      {/* Header & KPI Summary */}
<div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
<div>
<div className="flex items-center gap-2">
<span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                TRADE PACKAGES
</span>
<h2 className="text-xl font-bold text-slate-900">Subcontractor Work Packages &amp; Directory</h2>
</div>
<p className="text-sm text-slate-500 mt-1">
              Trade contracts, Kenyan JBC statutory retention terms, and trade crew accountability.
</p>
</div>
          {canAward && (
<button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-amber-600 hover:bg-amber-700 shadow-sm"
            >
               Award Subcontract Package
</button>
)}
</div>

        {/* 3 Metric Cards */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
<div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs">
<span className="text-xs text-slate-500 font-medium">Total Subcontract Commitments</span>
<div className="mt-1 flex items-baseline gap-2">
<span className="text-2xl font-bold text-slate-900">
                {formatKes(totalCommitmentKes)}
</span>
</div>
<div className="text-xs text-slate-500 mt-2">
              Legally committed under contract
</div>
</div>

<div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs">
<span className="text-xs text-slate-500 font-medium">Active Trade Contractors</span>
<div className="mt-1 flex items-baseline gap-2">
<span className="text-2xl font-bold text-emerald-600">{activeCount}</span>
<span className="text-xs text-slate-400">firms on site</span>
</div>
<div className="text-xs text-slate-500 mt-2">
              Executing specialized trade works
</div>
</div>

<div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs">
<span className="text-xs text-slate-500 font-medium">Total Subcontract Packages</span>
<div className="mt-1 flex items-baseline gap-2">
<span className="text-2xl font-bold text-slate-900">{packages.length}</span>
<span className="text-xs text-slate-400">packages</span>
</div>
<div className="text-xs text-slate-500 mt-2">
              Plumbing, Electrical, Steel, etc.
</div>
</div>
</div>
</div>

      {/* Filter Bar */}
<div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center gap-3">
<div className="flex items-center gap-2">
<label className="text-xs font-semibold text-slate-600 ">Trade:</label>
<select
            value={tradeFilter}
            onChange={(e) => setTradeFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-700"
          >
<option value="ALL">All Trade Categories</option>
<option value="PLUMBING">Plumbing &amp; Sanitary</option>
<option value="ELECTRICAL">Electrical Works</option>
<option value="HVAC">HVAC &amp; Ventilation</option>
<option value="STEEL_FABRICATION">Structural Steel Fabrication</option>
<option value="ROOFING">Roofing Specialists</option>
<option value="PAINTING">Painting &amp; Decorating</option>
<option value="TILING">Tiling &amp; Terrazzo</option>
<option value="MASONRY">Specialist Masonry</option>
<option value="CARPENTRY">Joinery &amp; Cabinetry</option>
<option value="GLAZING">Aluminium &amp; Glazing</option>
<option value="OTHER">Other Trades</option>
</select>
</div>

<div className="flex items-center gap-2">
<label className="text-xs font-semibold text-slate-600 ">Status:</label>
<select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-700"
          >
<option value="ALL">All Statuses</option>
<option value="PENDING">Pending Award</option>
<option value="ACTIVE">Active</option>
<option value="SUSPENDED">Suspended</option>
<option value="COMPLETED">Completed</option>
<option value="TERMINATED">Terminated</option>
</select>
</div>
</div>

      {/* Subcontractor Cards */}
<div className="divide-y divide-slate-100">
        {filtered.length === 0 ? (
<div className="p-8 text-center text-slate-500 text-sm">
            No subcontractor packages found matching the selected filters.
</div>
) : (
          filtered.map((pkg) => (
<div key={pkg.id} className="p-5 hover:bg-slate-50 transition-colors">
<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
<div className="flex-1 min-w-0">
<div className="flex items-center gap-2 mb-1">
<span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800">
                      {pkg.trade_category.replace('_', ' ')}
</span>
                    {getStatusBadge(pkg.status)}
                    {pkg.awarded_date && (
<span className="text-xs text-slate-400">
                        • Awarded: {pkg.awarded_date}
</span>
)}
{(pkg.contractorKraPin || pkg.contractorFirmName) && (
<span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-800" data-testid={`pkg-contractor-link-${pkg.id}`}>
                        Master: {pkg.contractorKraPin || pkg.contractorFirmName}
</span>
)}
</div>

<h4 className="text-base font-bold text-slate-900 mb-1">
                    {pkg.firm_name}
</h4>

                  {pkg.scope_description && (
<p className="text-xs text-slate-600 mb-2">
                      {pkg.scope_description}
</p>
)}

<div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    {pkg.contact_person && (
<span>
<strong className="text-slate-700">Contact:</strong> {pkg.contact_person}
</span>
)}
                    {pkg.phone_number && (
<span>
<strong className="text-slate-700">Phone:</strong> {pkg.phone_number}
</span>
)}
<span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">
                       Retention Rate: {pkg.retention_rate_pct}%
</span>
</div>
</div>

                {/* Subcontract Sum & Action */}
<div className="lg:w-60 flex flex-col items-start lg:items-end justify-center">
<span className="text-xs text-slate-400">Subcontract Sum</span>
<span className="text-lg font-bold text-slate-900 tabular-nums">
                    {formatKes(pkg.subcontract_sum)}
</span>
                  {canAward && (
<div className="mt-2 flex items-center gap-2">
<select
                        value={pkg.status}
                        onChange={(e) => handleStatusUpdate(pkg.id, e.target.value as any)}
                        className="text-xs border border-slate-300 rounded px-2 py-1 bg-white text-slate-800 focus:outline-none"
                      >
<option value="PENDING">Pending</option>
<option value="ACTIVE">Active</option>
<option value="SUSPENDED">Suspended</option>
<option value="COMPLETED">Completed</option>
<option value="TERMINATED">Terminated</option>
</select>
</div>
)}
</div>
</div>
</div>
))
)}
</div>

      {/* Award Package Modal */}
      {showModal && (
<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
<div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-100">
<h3 className="text-lg font-bold text-slate-900 mb-1">Award Subcontract Package</h3>
<p className="text-xs text-slate-500 mb-4">
              Contract commitment with Kenyan statutory retention guidelines (BORAQS / JBC).
</p>
<form onSubmit={handleAwardPackage} className="space-y-3">
{formError && (
<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium" role="alert">
              {formError}
</div>
)}
{contractors.length > 0 && (
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Contractor register (approved firms)</label>
<select
                    value={selectedContractorId}
                    onChange={(e) => pickContractor(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                    data-testid="award-contractor-select"
                  >
<option value="">— select approved firm to link —</option>
{contractors.map((c) => (
<option key={c.id} value={c.id}>{c.firmName}{c.kraPin ? ` · ${c.kraPin}` : ''}</option>
))}
</select>
<p className="text-[11px] text-slate-400 mt-1">Linking pulls the firm from the contractor master; only APPROVED firms are listed.</p>
</div>
)}
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Subcontractor Firm Name</label>
<input
                  type="text"
                  required
                  placeholder="e.g. Apex Electrical &amp; Power Ltd"
                  value={newFirmName}
                  onChange={(e) => setNewFirmName(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                />
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Trade Category</label>
<select
                    value={newTradeCategory}
                    onChange={(e) => setNewTradeCategory(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  >
<option value="PLUMBING">Plumbing &amp; Sanitary</option>
<option value="ELECTRICAL">Electrical Engineering</option>
<option value="HVAC">HVAC &amp; Mechanical</option>
<option value="STEEL_FABRICATION">Steel Fabrication</option>
<option value="ROOFING">Roofing</option>
<option value="PAINTING">Painting</option>
<option value="TILING">Tiling &amp; Flooring</option>
<option value="MASONRY">Masonry</option>
<option value="CARPENTRY">Carpentry</option>
<option value="GLAZING">Glazing &amp; Aluminium</option>
<option value="CONCRETE">Concrete Works</option>
<option value="STRUCTURAL_STEEL">Structural Steel</option>
<option value="WATERPROOFING">Waterproofing</option>
<option value="SCAFFOLDING">Scaffolding</option>
<option value="DEMOLITION">Demolition</option>
<option value="WELDING">Welding &amp; Fabrication</option>
<option value="FIRE_SECURITY">Fire &amp; Security Systems</option>
<option value="EARTHWORKS">Earthworks &amp; Excavation</option>
<option value="OTHER">Other Trade</option>
</select>
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Retention Rate (%)</label>
<input
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                    required
                    value={newRetention}
                    onChange={(e) => setNewRetention(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
</div>
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
<input
                    type="text"
                    placeholder="e.g. Eng. Moses Kiprotich"
                    value={newContactPerson}
                    onChange={(e) => setNewContactPerson(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
<input
                    type="text"
                    placeholder="+254 7..."
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
</div>
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Subcontract Sum (KES)</label>
<input
                  type="text"
                  required
                  value={newSum}
                  onChange={(e) => setNewSum(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                />
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Scope Description</label>
<textarea
                  rows={2}
                  placeholder="Detailed breakdown of agreed trade deliverables..."
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                />
</div>

<div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
<button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
</button>
<button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Awarding…' : 'Award Subcontract'}
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
}
