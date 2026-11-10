import React, { useState } from 'react';
import { AuthSession } from '../types/auth';

interface SignupFormProps {
  onLoginSuccess: (session: AuthSession) => void;
  apiBaseUrl?: string;
}

export default function SignupForm({ onLoginSuccess, apiBaseUrl = '' }: SignupFormProps): React.JSX.Element {
  const [companyName, setCompanyName] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/register-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ companyName, adminFullName, email, phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed. Please try again.');
      }
      // Registration does not issue a session — sign in through the normal flow.
      const loginRes = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const session = await loginRes.json();
      if (!loginRes.ok) {
        throw new Error('Account created — please sign in.');
      }
      onLoginSuccess(session as AuthSession);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls =
    'w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 min-h-[44px]';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Create your company workspace</h1>
        <p className="mt-1 text-sm text-slate-600">
          Set up your contracting company on Site Safi. You will be the company admin.
        </p>
        {errorMessage && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700" role="alert">
            {errorMessage}
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="company-name" className={labelCls}>Company name</label>
            <input id="company-name" type="text" required minLength={2} value={companyName}
              onChange={(e) => setCompanyName(e.target.value)} className={inputCls}
              placeholder="e.g.Mwangi & Sons Contractors Ltd" autoComplete="organization" />
          </div>
          <div>
            <label htmlFor="admin-name" className={labelCls}>Your full name</label>
            <input id="admin-name" type="text" required minLength={2} value={adminFullName}
              onChange={(e) => setAdminFullName(e.target.value)} className={inputCls}
              placeholder="e.g. James Mwangi" autoComplete="name" />
          </div>
          <div>
            <label htmlFor="signup-email" className={labelCls}>Work email</label>
            <input id="signup-email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className={inputCls}
              placeholder="you@company.co.ke" autoComplete="email" />
          </div>
          <div>
            <label htmlFor="signup-phone" className={labelCls}>Phone (optional)</label>
            <input id="signup-phone" type="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)} className={inputCls}
              placeholder="0712 345 678" autoComplete="tel" />
          </div>
          <div>
            <label htmlFor="signup-password" className={labelCls}>Password</label>
            <input id="signup-password" type="password" required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)} className={inputCls}
              placeholder="At least 8 characters" autoComplete="new-password" />
          </div>
          <div>
            <label htmlFor="signup-confirm" className={labelCls}>Confirm password</label>
            <input id="signup-confirm" type="password" required minLength={8} value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls}
              autoComplete="new-password" />
          </div>
          <button type="submit" disabled={isLoading}
            className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 min-h-[44px]">
            {isLoading ? 'Creating workspace…' : 'Create workspace'}
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-500">
          Email and phone verification is not yet enabled — you can sign in immediately after signup.
        </p>
      </div>
    </div>
  );
}
