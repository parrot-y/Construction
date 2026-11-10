import React from 'react';
import { Button} from '../ui';

export interface LandingPortalHubProps {
  onSelectRolePreview: (role: string) => void;
  onOpenLogin: () => void;
  onOpenSignup?: () => void;
}

/**
 * Public landing page — plain, specific copy about what Site Safi does for
 * Kenyan contractors. No invented stats, no emoji, no gradient hero.
 * Role-preview buttons are developer-only (rendered only in dev builds).
 */
export default function LandingPortalHub({
  onSelectRolePreview,
  onOpenLogin,
  onOpenSignup,
}: LandingPortalHubProps): React.JSX.Element {
  const isDev = import.meta.env.VITE_DEMO_MODE === 'true';

  const capabilities = [
    {
      title: 'Sites & daily records',
      body: 'Daily site diaries, attendance, material deliveries, plant logs and photo evidence — the record of what actually happened on site.',
},
    {
      title: 'Money that reconciles',
      body: 'BOQ takeoff, budgets, cost entries, interim payment certificates, invoices, retentions and variations in one ledger — in KES.',
},
    {
      title: 'Clients stay informed',
      body: 'A client portal with live progress, photos, certificates and variation approvals — no more"how is the project going?" calls.',
},
    {
      title: 'Teams on the same page',
      body: 'Role-based workspaces for PMs, quantity surveyors, supervisors, engineers, subcontractors, suppliers and compliance officers.',
},
  ];

  const roles = [
    'Company Admin', 'PM / QS', 'Site Supervisor', 'Executive',
    'Site Engineer', 'Architect', 'QA/QC', 'Owner',
    'Trade Lead', 'Foreman', 'Worker', 'Viewer', 'Client',
  ];

  return (
<div className="w-full max-w-5xl mx-auto px-4 py-8 sm:py-12 space-y-10">
      {/* Nav */}
<nav className="flex items-center justify-between">
<div className="flex items-center gap-2.5">
<div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white font-black text-lg">S</div>
<span className="text-lg font-extrabold text-slate-900 dark:text-slate-100">Site Safi</span>
</div>
<Button variant="primary" size="sm" onClick={onOpenLogin}>Sign in</Button>
</nav>

      {/* Hero — plain, no gradient, no invented stats */}
<header className="max-w-2xl space-y-5">
<h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
          Run your construction sites from one place.
</h1>
<p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          Site Safi is a Kenya-first construction management platform. It keeps daily site
          records, budgets, certificates, invoices and client communication in one system —
          so contractors stop losing money to missing paperwork and clients stop guessing
          what is happening on their sites.
</p>
<div className="flex flex-wrap gap-3">
<Button variant="primary" size="md" onClick={onOpenLogin}>Sign in to your workspace</Button>
{onOpenSignup && (
<Button variant="secondary" size="md" onClick={onOpenSignup}>Create company workspace</Button>
)}
<Button variant="secondary" size="md" onClick={() => document.getElementById('product')?.scrollIntoView({ behavior: 'smooth'})}>
            See what it does
</Button>
</div>
</header>

      {/* Real product screenshots */}
<section id="product" className="space-y-4">
<h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">The console</h2>
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
<figure className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-900">
<img src="/screenshots/console-desktop.png" alt="Site Safi contractor console on desktop" className="w-full h-auto" loading="lazy" />
<figcaption className="px-3 py-2 text-xs text-slate-500">Contractor workspace — projects, site, money, people and files.</figcaption>
</figure>
<figure className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-900">
<img src="/screenshots/console-mobile.png" alt="Site Safi console on a phone" className="w-full h-auto max-h-[480px] object-cover object-top" loading="lazy" />
<figcaption className="px-3 py-2 text-xs text-slate-500">Same workspace on mobile — built for supervisors in the field.</figcaption>
</figure>
</div>
</section>

      {/* Capabilities */}
<section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {capabilities.map((c) => (
<div key={c.title} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-5">
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{c.title}</h3>
<p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{c.body}</p>
</div>
))}
</section>

      {/* Roles */}
<section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-5">
<h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">One login per role</h2>
<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Every person on a project gets a workspace matched to their job — {roles.length} roles covered.
</p>
<div className="flex flex-wrap gap-1.5 mt-3">
          {roles.map((r) => (
<span key={r} className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">{r}</span>
))}
</div>
</section>

      {/* Honest integration status */}
<section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-5">
<h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Integrations</h2>
<p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          M-Pesa, WhatsApp, SMS and email providers are pluggable. Until live credentials are
          configured, payment and messaging flows are clearly marked<strong>SIMULATED</strong> —
          nothing pretends to have sent or settled anything it hasn't.
</p>
</section>

      {/* Dev-only role previews */}
      {isDev && (
<section className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4">
<p className="text-[11px] font-bold text-slate-400 ">Developer only</p>
<div className="flex flex-wrap gap-2 mt-2">
            {['COMPANY_ADMIN', 'PM_QS', 'SITE_SUPERVISOR', 'EXECUTIVE', 'CLIENT'].map((r) => (
<button
                key={r}
                onClick={() => onSelectRolePreview(r)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Preview {r.replace(/_/g, ' ')}
</button>
))}
</div>
</section>
)}

<footer className="text-xs text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-800">
        Site Safi — built for Kenyan contractors.
</footer>
</div>
);
}
