import React, { Suspense, lazy, useState} from 'react';
import { AuthSession} from '../types/auth';
const ClientDashboard = lazy(() => import('./ClientDashboard'));

const OwnerDashboard = lazy(() => import('./OwnerDashboard'));
const FieldDashboard = lazy(() => import('./FieldDashboard'));
const AppShell = lazy(() => import('./console/AppShell'));
const ConsultantPortalView = lazy(() => import('./portals/ConsultantPortalView'));
const SubcontractorPortalView = lazy(() => import('./portals/SubcontractorPortalView'));
const SupplierPortalView = lazy(() => import('./portals/SupplierPortalView'));
const CompliancePortalView = lazy(() => import('./portals/CompliancePortalView'));

const Fallback = <div className="min-h-[40vh] flex items-center justify-center text-sm text-slate-400">Loading…</div>;

interface DashboardProps {
  session: AuthSession;
  onLogout: () => void;
}

export default function Dashboard({ session, onLogout}: DashboardProps): React.JSX.Element {
  const { user, permissions} = session;
  const [previewPortal, setPreviewPortal] = useState<{
    type: string;
    token: string;
    name: string;
    role?: string;
} | null>(null);

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'COMPANY_ADMIN':
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PM_QS':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'SITE_SUPERVISOR':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'CLIENT':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
}
};

  const renderRoleDashboard = () => {
    if (previewPortal) {
      switch (previewPortal.type.toUpperCase()) {
        case 'CONSULTANT':
          return (
<Suspense fallback={Fallback}><ConsultantPortalView
              token={previewPortal.token}
              stakeholderName={previewPortal.name}
              stakeholderRole={previewPortal.role}
              onBackToDashboard={() => setPreviewPortal(null)}
            /></Suspense>
);
        case 'SUBCONTRACTOR':
          return (
<Suspense fallback={Fallback}><SubcontractorPortalView
              token={previewPortal.token}
              subcontractorName={previewPortal.name}
              subcontractorTrade={previewPortal.role}
              onBackToDashboard={() => setPreviewPortal(null)}
            /></Suspense>
);
        case 'SUPPLIER':
          return (
<Suspense fallback={Fallback}><SupplierPortalView
              token={previewPortal.token}
              supplierName={previewPortal.name}
              supplierCategory={previewPortal.role}
              onBackToDashboard={() => setPreviewPortal(null)}
            /></Suspense>
);
        case 'COMPLIANCE':
          return (
<Suspense fallback={Fallback}><CompliancePortalView
              token={previewPortal.token}
              auditorName={previewPortal.name}
              auditorAgency={previewPortal.role}
              onBackToDashboard={() => setPreviewPortal(null)}
            /></Suspense>
);
        case 'CLIENT':
          return <Suspense fallback={Fallback}><ClientDashboard session={session} /></Suspense>;
        default:
          return (
<div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
              Portal type {previewPortal.type} preview not found.
<button onClick={() => setPreviewPortal(null)} className="ml-2 font-bold text-blue-600">
                Back to Workspace
</button>
</div>
);
}
}

    if (user.role === 'CLIENT') {
      return <Suspense fallback={Fallback}><ClientDashboard session={session} /></Suspense>;
}
    // Stage-2: OWNER gets a dedicated read-mostly dashboard — no contractor
    // actions, no billing admin, approvals + financial visibility only.
    if (user.role === 'OWNER') {
      return <Suspense fallback={Fallback}><OwnerDashboard session={session} /></Suspense>;
}
    // Stage 4: field roles get the mobile-first field workspace —
    // diary, attendance, checklists, inbox, drawings, RFIs, safety
    // incidents and snagging, all permission-filtered.
    if (['FOREMAN', 'WORKER', 'SITE_ENGINEER', 'TRADE_LEAD'].includes(user.role)) {
      return <Suspense fallback={Fallback}><FieldDashboard session={session} onLogout={onLogout} /></Suspense>;
}
    // All internal workspace roles render inside the console shell
    // (icon rail + section router per role nav matrix).
    return <Suspense fallback={Fallback}><AppShell session={session} onLogout={onLogout} /></Suspense>;
};

  // Internal workspace roles use the console shell (own chrome).
  // CLIENT and OWNER keep their dedicated read-mostly dashboards;
  // field roles use the mobile-first FieldDashboard (Stage 4).
  if (user.role !== 'CLIENT' && user.role !== 'OWNER'
      && !['FOREMAN', 'WORKER', 'SITE_ENGINEER', 'TRADE_LEAD'].includes(user.role)
      && !previewPortal) {
    return <Suspense fallback={Fallback}><AppShell session={session} onLogout={onLogout} /></Suspense>;
}

  const initials = user.fullName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
<div className="w-full max-w-6xl mx-auto space-y-5 pb-10">
      {/* Sticky top bar */}
<header className="sticky top-0 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
<div className="flex items-center justify-between gap-4">
<div className="flex items-center gap-3 min-w-0">
<div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white text-sm font-black shadow-sm shrink-0">
              S
</div>
<div className="min-w-0">
<div className="flex items-center gap-2">
<span className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                  {user.tenant.name}
</span>
<span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                  {user.tenant.currency} • NCA 4
</span>
</div>
<h1 className="text-base font-bold text-slate-900 truncate mt-0.5">
                {user.fullName}
</h1>
</div>
</div>

<div className="flex items-center gap-3 shrink-0">
<span className={`text-[10px] font-bold px-2 py-0.5 rounded border hidden md:inline-block ${getRoleBadgeStyle(user.role)}`}>
              {user.role}
</span>
<div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold" aria-hidden="true">
              {initials}
</div>
<button
              onClick={onLogout}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-200 rounded-lg transition"
            >
              Sign out
</button>
</div>
</div>
</header>

      {/* Permissions context bar */}
<div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 flex items-center gap-2 text-[11px] overflow-x-auto">
<span className="font-semibold text-slate-500 shrink-0">{permissions.length} permissions</span>
<span className="text-slate-300 shrink-0">•</span>
<div className="flex gap-1">
          {permissions.slice(0, 8).map((p) => (
<span
              key={p}
              className="text-[10px] px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded border border-slate-100 whitespace-nowrap"
            >
              {p}
</span>
))}
          {permissions.length > 8 && (
<span className="text-[10px] text-slate-400 px-1 py-0.5">+{permissions.length - 8}</span>
)}
</div>
</div>

      {/* Role-Specific Dashboard Content */}
      {renderRoleDashboard()}
</div>
);
}