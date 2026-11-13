import React, { useEffect, useState } from 'react';

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 min-h-[44px]';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

interface BaseProps {
  apiBaseUrl?: string;
  onBack?: () => void;
}

/** Self-serve "Forgot password?" — requests a reset link. The API response is
 * deliberately uniform (no user enumeration); outside production the simulated
 * delivery also returns the link so the flow is exercisable end-to-end. */
export function RequestPasswordResetView({ apiBaseUrl = '', onBack = () => {} }: BaseProps): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sent, setSent] = useState<{ resetUrl?: string | null } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not request a reset link');
      setSent({ resetUrl: data.data?.resetUrl ?? null });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Reset your password</h1>
        {sent ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800" role="status">
              If an account exists for {email}, a reset link is on its way. It expires in 30 minutes.
            </div>
            {sent.resetUrl && (
              <p className="text-xs text-slate-500">
                Simulated delivery — your reset link:{' '}
                <a href={sent.resetUrl} className="font-semibold text-brand-600 hover:underline break-all">
                  {sent.resetUrl}
                </a>
              </p>
            )}
            <button onClick={onBack} className="text-sm font-semibold text-brand-600 hover:text-brand-700 min-h-[44px]">
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">
              Enter your account email and we will send you a one-time reset link.
            </p>
            {errorMessage && (
              <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700" role="alert">
                {errorMessage}
              </div>
            )}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="reset-email" className={labelCls}>Email address</label>
                <input id="reset-email" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} className={inputCls}
                  placeholder="you@company.co.ke" autoComplete="email" />
              </div>
              <button type="submit" disabled={isLoading}
                className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 min-h-[44px]">
                {isLoading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <button onClick={onBack} className="mt-4 text-sm font-semibold text-slate-600 hover:text-slate-900 min-h-[44px]">
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Consumes a `?reset=<token>` link and sets a new password (single-use). */
export function ResetPasswordView({ token, apiBaseUrl = '', onDone }: BaseProps & { token: string; onDone: () => void }): React.JSX.Element {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (password !== confirm) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not reset password');
      setDone(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Choose a new password</h1>
        {done ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800" role="status">
              Password updated. All previous sessions were signed out — sign in with your new password.
            </div>
            <button onClick={onDone} className="text-sm font-semibold text-brand-600 hover:text-brand-700 min-h-[44px]">
              Back to sign in
            </button>
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
                <label htmlFor="new-password" className={labelCls}>New password</label>
                <input id="new-password" type="password" required minLength={8} value={password}
                  onChange={(e) => setPassword(e.target.value)} className={inputCls}
                  placeholder="At least 8 characters" autoComplete="new-password" />
              </div>
              <div>
                <label htmlFor="confirm-password" className={labelCls}>Confirm new password</label>
                <input id="confirm-password" type="password" required minLength={8} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} className={inputCls}
                  autoComplete="new-password" />
              </div>
              <button type="submit" disabled={isLoading}
                className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 min-h-[44px]">
                {isLoading ? 'Updating…' : 'Update password'}
              </button>
            </form>
            <button onClick={onDone} className="mt-4 text-sm font-semibold text-slate-600 hover:text-slate-900 min-h-[44px]">
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Consumes a `?verify=<token>` link issued after signup/invite acceptance. */
export function VerifyEmailView({ token, apiBaseUrl = '', onDone }: BaseProps & { token: string; onDone: () => void }): React.JSX.Element {
  const [state, setState] = useState<'working' | 'ok' | 'error'>('working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBaseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setState('ok');
        } else {
          setState('error');
          setMessage(data.message || 'This verification link is invalid or has expired.');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState('error');
          setMessage('Could not reach the server. Try again later.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, apiBaseUrl]);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-center">
        <h1 className="text-xl font-bold text-slate-900">Email verification</h1>
        {state === 'working' && <p className="mt-3 text-sm text-slate-600">Verifying your email address…</p>}
        {state === 'ok' && (
          <>
            <div className="mt-4 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800" role="status">
              Your email is verified — you can now sign in.
            </div>
            <button onClick={onDone} className="mt-4 text-sm font-semibold text-brand-600 hover:text-brand-700 min-h-[44px]">
              Continue to sign in
            </button>
          </>
        )}
        {state === 'error' && (
          <>
            <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700" role="alert">
              {message}
            </div>
            <button onClick={onDone} className="mt-4 text-sm font-semibold text-brand-600 hover:text-brand-700 min-h-[44px]">
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
