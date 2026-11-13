import React, { Suspense, lazy, useEffect, useRef, useState} from 'react';
import { ConsoleProvider, useConsole} from './ConsoleContext';
import { SECTION_LABELS, SUBTAB_LABELS, type ConsoleSection} from './navConfig';
import ReportProblemModal from '../ReportProblemModal';
import { SECTION_ICONS, iconFor, IconSpark, IconSearch, IconPlus, IconBell, IconSun, IconMoon} from './icons';
import SessionsModal from './SessionsModal';
const ConsultantPortalView = lazy(() => import('../portals/ConsultantPortalView'));
const SubcontractorPortalView = lazy(() => import('../portals/SubcontractorPortalView'));
const SupplierPortalView = lazy(() => import('../portals/SupplierPortalView'));
const CompliancePortalView = lazy(() => import('../portals/CompliancePortalView'));

const SectionFallback = <div className="min-h-[40vh] flex items-center justify-center text-sm text-slate-400">Loading…</div>;

const HomeSection = lazy(() => import('./sections/HomeSection'));
const ProjectsSection = lazy(() => import('./sections/ProjectsSection'));
const SiteSection = lazy(() => import('./sections/SiteSection'));
const MoneySection = lazy(() => import('./sections/MoneySection'));
const PeopleSection = lazy(() => import('./sections/PeopleSection'));
const FilesSection = lazy(() => import('./sections/FilesSection'));
const AskAiPanel = lazy(() => import('./AskAiPanel'));
import OfflineSyncBanner from '../OfflineSyncBanner';

import { AuthSession} from '../../types/auth';
import AppErrorBoundary from '../AppErrorBoundary';

function TopBar({ onLogout}: { onLogout?: () => void}): React.JSX.Element {
  const { session, roleLabel, projects, projectId, setProjectId, currency, setCurrency, setAiOpen, newMenuOpen, setNewMenuOpen, dark, toggleDark, setSection, setTab} = useConsole();
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [userMenu, setUserMenu] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    fetch('/api/v1/company/members', { credentials: 'include'})
      .then((r) => (r.ok ? r.json() : { data: []}))
      .then((j) => setMembers(j.data || []))
      .catch(() => {});
}, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
}
};
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
}, []);

  const user = session.user;
  const initials = (user.fullName || user.email || '?').split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  const quickActions = [
    { label: 'Change order', go: () => { setSection('projects'); setTab('changeorders');}},
    { label: 'Project', go: () => { setSection('projects'); setTab('all');}},
    { label: 'Daily log', go: () => { setSection('site'); setTab('dailylog');}},
    { label: 'Schedule activity', go: () => { setSection('projects'); setTab('schedule');}},
  ];

  return (
<header className="sticky top-0 z-30 h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 px-4">
<div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 shrink-0">
<span className="hidden sm:inline">Viewing as</span>
<span className="font-bold text-slate-800 dark:text-slate-200">{roleLabel}</span>
</div>

      {projects.length > 0 && (
<select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label="Active project"
          className="hidden md:block border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold max-w-[220px]"
        >
          {projects.map((p) =><option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
</select>
)}

<div className="flex-1 max-w-md mx-auto relative">
<div className="relative">
<IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
<input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search projects, change orders and people"
            aria-label="Search workspace"
            className="w-full pl-9 pr-14 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-slate-900 dark:text-slate-100"
          />
<kbd className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">Ctrl K</kbd>
</div>
        {searchOpen && q.trim().length > 0 && (
<>
<div className="fixed inset-0 z-40" onClick={() => setSearchOpen(false)} />
<div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto py-1.5">
              {(() => {
                const needle = q.trim().toLowerCase();
                const projHits = projects.filter((p) => (p.name || '').toLowerCase().includes(needle) || (p.code || '').toLowerCase().includes(needle)).slice(0, 5);
                const memberHits = members.filter((m: any) => ((m.user?.full_name || m.user?.email || '') as string).toLowerCase().includes(needle)).slice(0, 5);
                const secHits = ['projects','site','money','people','files'].filter((s) => SECTION_LABELS[s as ConsoleSection].toLowerCase().includes(needle));
                return (
<>
                    {projHits.map((p) => (
<button key={p.id} onClick={() => { setProjectId(p.id); setQ(''); setSearchOpen(false);}}
                        className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
<span className="font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
<span className="ml-2 text-[10px] text-slate-400 font-mono tabular-nums">{p.code} · project</span>
</button>
))}
                    {memberHits.map((m: any) => (
<button key={m.membershipId || m.user?.email} onClick={() => { setSection('people'); setTab('team'); setQ(''); setSearchOpen(false);}}
                        className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
<span className="font-bold text-slate-800 dark:text-slate-200">{m.user?.full_name || m.user?.email}</span>
<span className="ml-2 text-[10px] text-slate-400">{m.role} · person</span>
</button>
))}
                    {secHits.map((sec) => (
<button key={sec} onClick={() => { setSection(sec as ConsoleSection); setQ(''); setSearchOpen(false);}}
                        className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
<span className="font-bold text-slate-800 dark:text-slate-200">Go to {SECTION_LABELS[sec as ConsoleSection]}</span>
<span className="ml-2 text-[10px] text-slate-400">section</span>
</button>
))}
                    {projHits.length === 0 && memberHits.length === 0 && secHits.length === 0 && (
<p className="px-4 py-3 text-xs text-slate-400">No matches for “{q}”.</p>
)}
</>
);
})()}
</div>
</>
)}
</div>

<div className="flex items-center gap-1.5">
<button
          onClick={() => setCurrency(currency === 'KES' ? 'USD' : 'KES')}
          aria-label={`Currency: ${currency}`}
          className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          {currency}
</button>

<div className="relative">
<button
            onClick={() => setNewMenuOpen(!newMenuOpen)}
            aria-label="Create new"
            className="px-3 py-1.5 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-1"
          >
<IconPlus className="w-3.5 h-3.5" /><span className="hidden sm:inline">New</span>
</button>
          {newMenuOpen && (
<>
<div className="fixed inset-0 z-40" onClick={() => setNewMenuOpen(false)} />
<div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1.5">
                {quickActions.map((a) => (
<button key={a.label} onClick={() => { a.go(); setNewMenuOpen(false);}}
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    {a.label}
</button>
))}
</div>
</>
)}
</div>

<button onClick={() => setAiOpen(true)} aria-label="Ask product AI"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white hover:opacity-90">
<IconSpark className="w-3.5 h-3.5" /> Ask AI
</button>

<button
          onClick={() => { setSection('home'); setTab('inbox');}}
          aria-label="Notifications and inbox"
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 relative"
        >
<IconBell className="w-5 h-5" />
</button>
<button onClick={toggleDark} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400">
          {dark ?<IconSun className="w-5 h-5" /> :<IconMoon className="w-5 h-5" />}
</button>

<div className="relative">
<button
            onClick={() => setUserMenu(!userMenu)}
            aria-label="Account menu"
            aria-expanded={userMenu}
            className="w-8 h-8 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center hover:ring-2 hover:ring-orange-400 transition"
            title={`${user.fullName || user.email} · ${roleLabel}`}
          >
            {initials}
</button>
          {userMenu && (
<>
<div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
<div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1.5">
<div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
<p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{user.fullName || user.email}</p>
<p className="text-[10px] text-slate-400">{user.email} · {roleLabel}</p>
</div>
<button onClick={() => { setUserMenu(false); setReportOpen(true);}}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                  Report a problem
</button>
<button onClick={() => { setUserMenu(false); setSessionsOpen(true);}}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                  Active sessions
</button>
                {onLogout && (
<button onClick={onLogout} className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                    Sign out
</button>
)}
</div>
</>
)}
</div>
</div>
      {sessionsOpen &&<SessionsModal onClose={() => setSessionsOpen(false)} />}
      {reportOpen &&<ReportProblemModal onClose={() => setReportOpen(false)} />}
</header>
);
}

function RailItems({ mobile = false}: { mobile?: boolean}): React.JSX.Element {
  const { nav, section, setSection, setAiOpen, session, projects, projectId, setProjectId} = useConsole();
  const cls = mobile
    ? 'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1 text-[9px] font-bold'
    : 'w-11 h-11 rounded-xl flex items-center justify-center';
  const itemCls = (active: boolean) => mobile
    ? `${cls} ${active ? 'text-orange-400' : 'text-slate-400'}`
    : `${cls} transition ${active ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`;
  return (
<>
<button onClick={() => setAiOpen(true)} aria-label="Ask product AI" className={itemCls(false)}>
<IconSpark className="w-5 h-5" />
        {mobile &&<span>AI</span>}
</button>
<button onClick={() => setSection('home')} aria-label="Home" className={itemCls(section === 'home')}>
        {React.createElement(SECTION_ICONS.home, { className: 'w-5 h-5'})}
        {mobile &&<span>Home</span>}
</button>
      {nav.sections.map((s) => {
        const Icon = iconFor(s.id);
        const active = section === s.id;
        return (
<button key={s.id} onClick={() => setSection(s.id)} aria-label={s.label} className={itemCls(active)}>
            {React.createElement(Icon, { className: 'w-5 h-5'})}
            {mobile &&<span className="truncate">{s.label.split(' ')[0]}</span>}
</button>
);
})}
      {!mobile && (
<div className="mt-auto flex flex-col items-center gap-2 pb-1">
          {projects.length > 0 && (
<select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              aria-label="Active project"
              className="w-11 h-11 rounded-xl bg-slate-800 text-orange-300 text-[10px] font-bold border-0 text-center appearance-none cursor-pointer"
              title={projects.find((p) => p.id === projectId)?.name}
            >
              {projects.map((p) =><option key={p.id} value={p.id}>{p.code}</option>)}
</select>
)}
<div className="w-11 h-11 rounded-xl bg-orange-600/20 border border-orange-600/40 text-orange-300 text-xs font-bold flex items-center justify-center" title={session.user.tenant?.name || 'Workspace'}>
            {(session.user.tenant?.name || 'S').slice(0, 1).toUpperCase()}
</div>
</div>
)}
</>
);
}

function Rail(): React.JSX.Element {
  return (
<>
      {/* Desktop icon rail */}
<nav className="hidden sm:flex fixed inset-y-0 left-0 z-40 w-16 bg-slate-950 dark:bg-black flex-col items-center py-3 gap-1" aria-label="Workspace sections">
<RailItems />
</nav>
      {/* Mobile bottom bar */}
<nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950 dark:bg-black border-t border-slate-800 flex items-stretch px-1 pb-[env(safe-area-inset-bottom)]" aria-label="Workspace sections">
<RailItems mobile />
</nav>
</>
);
}

function SubNav(): React.JSX.Element | null {
  const { nav, section, tab, setTab, projects, projectId} = useConsole();
  if (section === 'home') {
    const homeTabs = nav.homeTabs;
    if (!homeTabs || homeTabs.length<= 1) return null;
    return (
<div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist">
        {homeTabs.map((t) => (
<button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${tab === t ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            {SUBTAB_LABELS[t] || t}
</button>
))}
</div>
);
}
  const def = nav.sections.find((s) => s.id === section);
  if (!def || !def.tabs || def.tabs.length<= 1) return null;
  const pname = projects.find((p) => p.id === projectId)?.name;
  return (
<div>
<div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist">
        {def.tabs.map((t) => (
<button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${tab === t ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            {SUBTAB_LABELS[t] || t}
</button>
))}
</div>
      {pname &&<p className="text-[11px] text-slate-400 mt-1">Context: {pname}</p>}
</div>
);
}

function SectionPrompt(): React.JSX.Element | null {
  const { section, projects, projectId} = useConsole();
  const prompts: Record<string, string> = {
    projects: 'Which project can I help with?',
    site: 'What happened on site today?',
    money: 'What would you like to know about money?',
    people: 'Who are you looking for?',
    files: 'What report do you need?',
};
  const pname = projects.find((p) => p.id === projectId)?.name;
  if (section === 'home' || !prompts[section]) return null;
  return (
<div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
<IconSpark className="w-3.5 h-3.5 text-orange-500" />
<span>{prompts[section]}{pname ? ` · ${pname}` : ''}</span>
</div>
);
}

function SectionBody(): React.JSX.Element {
  const { section} = useConsole();
  const wrap = (label: string, el: React.ReactNode) => (
    <AppErrorBoundary key={section} label={`console:${label}`}><Suspense fallback={SectionFallback}>{el}</Suspense></AppErrorBoundary>
  );
  switch (section) {
    case 'projects': return wrap('projects', <ProjectsSection />);
    case 'site': return wrap('site', <SiteSection />);
    case 'money': return wrap('money', <MoneySection />);
    case 'people': return wrap('people', <PeopleSection />);
    case 'files': return wrap('files', <FilesSection />);
    default: return wrap('home', <HomeSection />);
}
}

function PortalPreview(): React.JSX.Element | null {
  const { portalPreview, setPortalPreview} = useConsole();
  if (!portalPreview) return null;
  const back = () => setPortalPreview(null);
  const common = { onBackToDashboard: back};
  const pw = (label: string, el: React.ReactNode) => (
    <AppErrorBoundary label={`portal-preview:${label.toLowerCase()}`}><Suspense fallback={SectionFallback}>{el}</Suspense></AppErrorBoundary>
  );
  switch (portalPreview.type.toUpperCase()) {
    case 'CONSULTANT':
      return pw('CONSULTANT', <ConsultantPortalView token={portalPreview.token} stakeholderName={portalPreview.name} stakeholderRole={portalPreview.role} {...common} />);
    case 'SUBCONTRACTOR':
      return pw('SUBCONTRACTOR', <SubcontractorPortalView token={portalPreview.token} subcontractorName={portalPreview.name} subcontractorTrade={portalPreview.role} {...common} />);
    case 'SUPPLIER':
      return pw('SUPPLIER', <SupplierPortalView token={portalPreview.token} supplierName={portalPreview.name} supplierCategory={portalPreview.role} {...common} />);
    case 'COMPLIANCE':
      return pw('COMPLIANCE', <CompliancePortalView token={portalPreview.token} auditorName={portalPreview.name} auditorAgency={portalPreview.role} {...common} />);
    default:
      return (
<div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-10 text-center text-sm text-slate-500">
          Portal preview for {portalPreview.type} is not available here.
<button onClick={back} className="ml-2 font-bold text-orange-600">Back to workspace</button>
</div>
);
}
}

function Shell({ onLogout}: { onLogout?: () => void}): React.JSX.Element {
  const { section, portalPreview} = useConsole();
  if (portalPreview) return<PortalPreview />;
  return (
<div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
<Rail />
<div className="sm:pl-16 pb-20 sm:pb-0 flex flex-col min-h-screen">
<TopBar onLogout={onLogout} />
<main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 pb-24 sm:pb-5 max-w-[1400px] w-full mx-auto space-y-4">
<OfflineSyncBanner />
<div className="flex items-center justify-between gap-4 flex-wrap">
<h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{SECTION_LABELS[section as keyof typeof SECTION_LABELS] || 'Home'}</h1>
<SectionPrompt />
</div>
<SubNav />
<SectionBody />
</main>
</div>
<Suspense fallback={null}><AskAiPanel /></Suspense>
</div>
);
}

export default function AppShell({ session, onLogout}: { session: AuthSession; onLogout?: () => void}): React.JSX.Element {
  return (
<ConsoleProvider session={session}>
<Shell onLogout={onLogout} />
</ConsoleProvider>
);
}
