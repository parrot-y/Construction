import React, { useState } from 'react';
import { AuthSession } from '../types/auth';

interface LoginFormProps {
  onLoginSuccess: (session: AuthSession) => void;
  apiBaseUrl?: string;
}

const DEMO_ACCOUNTS = [
  { label: 'Admin (Mwangi)', email: 'admin@apexbuilders.co.ke', role: 'COMPANY_ADMIN', badge: 'bg-blue-100 text-blue-800' },
  { label: 'PM / QS (Faith)', email: 'qs@apexbuilders.co.ke', role: 'PM_QS', badge: 'bg-purple-100 text-purple-800' },
  { label: 'Supervisor (John)', email: 'supervisor@apexbuilders.co.ke', role: 'SITE_SUPERVISOR', badge: 'bg-amber-100 text-amber-800' },
  { label: 'Client (David)', email: 'client@apexbuilders.co.ke', role: 'CLIENT', badge: 'bg-emerald-100 text-emerald-800' },
];

export default function LoginForm({ onLoginSuccess, apiBaseUrl = '' }: LoginFormProps): React.JSX.Element {
  const [email, setEmail] = useState('admin@apexbuilders.co.ke');
  const [password, setPassword] = useState('Password123!');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed. Please check your credentials.');
      }

      onLoginSuccess(data as AuthSession);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected authentication error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setErrorMessage(null);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-md border border-slate-200 p-6 sm:p-8">
      <div className="mb-6 text-center">
        <span className="inline-block text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full mb-2">
          Milestone M1 • Walking Skeleton
        </span>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Apex Builders Kenya
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Sign in to access your project workspace
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start space-x-2"
        >
          <span className="font-semibold">Error:</span>
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. admin@apexbuilders.co.ke"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Verifying Credentials...' : 'Sign In to Workspace'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-100">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-center mb-3">
          Quick Demo Roles (V1 Matrix)
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => handleSelectDemo(d.email)}
              className="text-left p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition flex flex-col justify-between"
            >
              <span className="text-xs font-medium text-slate-800">{d.label}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded mt-1 inline-block w-fit ${d.badge}`}>
                {d.role}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
