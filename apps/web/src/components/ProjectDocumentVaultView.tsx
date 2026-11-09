import React, { useEffect, useState} from 'react';

export interface ProjectDocument {
  id: string;
  category: 'ARCHITECTURAL' | 'STRUCTURAL' | 'MEP' | 'COUNTY_APPROVAL' | 'NEMA_PERMIT' | 'NCA_COMPLIANCE' | 'TITLE_DEED_LAND' | 'CONTRACT' | 'OTHER';
  title: string;
  document_number?: string | null;
  revision_code?: string | null;
  file_url: string;
  file_size_bytes?: number | null;
  mime_type?: string | null;
  approval_status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'SUPERSEDED' | 'REJECTED';
  notes?: string | null;
  uploaded_at: string;
  uploaded_by?: { full_name: string} | null;
}

interface ProjectDocumentVaultViewProps {
  projectId: string;
  canUpload?: boolean;
  initialDocuments?: ProjectDocument[];
  onDocumentRegistered?: (doc: Partial<ProjectDocument>) => void;
}

export default function ProjectDocumentVaultView({
  projectId,
  canUpload = true,
  initialDocuments,
  onDocumentRegistered,
}: ProjectDocumentVaultViewProps) {
  const [documents, setDocuments] = useState<ProjectDocument[]>(initialDocuments ?? []);
  const [loadError, setLoadError] = useState<string | null>(null);

  const CAT_MAP: Record<string, ProjectDocument['category']> = {
    ARCHITECTURAL_DRAWING: 'ARCHITECTURAL', STRUCTURAL_DRAWING: 'STRUCTURAL',
    MEP_DRAWING: 'MEP', ELECTRICAL_DRAWING: 'MEP', CIVIL_DRAWING: 'STRUCTURAL',
    COUNTY_APPROVAL_STAMP: 'COUNTY_APPROVAL', NEMA_LICENSE: 'NEMA_PERMIT',
    CONTRACT_AGREEMENT: 'CONTRACT', SPECIFICATION_SHEET: 'OTHER',
  };
  const CAT_BACK: Record<string, string> = {
    ARCHITECTURAL: 'ARCHITECTURAL_DRAWING', STRUCTURAL: 'STRUCTURAL_DRAWING',
    MEP: 'MEP_DRAWING', COUNTY_APPROVAL: 'COUNTY_APPROVAL_STAMP',
    NEMA_PERMIT: 'NEMA_LICENSE', NCA_COMPLIANCE: 'SPECIFICATION_SHEET',
    TITLE_DEED_LAND: 'SPECIFICATION_SHEET', CONTRACT: 'CONTRACT_AGREEMENT', OTHER: 'SPECIFICATION_SHEET',
  };

  const load = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/documents`, { credentials: 'include'});
      if (!res.ok) throw new Error('Failed to load documents');
      const body = await res.json();
      setDocuments((body.documents || []).map((d: any): ProjectDocument => ({
        id: d.id,
        category: CAT_MAP[d.category] || 'OTHER',
        title: d.title,
        document_number: d.drawing_reference,
        revision_code: d.revision_code,
        file_url: d.storage_key ? `/uploads/${d.storage_key}` : '#',
        mime_type: null,
        approval_status: d.status === 'SUPERSEDED' ? 'SUPERSEDED' : d.status === 'FOR_REVIEW' ? 'SUBMITTED' : 'APPROVED',
        notes: d.notes,
        uploaded_at: d.created_at,
        uploaded_by: { full_name: d.uploaded_by_name || 'Site team' },
      })));
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e.message || 'Failed to load documents');
    }
  };

  useEffect(() => { if (projectId) load(); }, [projectId]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);

  // Form State
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<ProjectDocument['category']>('ARCHITECTURAL');
  const [newDocNumber, setNewDocNumber] = useState<string>('');
  const [newRevision, setNewRevision] = useState<string>('Rev A');
  const [newFileUrl, setNewFileUrl] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');

  const filtered = documents.filter((d) => {
    const matchesCat = categoryFilter === 'ALL' || d.category === categoryFilter;
    const matchesSearch =
      searchQuery === '' ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.document_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
});

  const architecturalCount = documents.filter((d) => d.category === 'ARCHITECTURAL').length;
  const structuralCount = documents.filter((d) => d.category === 'STRUCTURAL').length;
  const approvalsCount = documents.filter(
    (d) => d.category === 'COUNTY_APPROVAL' || d.category === 'NCA_COMPLIANCE' || d.category === 'NEMA_PERMIT'
).length;

  const handleRegisterDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newFileUrl.trim()) return;

    const created: ProjectDocument = {
      id: `doc-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      document_number: newDocNumber.trim() || null,
      revision_code: newRevision.trim() || 'Rev A',
      file_url: newFileUrl.trim(),
      approval_status: 'APPROVED',
      notes: newNotes.trim() || null,
      uploaded_at: new Date().toISOString(),
      uploaded_by: { full_name: 'Registered Project User'},
};

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: created.title,
          category: CAT_BACK[created.category] || 'SPECIFICATION_SHEET',
          drawingReference: created.document_number || undefined,
          revisionCode: created.revision_code || 'Rev 0',
          storageKey: created.file_url.replace(/^\/uploads\//, '') || created.file_url,
          uploadedByName: 'Site team',
          notes: created.notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLoadError(err.message || 'Failed to register document');
        return;
      }
    } catch (e: any) {
      setLoadError(e.message || 'Network error — document not registered');
      return;
    }
    await load();
    if (onDocumentRegistered) onDocumentRegistered(created);
    setShowModal(false);
    setNewTitle('');
    setNewDocNumber('');
    setNewFileUrl('');
    setNewNotes('');
};

  const getStatusBadge = (status: ProjectDocument['approval_status']) => {
    switch (status) {
      case 'APPROVED':
        return<span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">Approved IFC</span>;
      case 'SUBMITTED':
        return<span className="px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 text-sky-800">Submitted</span>;
      case 'SUPERSEDED':
        return<span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-200 text-slate-700">Superseded</span>;
      case 'REJECTED':
        return<span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">Rejected</span>;
      default:
        return<span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">Draft</span>;
}
};

  return (
<div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" data-testid="project-document-vault-view" data-project-id={projectId}>
      {/* Header & KPI Summary */}
<div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
<div>
<div className="flex items-center gap-2">
<span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                VAULT &amp; BLUEPRINTS
</span>
<h2 className="text-xl font-bold text-slate-900">Project Drawing &amp; Document Vault</h2>
</div>
<p className="text-sm text-slate-500 mt-1">
              Version-controlled architectural blueprints, structural schedules, county approvals &amp; NCA certificates.
</p>
</div>
          {canUpload && (
<button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
            >
               Upload Drawing / Document
</button>
)}
</div>

        {/* 4 Cards */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
<div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
<span className="text-xs text-slate-500 font-medium">Total Drawings &amp; Files</span>
<div className="mt-1 flex items-baseline gap-2">
<span className="text-2xl font-bold text-slate-900">{documents.length}</span>
<span className="text-xs text-slate-400">controlled</span>
</div>
<div className="text-xs text-slate-500 mt-2">All revisions preserved</div>
</div>

<div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
<span className="text-xs text-slate-500 font-medium">Architectural Sets</span>
<div className="mt-1 flex items-baseline gap-2">
<span className="text-2xl font-bold text-blue-600">{architecturalCount}</span>
<span className="text-xs text-slate-400">sheets</span>
</div>
<div className="text-xs text-slate-500 mt-2">Drawings on file</div>
</div>

<div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
<span className="text-xs text-slate-500 font-medium">Structural Drawings</span>
<div className="mt-1 flex items-baseline gap-2">
<span className="text-2xl font-bold text-indigo-600">{structuralCount}</span>
<span className="text-xs text-slate-400">schedules</span>
</div>
<div className="text-xs text-slate-500 mt-2">Schedules on file</div>
</div>

<div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
<span className="text-xs text-slate-500 font-medium">County / NCA Approvals</span>
<div className="mt-1 flex items-baseline gap-2">
<span className="text-2xl font-bold text-emerald-600">{approvalsCount}</span>
<span className="text-xs text-slate-400">permits</span>
</div>
<div className="text-xs text-slate-500 mt-2">Permits &amp; licenses on file</div>
</div>
</div>
</div>

      {/* Filter and Search Bar */}
<div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
<div className="flex items-center gap-2">
<label className="text-xs font-semibold text-slate-600 uppercase">Category:</label>
<select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-700"
          >
<option value="ALL">All Categories</option>
<option value="TITLE_DEED_LAND">Land Title &amp; ArdhiSasa Search</option>
<option value="ARCHITECTURAL">Architectural Drawings</option>
<option value="STRUCTURAL">Structural Schedules &amp; Details</option>
<option value="MEP">MEP (Plumbing &amp; Electrical)</option>
<option value="COUNTY_APPROVAL">County Planning Approvals</option>
<option value="NEMA_PERMIT">NEMA EIA License</option>
<option value="NCA_COMPLIANCE">NCA Project Registration</option>
<option value="CONTRACT">Contract Documents &amp; JBC</option>
<option value="OTHER">Other Documents</option>
</select>
</div>

<div className="w-full md:w-64">
<input
            type="text"
            placeholder="Search drawings, revs, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded px-3 py-1.5 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
</div>
</div>

      {loadError && (
<div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">{loadError}</div>
)}

      {/* Document Grid */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
        {filtered.length === 0 ? (
<div className="col-span-full p-8 text-center text-slate-500 text-sm">
            No drawings or documents found matching your filter criteria.
</div>
) : (
          filtered.map((doc) => (
<div
              key={doc.id}
              className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-xs flex flex-col justify-between"
            >
<div>
<div className="flex items-center justify-between gap-2 mb-2">
<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                    {doc.category.replace('_', ' ')}
</span>
                  {getStatusBadge(doc.approval_status)}
</div>

<div className="flex items-baseline gap-2 mb-1">
                  {doc.document_number && (
<span className="font-mono text-xs font-bold text-slate-800">
                      {doc.document_number}
</span>
)}
                  {doc.revision_code && (
<span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-900 text-white">
                      {doc.revision_code}
</span>
)}
</div>

<h4 className="text-sm font-bold text-slate-900 leading-snug mb-2">
                  {doc.title}
</h4>

                {doc.notes && (
<p className="text-xs text-slate-500 mb-3 line-clamp-2">
                    {doc.notes}
</p>
)}
</div>

<div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-2">
<span className="text-[11px] text-slate-400">
                  {new Date(doc.uploaded_at).toLocaleDateString()}
</span>
<a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
<span>View Drawing</span> ↗
</a>
</div>
</div>
))
)}
</div>

      {/* Upload Modal */}
      {showModal && (
<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
<div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
<h3 className="text-lg font-bold text-slate-900 mb-1">Register Drawing or Regulatory Document</h3>
<p className="text-xs text-slate-500 mb-4">
              Add revision-controlled drawing sheet or statutory permit to project records.
</p>
<form onSubmit={handleRegisterDocument} className="space-y-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Document Category</label>
<select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                >
<option value="TITLE_DEED_LAND">Land Title &amp; ArdhiSasa Search</option>
<option value="ARCHITECTURAL">Architectural Drawing</option>
<option value="STRUCTURAL">Structural Schedule</option>
<option value="MEP">MEP Engineering</option>
<option value="COUNTY_APPROVAL">County Planning Approval</option>
<option value="NEMA_PERMIT">NEMA EIA License</option>
<option value="NCA_COMPLIANCE">NCA Compliance Certificate</option>
<option value="CONTRACT">Contract Document</option>
<option value="OTHER">Other Record</option>
</select>
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Document / Drawing Title</label>
<input
                  type="text"
                  required
                  placeholder="e.g. Ground Floor Drainage &amp; Sanitary Layout"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                />
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Drawing / Sheet No.</label>
<input
                    type="text"
                    placeholder="e.g. A-102"
                    value={newDocNumber}
                    onChange={(e) => setNewDocNumber(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Revision Code</label>
<input
                    type="text"
                    placeholder="e.g. Rev A, Rev B"
                    value={newRevision}
                    onChange={(e) => setNewRevision(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
</div>
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">File Storage URL / S3 Key</label>
<input
                  type="text"
                  required
                  placeholder="https://... or /uploads/drawings/sheet.pdf"
                  value={newFileUrl}
                  onChange={(e) => setNewFileUrl(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                />
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Scope Description</label>
<textarea
                  rows={2}
                  placeholder="e.g. Issued for construction; incorporates revised beam dimensions"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
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
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  Register Document
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
}
