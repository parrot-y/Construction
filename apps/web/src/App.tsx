import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import ConsultantPortalView from './components/portals/ConsultantPortalView';
import SubcontractorPortalView from './components/portals/SubcontractorPortalView';
import SupplierPortalView from './components/portals/SupplierPortalView';
import CompliancePortalView from './components/portals/CompliancePortalView';
import ClientDashboard from './components/ClientDashboard';
import { AuthSession } from './types/auth';

interface AppProps {
  initialPortal?: {
    type: 'consultant' | 'subcontractor' | 'supplier' | 'compliance' | 'client';
    token: string;
  };
}

export default function App({ initialPortal }: AppProps = {}): React.JSX.Element {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [externalPortal, setExternalPortal] = useState<{
    type: string;
    token: string;
  } | null>(initialPortal || null);

  useEffect(() => {
    if (!externalPortal && typeof window !== 'undefined' && window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      const portal = params.get('portal');
      const token = params.get('token');
      if (portal && token) {
        setExternalPortal({ type: portal.toLowerCase(), token });
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
      case 'client':
        return (
          <main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
            <ClientDashboard
              session={{
                user: {
                  id: 'client-guest',
                  email: 'client@stakeholder.co.ke',
                  fullName: 'Project Client / Developer',
                  role: 'CLIENT',
                  tenant: { id: 'tenant-1', name: 'Apex Builders Kenya Ltd', slug: 'apex', currency: 'KES' },
                },
                permissions: ['project.view'],
                token: externalPortal.token,
              }}
            />
          </main>
        );
      default:
        break;
    }
  }

  // 2. Standard authenticated workspace / login flow
  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
      {!session ? (
        <LoginForm onLoginSuccess={(newSession) => setSession(newSession)} />
      ) : (
        <Dashboard session={session} onLogout={handleLogout} />
      )}
    </main>
  );
}
