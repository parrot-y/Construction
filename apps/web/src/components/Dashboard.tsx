import React, { useState } from 'react';
import { AuthSession } from '../types/auth';
import CompanyAdminDashboard from './CompanyAdminDashboard';
import PmQsDashboard from './PmQsDashboard';
import SupervisorDashboard from './SupervisorDashboard';
import ClientDashboard from './ClientDashboard';
import ExecutiveDashboard from './ExecutiveDashboard';
import FieldDashboard from './FieldDashboard';
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

  const handlePreview = (type: string, token: string, name: string, role?: string) => {
    setPreviewPortal({ type, token, name, role });
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

    switch (user.role) {
      case 'COMPANY_ADMIN':
      case 'ADMIN':
        return <CompanyAdminDashboard session={session} onPreviewPortal={handlePreview} />;
      case 'PM_QS':
        return <PmQsDashboard session={session} onPreviewPortal={handlePreview} />;
      case 'SITE_SUPERVISOR':
        return <SupervisorDashboard session={session} />;
      case 'SITE_ENGINEER':
      case 'TRADE_LEAD':
      case 'FOREMAN':
      case 'WORKER':
      case 'SUPERINTENDENT':
        return <FieldDashboard session={session} />;
      case 'VIEWER':
        return <FieldDashboard session={session} readOnly />;
      case 'EXECUTIVE':
        return <ExecutiveDashboard session={session} />;
      case 'CLIENT':
        return <ClientDashboard session={session} />;
      default:
        return (
          <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
            Role {user.role} workspace view not configured. Contact your company administrator.
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Navigation Bar */}
      <nav className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            Active Tenant
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            {user.tenant.name}
          </h1>
          <p className="text-xs text-slate-500">
            KRA PIN: P051234567X • NCA Category: NCA 4 • Currency: {user.tenant.currency}
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-800">{user.fullName}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block ${getRoleBadgeStyle(user.role)}`}>
              {user.role}
            </span>
          </div>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-red-700 hover:bg-red-50 border border-slate-200 rounded-lg transition"
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Permissions Accordion / Security Context Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-600">Permissions ({permissions.length}):</span>
          <div className="flex flex-wrap gap-1">
            {permissions.slice(0, 6).map((p) => (
              <span
                key={p}
                className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200"
              >
                {p}
              </span>
            ))}
            {permissions.length > 6 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-50 text-slate-400 rounded">
                +{permissions.length - 6} more
              </span>
            )}
          </div>
        </div>

        <div className="text-[11px] text-slate-400 font-mono shrink-0">
          RLS Context: <span className="text-slate-600">{user.tenant.id}</span>
        </div>
      </div>

      {/* Role-Specific Dashboard Content */}
      {renderRoleDashboard()}
    </div>
  );
}