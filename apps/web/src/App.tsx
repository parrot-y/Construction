import React, { useState, useEffect} from 'react';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import LandingPortalHub from './components/LandingPortalHub';
import ConsultantPortalView from './components/portals/ConsultantPortalView';
import SubcontractorPortalView from './components/portals/SubcontractorPortalView';
import SupplierPortalView from './components/portals/SupplierPortalView';
import CompliancePortalView from './components/portals/CompliancePortalView';
import ClientPortalView from './components/portals/ClientPortalView';
import PublicQuoteView from './components/PublicQuoteView';
import { AuthSession} from './types/auth';

interface AppProps {
  initialPortal?: {
    type: 'consultant' | 'subcontractor' | 'supplier' | 'compliance' | 'client' | 'quote';
    token: string;
};
}

export default function App({ initialPortal}: AppProps = {}): React.JSX.Element {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [externalPortal, setExternalPortal] = useState<{
    type: string;
    token: string;
} | null>(initialPortal || null);
  const [showLoginForm, setShowLoginForm] = useState(false);

  useEffect(() => {
    if (!externalPortal && typeof window !== 'undefined' && window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      const portal = params.get('portal');
      const token = params.get('token');
      if (portal && token) {
        setExternalPortal({ type: portal.toLowerCase(), token});
}
}
}, [externalPortal]);

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
});
} catch {
      // Ignore network errors on logout
}
    setSession(null);
    setShowLoginForm(false);
};

  const handleSelectRolePreview = (role: string) => {
    const roleUpper = role.toUpperCase();
    switch (roleUpper) {
      case 'COMPANY_ADMIN':
        setSession({
          user: {
            id: 'demo-admin-id',
            email: 'admin@apexbuilders.co.ke',
            fullName: 'David Kimani (Admin)',
            role: 'COMPANY_ADMIN',
            tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex-builders', currency: 'KES'},
},
          permissions: ['company.manage', 'user.invite', 'project.create', 'audit.view', 'tender.manage'],
          token: 'demo-jwt-admin',
});
        break;

      case 'PM_QS':
        setSession({
          user: {
            id: 'demo-qs-id',
            email: 'qs@apexbuilders.co.ke',
            fullName: 'Faith Mutua (Lead QS)',
            role: 'PM_QS',
            tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex-builders', currency: 'KES'},
},
          permissions: ['project.view', 'boq.import', 'boq.manage', 'cost.manage', 'variation.request', 'rfi.create', 'progress.record', 'tender.manage'],
          token: 'demo-jwt-qs',
});
        break;

      case 'SITE_SUPERVISOR':
        setSession({
          user: {
            id: 'demo-sup-id',
            email: 'supervisor@apexbuilders.co.ke',
            fullName: 'John Kamau (Site Supervisor)',
            role: 'SITE_SUPERVISOR',
            tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex-builders', currency: 'KES'},
},
          permissions: ['project.view', 'diary.create', 'inspection.create', 'progress.record', 'qc.create'],
          token: 'demo-jwt-supervisor',
});
        break;

      case 'CLIENT':
        setSession({
          user: {
            id: 'demo-client-id',
            email: 'client@apexbuilders.co.ke',
            fullName: 'Dr. Evans Kiprop (Diaspora Investor)',
            role: 'CLIENT',
            tenant: { id: 'tenant-123', name: 'Apex Builders Kenya Ltd', slug: 'apex-builders', currency: 'KES'},
},
          permissions: ['project.view', 'client.portal.access', 'report.view', 'variation.approve'],
          token: 'demo-jwt-client',
});
        break;

      case 'CONSULTANT':
        setExternalPortal({ type: 'consultant', token: 'demo-consultant-token-123'});
        break;

      case 'SUBCONTRACTOR':
        setExternalPortal({ type: 'subcontractor', token: 'demo-subcontractor-token-123'});
        break;

      case 'SUPPLIER':
        setExternalPortal({ type: 'supplier', token: 'demo-supplier-token-123'});
        break;

      case 'COMPLIANCE':
        setExternalPortal({ type: 'compliance', token: 'demo-compliance-token-123'});
        break;

      default:
        break;
}
};

  // 1. If an external stakeholder accessed via token link (Zero Seat Tax)
  if (externalPortal) {
    const handleExitPortal = () => setExternalPortal(null);

    switch (externalPortal.type) {
      case 'consultant':
        return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<ConsultantPortalView token={externalPortal.token} onBackToDashboard={handleExitPortal} />
</main>
);
      case 'subcontractor':
        return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<SubcontractorPortalView token={externalPortal.token} onBackToDashboard={handleExitPortal} />
</main>
);
      case 'supplier':
        return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<SupplierPortalView token={externalPortal.token} onBackToDashboard={handleExitPortal} />
</main>
);
      case 'compliance':
        return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<CompliancePortalView token={externalPortal.token} onBackToDashboard={handleExitPortal} />
</main>
);
      case 'quote':
        return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<PublicQuoteView token={externalPortal.token} onBack={handleExitPortal} />
</main>
);
      case 'client':
        return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<ClientPortalView token={externalPortal.token} onBackToDashboard={handleExitPortal} />
</main>
);
      default:
        break;
}
}

  // 2. Standard authenticated workspace / login / landing hub flow
  if (session) {
    return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<Dashboard session={session} onLogout={handleLogout} />
</main>
);
}

  // 3. Login form view toggle
  if (showLoginForm) {
    return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<div className="w-full max-w-md mx-auto mb-4">
<button
            onClick={() => setShowLoginForm(false)}
            data-testid="back-to-landing-btn"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition"
          >
<span>←</span>
<span>Back to Site Safi Landing Portal Hub</span>
</button>
</div>
<LoginForm onLoginSuccess={(newSession) => setSession(newSession)} />
</main>
);
}

  // 4. Default Platform Landing Portal Experience Hub
  return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<LandingPortalHub
        onSelectRolePreview={handleSelectRolePreview}
        onOpenLogin={() => setShowLoginForm(true)}
      />
</main>
);
}
