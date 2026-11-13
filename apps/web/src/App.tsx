import React, { Suspense, lazy, useState, useEffect} from 'react';
import LoginForm from './components/LoginForm';
const SignupForm = lazy(() => import('./components/SignupForm'));
const InviteAcceptView = lazy(() => import('./components/InviteAcceptView'));
import AppErrorBoundary from './components/AppErrorBoundary';
const RequestPasswordResetView = lazy(() => import('./components/PasswordResetViews').then((m) => ({ default: m.RequestPasswordResetView })));
const ResetPasswordView = lazy(() => import('./components/PasswordResetViews').then((m) => ({ default: m.ResetPasswordView })));
const VerifyEmailView = lazy(() => import('./components/PasswordResetViews').then((m) => ({ default: m.VerifyEmailView })));
import Dashboard from './components/Dashboard';
import LandingPortalHub from './components/LandingPortalHub';
const ConsultantPortalView = lazy(() => import('./components/portals/ConsultantPortalView'));
const SubcontractorPortalView = lazy(() => import('./components/portals/SubcontractorPortalView'));
const SupplierPortalView = lazy(() => import('./components/portals/SupplierPortalView'));
const CompliancePortalView = lazy(() => import('./components/portals/CompliancePortalView'));
const ClientPortalView = lazy(() => import('./components/portals/ClientPortalView'));
const PublicQuoteView = lazy(() => import('./components/PublicQuoteView'));
import { AuthSession} from './types/auth';
import { migrateOfflineStorage } from './services/offline-sync';
import { PRODUCT_NAME } from './lib/product';

const PageFallback = <div className="min-h-[50vh] flex items-center justify-center text-sm text-slate-400">Loading…</div>;
const TermsPage = lazy(() => import('./components/LegalPage').then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./components/LegalPage').then((m) => ({ default: m.PrivacyPage })));

interface AppProps {
  initialPortal?: {
    type: 'consultant' | 'subcontractor' | 'supplier' | 'compliance' | 'client' | 'quote';
    token: string;
};
}

export default function App({ initialPortal}: AppProps = {}): React.JSX.Element {
  // Public legal pages — path-based, rendered before any app state.
  if (typeof window !== 'undefined') {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (path === '/terms') return <Suspense fallback={PageFallback}><TermsPage /></Suspense>;
    if (path === '/privacy') return <Suspense fallback={PageFallback}><PrivacyPage /></Suspense>;
  }
  return <AppErrorBoundary label="app-shell"><AppShell initialPortal={initialPortal} /></AppErrorBoundary>;
}

function AppShell({ initialPortal}: AppProps): React.JSX.Element {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [externalPortal, setExternalPortal] = useState<{
    type: string;
    token: string;
} | null>(initialPortal || null);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showSignupForm, setShowSignupForm] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);

  // C1: restore the session from the HttpOnly cookie on reload/deep links.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/auth/me', { credentials: 'include'})
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.user) setSession(j as AuthSession); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // One-time migration of legacy offline queue keys to `sitesafi_*`
    void migrateOfflineStorage();
    if (!externalPortal && typeof window !== 'undefined' && window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      const portal = params.get('portal');
      const token = params.get('token');
      if (portal && token) {
        setExternalPortal({ type: portal.toLowerCase(), token});
        // C1: redact the bearer token from the address bar/history once consumed.
        window.history.replaceState({}, '', `/?portal=${portal.toLowerCase()}`);
}
      if (params.get('signup') === '1') {
        setShowSignupForm(true);
}
      const invite = params.get('invite');
      if (invite) {
        setInviteToken(invite);
}
      const reset = params.get('reset');
      if (reset) {
        setResetToken(reset);
}
      const verify = params.get('verify');
      if (verify) {
        setVerifyToken(verify);
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

  // Demo workspace previews — real logins through the normal auth flow.
  // Compile-time gated: with VITE_DEMO_MODE unset the bundler eliminates
  // this block and the seeded demo credentials never reach the bundle.
  const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
  const DEMO_LOGINS: Record<string, string> = DEMO_MODE ? {
    COMPANY_ADMIN: 'admin@apexbuilders.co.ke',
    PM_QS: 'qs@apexbuilders.co.ke',
    SITE_SUPERVISOR: 'supervisor@apexbuilders.co.ke',
    EXECUTIVE: 'executive@apexbuilders.co.ke',
    CLIENT: 'client@apexbuilders.co.ke',
  } : {};

  const [demoPreview, setDemoPreview] = useState(false);

  const handleSelectRolePreview = async (role: string) => {
    if (!DEMO_MODE) return;
    const email = DEMO_LOGINS[role.toUpperCase()];
    if (!email) return;
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password: 'Password123!' }),
      });
      const data = await res.json();
      if (res.ok) {
        setSession(data as AuthSession);
        setDemoPreview(true);
      }
    } catch {
      // Preview unavailable — user can still sign in normally
    }
  };

  // 1. If an external stakeholder accessed via token link
  if (externalPortal) {
    const handleExitPortal = () => setExternalPortal(null);

    switch (externalPortal.type) {
      case 'consultant':
        return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<Suspense fallback={PageFallback}><AppErrorBoundary label="portal:consultant"><ConsultantPortalView token={externalPortal.token} onBackToDashboard={handleExitPortal} /></AppErrorBoundary></Suspense>
</main>
);
      case 'subcontractor':
        return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<Suspense fallback={PageFallback}><AppErrorBoundary label="portal:subcontractor"><SubcontractorPortalView token={externalPortal.token} onBackToDashboard={handleExitPortal} /></AppErrorBoundary></Suspense>
</main>
);
      case 'supplier':
        return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<Suspense fallback={PageFallback}><AppErrorBoundary label="portal:supplier"><SupplierPortalView token={externalPortal.token} onBackToDashboard={handleExitPortal} /></AppErrorBoundary></Suspense>
</main>
);
      case 'compliance':
        return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<Suspense fallback={PageFallback}><AppErrorBoundary label="portal:compliance"><CompliancePortalView token={externalPortal.token} onBackToDashboard={handleExitPortal} /></AppErrorBoundary></Suspense>
</main>
);
      case 'quote':
        return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<Suspense fallback={PageFallback}><AppErrorBoundary label="portal:quote"><PublicQuoteView token={externalPortal.token} onBack={handleExitPortal} /></AppErrorBoundary></Suspense>
</main>
);
      case 'client':
        return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<Suspense fallback={PageFallback}><AppErrorBoundary label="portal:client"><ClientPortalView token={externalPortal.token} onBackToDashboard={handleExitPortal} /></AppErrorBoundary></Suspense>
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
{demoPreview && (
<div className="w-full max-w-6xl mx-auto mb-3 px-1">
<div className="rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold px-4 py-2 text-center">
            Demo workspace — seeded sample data for evaluation only. Not a real project.
</div>
</div>
)}
<Dashboard session={session} onLogout={handleLogout} />
</main>
);
}

  // 3a-i. Password reset link (?reset=<token>) — single-use, expiring.
  if (resetToken) {
    return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<Suspense fallback={PageFallback}><ResetPasswordView
        token={resetToken}
        onDone={() => { setResetToken(null); window.history.replaceState({}, '', '/'); setShowLoginForm(true); }}
      /></Suspense>
</main>
);
}

  // 3a-ii. Email verification link (?verify=<token>) — single-use.
  if (verifyToken) {
    return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<Suspense fallback={PageFallback}><VerifyEmailView
        token={verifyToken}
        onDone={() => { setVerifyToken(null); window.history.replaceState({}, '', '/'); setShowLoginForm(true); }}
      /></Suspense>
</main>
);
}

  // 3. Login form view toggle
  if (showLoginForm) {
    return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<div className="w-full max-w-md mx-auto mb-4">
<button
            onClick={() => { setShowLoginForm(false); setShowPasswordReset(false); }}
            data-testid="back-to-landing-btn"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition"
          >
<span>←</span>
<span>Back to {PRODUCT_NAME} Landing Portal Hub</span>
</button>
</div>
{showPasswordReset ? (
<Suspense fallback={PageFallback}><RequestPasswordResetView onBack={() => setShowPasswordReset(false)} /></Suspense>
) : (
<LoginForm
          onLoginSuccess={(newSession) => setSession(newSession)}
          onOpenSignup={() => { setShowLoginForm(false); setShowSignupForm(true); }}
          onForgotPassword={() => setShowPasswordReset(true)}
        />
)}
</main>
);
}

  // 3a. Invitation acceptance view (?invite=<token>)
  if (inviteToken) {
    return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<Suspense fallback={PageFallback}><InviteAcceptView
        token={inviteToken}
        onLoginSuccess={(newSession) => setSession(newSession)}
        onBack={() => { setInviteToken(null); window.history.replaceState({}, '', '/'); }}
      /></Suspense>
</main>
);
}

  // 3b. Company signup view
  if (showSignupForm) {
    return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<div className="w-full max-w-md mx-auto mb-4">
<button
          onClick={() => { setShowSignupForm(false); setShowLoginForm(false); }}
          data-testid="back-to-landing-btn"
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition"
        >
<span>←</span>
<span>Back to {PRODUCT_NAME} Landing Portal Hub</span>
</button>
</div>
<Suspense fallback={PageFallback}><SignupForm onLoginSuccess={(newSession) => setSession(newSession)} /></Suspense>
</main>
);
}

  // 4. Default Platform Landing Portal Experience Hub
  return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<LandingPortalHub
        onSelectRolePreview={handleSelectRolePreview}
        onOpenLogin={() => setShowLoginForm(true)}
        onOpenSignup={() => setShowSignupForm(true)}
      />
</main>
);
}
