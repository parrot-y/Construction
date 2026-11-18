import React, { Suspense, lazy, useState, useEffect} from 'react';
import LoginForm from './components/LoginForm';
const SignupForm = lazy(() => import('./components/SignupForm'));
const InviteAcceptView = lazy(() => import('./components/InviteAcceptView'));
import AppErrorBoundary from './components/AppErrorBoundary';
import { ToastProvider } from './components/feedback/Toast';
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
import { setOfflineUserScope, clearReadCache } from './services/offline-cache';
import { PRODUCT_NAME } from './lib/product';
import { api } from './lib/api';

const PageFallback = <div className="min-h-[50vh] flex items-center justify-center text-sm text-slate-400">Loading…</div>;

// Portal links carry a bearer token. The token is redacted from the address
// bar on consume (C1), so the active portal context is kept in sessionStorage
// instead — per-tab, cleared on tab close, never in history or screenshots.
const PORTAL_STORAGE_KEY = 'sitesafi_portal_link';
const TermsPage = lazy(() => import('./components/LegalPage').then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./components/LegalPage').then((m) => ({ default: m.PrivacyPage })));
const OperatorAdoptionView = lazy(() => import('./components/OperatorAdoptionView'));

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
    if (path === '/operator') return <Suspense fallback={PageFallback}><OperatorAdoptionView /></Suspense>;
  }
  return <ToastProvider><AppErrorBoundary label="app-shell"><AppShell initialPortal={initialPortal} /></AppErrorBoundary></ToastProvider>;
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
    api.get('/api/v1/auth/me')
      .then((j: any) => { if (!cancelled && j?.user) setSession(j as AuthSession); })
      .catch(() => { /* intentionally ignored: no valid session cookie or offline — stay logged out */ });
    return () => { cancelled = true; };
  }, []);

  // J1: offline caches/queues are scoped to the signed-in user+tenant —
  // a different person on the same phone sees none of the previous
  // user's saved reads, and queued writes only flush for their owner.
  useEffect(() => {
    setOfflineUserScope(session?.user ?? null);
  }, [session]);

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
} else {
        // Reload/deep-link with a redacted URL: restore the portal this tab
        // was already viewing so revoked/expired links still fail honestly.
        try {
          const saved = window.sessionStorage.getItem(PORTAL_STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved) as { type?: unknown; token?: unknown } | null;
            if (typeof parsed?.type === 'string' && typeof parsed?.token === 'string' && parsed.token) {
              setExternalPortal({ type: parsed.type.toLowerCase(), token: parsed.token });
            }
          }
        } catch {
          // hygiene-allow: intentionally ignored — corrupt storage, fall through to the normal landing flow.
        }
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

  // Keep sessionStorage in step with the active portal (set on consume,
  // removed when the stakeholder exits back to the landing hub).
  useEffect(() => {
    try {
      if (externalPortal) {
        window.sessionStorage.setItem(PORTAL_STORAGE_KEY, JSON.stringify(externalPortal));
      } else {
        window.sessionStorage.removeItem(PORTAL_STORAGE_KEY);
      }
    } catch {
      // hygiene-allow: intentionally ignored — storage unavailable (private mode), portal still works in-memory.
    }
  }, [externalPortal]);

  const handleLogout = async () => {
    try {
      await api.post('/api/v1/auth/logout');
} catch {
      // hygiene-allow: intentionally ignored — network errors on logout are fine, session is cleared locally anyway.
}
    clearReadCache();
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
      const data = await api.post<AuthSession>('/api/v1/auth/login', { email, password: 'Password123!' });
      setSession(data);
      setDemoPreview(true);
    } catch {
      // hygiene-allow: intentionally ignored — preview unavailable, user can still sign in normally.
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

  // 2. Invitation link (?invite=<token>) takes precedence over any existing
  // session — a reused link must show the honest invitation state, not the
  // workspace of whoever happens to be signed in on this browser.
  if (inviteToken) {
    return (
<main className="min-h-screen bg-slate-100 p-4 sm:p-8 font-sans flex flex-col justify-center">
<Suspense fallback={PageFallback}><InviteAcceptView
        token={inviteToken}
        onLoginSuccess={(newSession) => {
          setSession(newSession);
          setInviteToken(null);
          window.history.replaceState({}, '', '/');
        }}
        onBack={() => { setInviteToken(null); window.history.replaceState({}, '', '/'); }}
      /></Suspense>
</main>
);
}

  // 3. Standard authenticated workspace / login / landing hub flow
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

  // 3c. Company signup view
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
