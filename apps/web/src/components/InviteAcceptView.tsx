import React, { useEffect, useState } from 'react';
import { AuthSession } from '../types/auth';

interface InviteInfo {
  email: string;
  phone: string | null;
  role: string;
  status: string;
  expiresAt: string;
  companyName: string;
}

interface InviteAcceptViewProps {
  token: string;
  onLoginSuccess: (session: AuthSession) => void;
  onBack: () => void;
  apiBaseUrl?: string;
}

const ROLE_LABELS: Record<string, string> = {
  COMPANY_ADMIN: 'Company admin',
  PM_QS: 'Project manager / quantity surveyor',
  SITE_SUPERVISOR: 'Site supervisor',
  SITE_ENGINEER: 'Site engineer',
  EXECUTIVE: 'Executive',
  CLIENT: 'Client',
  CONSULTANT: 'Consultant',
  SUBCONTRACTOR: 'Subcontractor',
  SUPPLIER: 'Supplier',
};

export default function InviteAcceptView({
  token,
  onLoginSuccess,
  onBack,
  apiBaseUrl = '',
}: InviteAcceptViewProps): React.JSX.Element {
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState<{ verifyUrl: string | null; companyName: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBaseUrl}/api/v1/invitations/lookup/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Invitation not found');
        if (!cancelled) setInvite(data.data as InviteInfo);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load invitation');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, apiBaseUrl]);

  const inputCls =
    'w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 min-h-[44px]';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!invite) return;
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          token,
          email: invite.email,
          fullName,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Could not accept invitation');
      }
      const acceptData = data.data || {};
      // New accounts must verify their email before first sign-in.
      if (acceptData.pendingVerification) {
        const verificationToken = acceptData.verificationToken;
        setPendingVerification({
          verifyUrl: verificationToken ? `${window.location.origin}/?verify=${verificationToken}` : null,
          companyName: acceptData.companyName || invite.companyName,
        });
        return;
      }
      // Sign in immediately with the credentials just confirmed/set.
      const loginRes = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: invite.email, password }),
      });
      const session = await loginRes.json();
      if (!loginRes.ok) {
        // Invite accepted but sign-in is still gated (e.g. verification
        // pending on an existing unverified account).
        setErrorMessage(
          'Invitation accepted. Your account still needs verification — check your email or ask your administrator to activate it, then sign in.',
        );
        return;
      }
      onLoginSuccess(session as AuthSession);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  if (loadError) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-center">
          <h1 className="text-xl font-bold text-slate-900">Invitation unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{loadError}</p>
          <p className="mt-2 text-sm text-slate-600">
            The link may be invalid, expired, revoked, or already used. Ask your administrator to send a new invitation.
          </p>
          <button onClick={onBack} className="mt-4 text-sm font-semibold text-brand-600 hover:text-brand-700 min-h-[44px]">
            Back to Site Safi
          </button>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-6 w-2/3 rounded bg-slate-200 animate-pulse" />
          <div className="mt-3 h-4 w-full rounded bg-slate-100 animate-pulse" />
          <div className="mt-2 h-4 w-5/6 rounded bg-slate-100 animate-pulse" />
        </div>
      </div>
    );
  }

  if (pendingVerification) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Invitation accepted</h1>
          <div className="mt-4 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800" role="status">
            You joined {pendingVerification.companyName}. Verify your email address to activate your account.
          </div>
          {pendingVerification.verifyUrl && (
            <p className="mt-3 text-xs text-slate-500">
              Verification link (simulated delivery — production sends this by email):{' '}
              <a href={pendingVerification.verifyUrl} className="font-semibold text-brand-600 hover:underline break-all">
                {pendingVerification.verifyUrl}
              </a>
            </p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Until then you cannot sign in. If email delivery is not configured, ask your administrator to activate the account.
          </p>
          <button onClick={onBack} className="mt-4 text-sm font-semibold text-brand-600 hover:text-brand-700 min-h-[44px]">
            Back to Site Safi
          </button>
        </div>
      </div>
    );
  }

  const unusable = invite.status !== 'PENDING';

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">You have been invited</h1>
        <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm">
          <p className="text-slate-700">
            <span className="font-semibold">{invite.companyName}</span> has invited you to join as{' '}
            <span className="font-semibold">{ROLE_LABELS[invite.role] ?? invite.role}</span>.
          </p>
          <p className="mt-1 text-slate-600">
            Invited email: <span className="font-medium">{invite.email}</span>
          </p>
          {invite.expiresAt && (
            <p className="mt-1 text-xs text-slate-500">
              Link expires {new Date(invite.expiresAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>

        {unusable ? (
          <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800" role="alert">
            This invitation is {invite.status.toLowerCase()}. Ask your administrator to send a new one.
          </div>
        ) : (
          <>
            {errorMessage && (
              <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700" role="alert">
                {errorMessage}
              </div>
            )}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="invite-name" className={labelCls}>Your full name</label>
                <input id="invite-name" type="text" required minLength={2} value={fullName}
                  onChange={(e) => setFullName(e.target.value)} className={inputCls}
                  placeholder="e.g. Jane Wanjiru" autoComplete="name" />
              </div>
              <div>
                <label htmlFor="invite-password" className={labelCls}>Password</label>
                <input id="invite-password" type="password" required minLength={8} value={password}
                  onChange={(e) => setPassword(e.target.value)} className={inputCls}
                  placeholder="At least 8 characters" autoComplete="new-password" />
                <p className="mt-1 text-[11px] text-slate-500">
                  New to Site Safi? Choose a password. Already have an account with this email? Enter your existing password to confirm it is you.
                </p>
              </div>
              <div>
                <label htmlFor="invite-confirm" className={labelCls}>Confirm password</label>
                <input id="invite-confirm" type="password" required minLength={8} value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls}
                  autoComplete="new-password" />
              </div>
              <button type="submit" disabled={isLoading}
                className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 min-h-[44px]">
                {isLoading ? 'Accepting…' : 'Accept invitation'}
              </button>
            </form>
          </>
        )}
        <button onClick={onBack} className="mt-4 text-sm font-semibold text-slate-600 hover:text-slate-900 min-h-[44px]">
          Back to Site Safi
        </button>
      </div>
    </div>
  );
}
