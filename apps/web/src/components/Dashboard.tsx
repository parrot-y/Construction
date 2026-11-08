import React, { useState } from 'react';
import { AuthSession } from '../types/auth';
import ClientDashboard from './ClientDashboard';
import AppShell from './console/AppShell';
import ConsultantPortalView from './portals/ConsultantPortalView';
import SubcontractorPortalView from './portals/SubcontractorPortalView';
import SupplierPortalView from './portals/SupplierPortalView';
import CompliancePortalView from './portals/CompliancePortalView';

interface DashboardProps {
  session: AuthSession;
  onLogout: () => void;
}

export default function Dashboard({ session, onLogout }: DashboardProps): React.JSX.Element {
  const { user, permissions } = session;
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
            <ConsultantPortalView
              token={previewPortal.token}
              stakeholderName={previewPortal.name}
              stakeholderRole={previewPortal.role}
              onBackToDashboard={() => setPreviewPortal(null)}
            />
          );
        case 'SUBCONTRACTOR':
          return (
            <SubcontractorPortalView
              token={previewPortal.token}
              subcontractorName={previewPortal.name}
              subcontractorTrade={previewPortal.role}
              onBackToDashboard={() => setPreviewPortal(null)}
            />
          );
        case 'SUPPLIER':
          return (
            <SupplierPortalView
              token={previewPortal.token}
              supplierName={previewPortal.name}
              supplierCategory={previewPortal.role}
              onBackToDashboard={() => setPreviewPortal(null)}
            />
          );
        case 'COMPLIANCE':
          return (
            <CompliancePortalView
              token={previewPortal.token}
              auditorName={previewPortal.name}
              auditorAgency={previewPortal.role}
              onBackToDashboard={() => setPreviewPortal(null)}
            />
          );
        case 'CLIENT':
          return <ClientDashboard session={session} />;
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
      return <ClientDashboard session={session} />;
    }
    // All internal workspace roles render inside the console shell
    // (icon rail + section router per role nav matrix).
    return <AppShell session={session} onLogout={onLogout} />;
  };

  // Internal workspace roles use the console shell (own chrome).
  // CLIENT keeps the legacy dashboard layout below.
  if (user.role !== 'CLIENT' && !previewPortal) {
    return <AppShell session={session} onLogout={onLogout} />;
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
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
              className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded border border-slate-100 whitespace-nowrap"
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