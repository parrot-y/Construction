import React, { useState} from 'react';
import { AuthSession} from '../types/auth';
import { PRODUCT_NAME } from '../lib/product';

interface LoginFormProps {
  onLoginSuccess: (session: AuthSession) => void;
  onOpenSignup?: () => void;
  onForgotPassword?: () => void;
  apiBaseUrl?: string;
}

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.DEV === true;

const DEMO_ACCOUNTS = DEMO_MODE ? [
  { label: 'Company Admin', email: 'admin@apexbuilders.co.ke', role: 'COMPANY_ADMIN', badge: 'bg-blue-100 text-blue-800'},
  { label: 'PM / QS', email: 'qs@apexbuilders.co.ke', role: 'PM_QS', badge: 'bg-purple-100 text-purple-800'},
  { label: 'Supervisor', email: 'supervisor@apexbuilders.co.ke', role: 'SITE_SUPERVISOR', badge: 'bg-amber-100 text-amber-800'},
  { label: 'Executive', email: 'executive@apexbuilders.co.ke', role: 'EXECUTIVE', badge: 'bg-indigo-100 text-indigo-800'},
  { label: 'Site Engineer', email: 'engineer@apexbuilders.co.ke', role: 'SITE_ENGINEER', badge: 'bg-orange-100 text-orange-800'},
  { label: 'Client', email: 'client@apexbuilders.co.ke', role: 'CLIENT', badge: 'bg-emerald-100 text-emerald-800'},
] : [];

export default function LoginForm({ onLoginSuccess, onOpenSignup, onForgotPassword, apiBaseUrl = ''}: LoginFormProps): React.JSX.Element {
  const [email, setEmail] = useState(DEMO_MODE ? 'admin@apexbuilders.co.ke' : '');
  const [password, setPassword] = useState(DEMO_MODE ? 'Password123!' : '');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        credentials: 'include',
        body: JSON.stringify({ email, password}),
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
<div className="w-full max-w-4xl mx-auto grid lg:grid-cols-2 gap-0 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Brand panel */}
<div className="hidden lg:flex flex-col justify-between bg-slate-900 text-white p-10 relative overflow-hidden">
<div className="absolute -top-20 -right-20 w-72 h-72 bg-orange-500/15 rounded-full blur-3xl" />
<div className="absolute -bottom-24 -left-16 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl" />
<div className="relative">
<div className="flex items-center gap-3">
<div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white text-xl font-black shadow-lg">
              S
</div>
<div>
<p className="text-lg font-extrabold ">{PRODUCT_NAME}</p>
<p className="text-[11px] text-slate-400 font-medium">Kenya Construction OS</p>
</div>
</div>
</div>
<div className="relative space-y-4">
<h2 className="text-2xl font-extrabold leading-snug">
            Run every site,<br />from one workspace.
</h2>
<p className="text-sm text-slate-400 leading-relaxed">
            BOQs, site diaries, attendance, variations, certificates and client
            portals — built for Kenyan contractors, quantity surveyors and the
            clients who fund them.
</p>
<ul className="space-y-2 text-xs text-slate-300">
<li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" />KES-first money, KRA e-TIMS &amp; M-Pesa ready</li>
<li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" />Offline-capable field app for engineers &amp; foremen</li>
<li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" />Client &amp; stakeholder portals — external guests never consume paid seats</li>
</ul>
</div>
<p className="relative text-[11px] text-slate-500">Sign in to your {PRODUCT_NAME} workspace</p>
</div>

      {/* Form panel */}
<div className="p-6 sm:p-10">
<div className="lg:hidden flex items-center gap-3 mb-6">
<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white text-lg font-black shadow">
            S
</div>
<div>
<p className="text-base font-extrabold text-slate-900">{PRODUCT_NAME}</p>
<p className="text-[11px] text-slate-500">Kenya Construction OS</p>
</div>
</div>

<div className="mb-6">
<h1 className="text-2xl font-bold text-slate-900 ">Sign in</h1>
<p className="text-sm text-slate-500 mt-1">Access your project workspace</p>
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
<label htmlFor="email" className="block text-xs font-semibold text-slate-600 mb-1.5">
              Email address
</label>
<input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.co.ke"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
            />
</div>

<div>
<label htmlFor="password" className="block text-xs font-semibold text-slate-600 mb-1.5">
              Password
</label>
<input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
            />
</div>

<button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in…' : 'Sign in to workspace'}
</button>
{onForgotPassword && (
<button
            type="button"
            onClick={onForgotPassword}
            className="w-full text-center text-xs font-semibold text-slate-500 hover:text-brand-600 transition min-h-[44px] flex items-center justify-center"
          >
            Forgot password?
</button>
)}
</form>

{onOpenSignup && (
<p className="mt-4 text-center text-sm text-slate-600">
            New contractor?{' '}
<button type="button" onClick={onOpenSignup} className="font-semibold text-brand-600 hover:text-brand-700">
              Create your company workspace
</button>
</p>
)}

{DEMO_MODE && (
<div className="mt-8 pt-6 border-t border-slate-100">
<p className="text-xs font-semibold text-slate-500 text-center mb-3">
            Demo workspaces — pick a role
</p>
<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((d) => (
<button
                key={d.email}
                type="button"
                onClick={() => handleSelectDemo(d.email)}
                className="text-left p-2 rounded-lg border border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 transition flex flex-col justify-between"
              >
<span className="text-xs font-medium text-slate-800">{d.label}</span>
<span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded mt-1 inline-block w-fit ${d.badge}`}>
                  {d.role}
</span>
</button>
))}
</div>
</div>
)}
</div>
</div>
);
}
