import React, { Suspense, useEffect, useRef, useState} from 'react';
import { lazyChunk, warmChunk } from '../../lib/lazyChunk';
import { ConsoleProvider, useConsole} from './ConsoleContext';
import { projectTypeCategory } from '@construction/validation';
import { SECTION_LABELS, SUBTAB_LABELS, type ConsoleSection} from './navConfig';
import { statusLabel } from '../../lib/status-labels';
import ReportProblemModal from '../ReportProblemModal';
import { SECTION_ICONS, iconFor, IconSpark, IconSearch, IconPlus, IconBell, IconSettings, IconHelp, IconDots, IconChevron} from './icons';
import SessionsModal from './SessionsModal';
import MyAccessModal from '../MyAccessModal';
const ConsultantPortalView = lazyChunk(() => import('../portals/ConsultantPortalView'));
const SubcontractorPortalView = lazyChunk(() => import('../portals/SubcontractorPortalView'));
const SupplierPortalView = lazyChunk(() => import('../portals/SupplierPortalView'));
const CompliancePortalView = lazyChunk(() => import('../portals/CompliancePortalView'));

// Skeleton rows — sections lazy-load on navigation; a skeleton keeps the
// layout stable (no blank-page spinner, no layout jump when data lands).
const SectionFallback = (
<div className="space-y-3" aria-busy="true" aria-label="Loading section">
<div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
<div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
<div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
<div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
</div>
);

const HomeSection = lazyChunk(() => import('./sections/HomeSection'));
const ProjectsSection = lazyChunk(() => import('./sections/ProjectsSection'));
const SiteSection = lazyChunk(() => import('./sections/SiteSection'));
const MoneySection = lazyChunk(() => import('./sections/MoneySection'));
const PeopleSection = lazyChunk(() => import('./sections/PeopleSection'));
const FilesSection = lazyChunk(() => import('./sections/FilesSection'));
const AskAiPanel = lazyChunk(() => import('./AskAiPanel'));
import OfflineSyncBanner from '../OfflineSyncBanner';

import { AuthSession} from '../../types/auth';
import { api } from '../../lib/api';
import AppErrorBoundary from '../AppErrorBoundary';

function TopBar({ onLogout}: { onLogout?: () => void}): React.JSX.Element {
  const { session, roleLabel, projects, members, projectId, setProjectId, currency, setCurrency, setAiOpen, newMenuOpen, setNewMenuOpen, setSection, setTab} = useConsole();
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [q, setQ] = useState('');
  const [userMenu, setUserMenu] = useState(false);
  const [projMenu, setProjMenu] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const canSeeAccess = ['COMPANY_ADMIN', 'ADMIN'].includes(session.user.role);

  useEffect(() => {
    if (mobileSearch) searchRef.current?.focus();
  }, [mobileSearch]);

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
<header className="sticky top-0 z-30 h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 px-3 sm:gap-3 sm:px-4">
<div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 shrink-0">
<span className="hidden sm:inline">Viewing as</span>
<span className="hidden sm:inline font-bold text-slate-800 dark:text-slate-200">{roleLabel}</span>
</div>

      {projects.length > 0 && (<>
        {/* Phone: compact picker — truncated name with ellipsis + status. */}
        <div className="sm:hidden relative min-w-0">
          <button
            onClick={() => setProjMenu((v) => !v)}
            aria-label="Active project"
            aria-expanded={projMenu}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 w-full max-w-[168px]"
          >
            <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
              {(() => { const s = projects.find((p) => p.id === projectId); return s ? `${s.name}` : ''; })()}
            </span>
            <IconChevron className={`w-3.5 h-3.5 shrink-0 text-slate-500 transition-transform ${projMenu ? 'rotate-180' : ''}`} />
          </button>
          {projMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProjMenu(false)} />
              <div className="absolute left-0 mt-1.5 w-64 max-w-[80vw] rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl z-50 dark:border-slate-800 dark:bg-slate-900" role="listbox" aria-label="Choose project">
                {projects.map((p) => {
                  const cat = projectTypeCategory(p.project_type);
                  return (
                    <button
                      key={p.id}
                      role="option"
                      aria-selected={p.id === projectId}
                      onClick={() => { setProjectId(p.id); setProjMenu(false); }}
                      className={`block w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800 ${p.id === projectId ? 'bg-orange-50 dark:bg-orange-950/30' : ''}`}
                    >
                      <span className="block truncate font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                      <span className="block truncate text-slate-500">{p.code}{cat ? ` · ${cat.label}` : ''}{p.status ? ` · ${statusLabel(p.status)}` : ''}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          aria-label="Active project"
          title={projects.find((p) => p.id === projectId)?.name}
          className="hidden sm:block border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold max-w-[180px] lg:max-w-[220px]"
        >
          {projects.map((p) => {
            const cat = projectTypeCategory(p.project_type);
            return <option key={p.id} value={p.id}>{p.code} — {p.name}{cat ? ` · ${cat.label}` : ''}</option>;
          })}
</select>
      </>)}
      {(() => { const sel = projects.find((p) => p.id === projectId); return sel?.status ? (
<span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">{statusLabel(sel.status)}</span>
) : null; })()}

{!mobileSearch && (
<button
            onClick={() => setMobileSearch(true)}
            aria-label="Open search"
            className="sm:hidden w-11 h-11 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
<IconSearch className="w-5 h-5" />
</button>
)}
<div className={`${mobileSearch ? 'block' : 'hidden'} sm:block flex-1 min-w-0 max-w-md mx-auto relative`}>
<div className="relative">
<IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
<input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); setMobileSearch(false); (e.target as HTMLInputElement).blur(); } }}
            placeholder="Search projects, change orders and people"
            aria-label="Search workspace"
            className="w-full pl-9 pr-14 py-2 text-base sm:text-sm bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-slate-900 dark:text-slate-100"
          />
<kbd className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">Ctrl K</kbd>
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
<button key={p.id} onClick={() => { setProjectId(p.id); setQ(''); setSearchOpen(false); setMobileSearch(false);}}
                        className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
<span className="font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
<span className="ml-2 text-xs text-slate-500 font-mono tabular-nums">{p.code} · project</span>
</button>
))}
                    {memberHits.map((m: any) => (
<button key={m.membershipId || m.user?.email} onClick={() => { setSection('people'); setTab('team'); setQ(''); setSearchOpen(false); setMobileSearch(false);}}
                        className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
<span className="font-bold text-slate-800 dark:text-slate-200">{m.user?.full_name || m.user?.email}</span>
<span className="ml-2 text-xs text-slate-500">{m.role} · person</span>
</button>
))}
                    {secHits.map((sec) => (
<button key={sec} onClick={() => { setSection(sec as ConsoleSection); setQ(''); setSearchOpen(false); setMobileSearch(false);}}
                        className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
<span className="font-bold text-slate-800 dark:text-slate-200">Go to {SECTION_LABELS[sec as ConsoleSection]}</span>
<span className="ml-2 text-xs text-slate-500">section</span>
</button>
))}
                    {projHits.length === 0 && memberHits.length === 0 && secHits.length === 0 && (
<p className="px-4 py-3 text-xs text-slate-500">No matches for “{q}”.</p>
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
          className="hidden sm:block px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          {currency}
</button>

<div className="relative">
<button
            onClick={() => setNewMenuOpen(!newMenuOpen)}
            aria-label="Create new"
            className="px-2 py-1.5 sm:px-3 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-1"
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
<p className="text-xs text-slate-500">{user.email} · {roleLabel}</p>
</div>
<button onClick={() => { setUserMenu(false); setReportOpen(true);}}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                  Report a problem
</button>
<button onClick={() => { setUserMenu(false); setSessionsOpen(true);}}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                  Active sessions
</button>
                {canSeeAccess && (
<button onClick={() => { setUserMenu(false); setAccessOpen(true);}}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    My access
</button>
)}
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
      {accessOpen &&<MyAccessModal open={accessOpen} onClose={() => setAccessOpen(false)} session={session} />}
      {reportOpen &&<ReportProblemModal onClose={() => setReportOpen(false)} />}
</header>
);
}

// Roles holding cost.approve see a badge on the Money nav item when
// provider payments are waiting for review (G1).
const REVIEW_BADGE_ROLES = new Set(['ADMIN', 'COMPANY_ADMIN', 'PM_QS', 'EXECUTIVE', 'SUPERINTENDENT']);

function useReviewCount(): number {
  const { session } = useConsole();
  const [reviewCount, setReviewCount] = useState(0);
  useEffect(() => {
    if (!REVIEW_BADGE_ROLES.has(session.user.role)) { setReviewCount(0); return; }
    let alive = true;
    api.get<{ data?: any[] }>('/api/v1/payments/charges/review')
      .then((j) => { if (alive) setReviewCount((j.data || []).length); })
      .catch(() => {
        // intentionally ignored: badge count stays hidden on failure
      });
    return () => { alive = false; };
  }, [session.user.role]);
  return reviewCount;
}

/** Tabs shown under the active section — home uses homeTabs, sections use
 *  their role-filtered tab list. ONE tab level, per DESIGN.md §4. */
function tabsForSection(nav: any, section: string): { id: string; label: string }[] {
  if (section === 'home') {
    return (nav.homeTabs || []).map((t: string) => ({ id: t, label: SUBTAB_LABELS[t] || t }));
  }
  const def = nav.sections.find((s: any) => s.id === section);
  return (def?.tabs || []).map((t: string) => ({ id: t, label: SUBTAB_LABELS[t] || t }));
}

function NavEntries({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }): React.JSX.Element {
  const { nav, section, tab, setSection, setTab, setAiOpen} = useConsole();
  const reviewCount = useReviewCount();
  const goSection = (id: string) => { setSection(id as ConsoleSection); onNavigate?.(); };
  const goTab = (sec: string, t: string) => { setSection(sec as ConsoleSection); setTab(t); onNavigate?.(); };

  const sectionBtn = (id: ConsoleSection | 'home', label: string, active: boolean, badge = 0) => {
    // A section's tabs expand directly beneath THAT item — only the active
    // section shows them (one tab level, DOM-adjacent to its parent).
    const rawTabs = active && !compact ? tabsForSection(nav, id) : [];
    const tabs = id === 'home' && (nav.homeTabs || []).length <= 1 ? [] : rawTabs;
    return (
      <React.Fragment key={id}>
        <button
          onClick={() => goSection(id)}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          title={compact ? label : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            compact ? 'justify-center w-10 h-10 mx-auto' : 'w-full'
          } ${active
            ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          <span className="relative shrink-0">
            {React.createElement(id === 'home' ? SECTION_ICONS.home : iconFor(id), { className: 'w-5 h-5' })}
            {badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center" aria-label={`${badge} payments to review`}>
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </span>
          {!compact && <span className="truncate">{label}</span>}
        </button>
        {tabs.length > 0 && (
          <div className="mt-0.5 ml-4 border-l-2 border-slate-200 pl-2 dark:border-slate-700">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => goTab(id, t.id)}
                className={`block w-full rounded-md px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                  tab === t.id
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Workspace sections">
      <button
        onClick={() => { setAiOpen(true); onNavigate?.(); }}
        aria-label="Ask product AI"
        title={compact ? 'Ask AI' : undefined}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 ${compact ? 'justify-center w-10 h-10 mx-auto' : 'w-full'}`}
      >
        <IconSpark className="w-5 h-5 shrink-0" />
        {!compact && <span>Ask AI</span>}
      </button>
      {sectionBtn('home', 'Home', section === 'home')}
      {nav.sections.map((s) => sectionBtn(s.id, s.label, section === s.id, s.id === 'money' ? reviewCount : 0))}
    </nav>
  );
}

/** Desktop sidebar — 240 px labelled, collapses to icons, choice remembered. */
function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }): React.JSX.Element {
  const { session, currency, setCurrency, roleLabel } = useConsole();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const canSeeAccess = ['COMPANY_ADMIN', 'ADMIN'].includes(session.user.role);
  const user = session.user;
  const initials = (user.fullName || user.email || '?').split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      <aside
        className={`hidden sm:flex fixed inset-y-0 left-0 z-40 flex-col border-r border-slate-200 bg-white transition-[width] dark:border-slate-800 dark:bg-slate-900 ${collapsed ? 'w-16' : 'w-60'}`}
        aria-label="Workspace navigation"
      >
        <div className={`flex h-14 items-center border-b border-slate-100 px-3 dark:border-slate-800 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">SiteSafi</span>}
          <button
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <IconChevron className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto py-3 ${collapsed ? 'px-2' : 'px-3'}`}>
          <NavEntries compact={collapsed} />
        </div>

        <div className={`border-t border-slate-100 p-2 dark:border-slate-800 ${collapsed ? 'flex flex-col items-center gap-1' : ''}`}>
          {!collapsed && (
            <div className="mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">{initials}</span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{user.fullName || user.email}</p>
                <p className="truncate text-xs text-slate-500">{roleLabel}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setReportOpen(true)}
            aria-label="Help — report a problem"
            title={collapsed ? 'Help' : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'w-full'}`}
          >
            <IconHelp className="w-4 h-4 shrink-0" />{!collapsed && <span>Help</span>}
          </button>
          <div className="relative">
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              aria-label="Settings"
              aria-expanded={settingsOpen}
              title={collapsed ? 'Settings' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 ${collapsed ? 'justify-center' : ''}`}
            >
              <IconSettings className="w-4 h-4 shrink-0" />{!collapsed && <span>Settings</span>}
            </button>
            {settingsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                <div className="absolute bottom-0 left-full z-50 ml-2 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-100 px-4 py-2 dark:border-slate-800">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Display currency</p>
                    <div className="mt-1.5 flex gap-1">
                      {(['KES', 'USD'] as const).map((c) => (
                        <button key={c} onClick={() => { if (currency !== c) setCurrency(c); setSettingsOpen(false); }} aria-pressed={currency === c}
                          className={`flex-1 rounded-md px-2 py-1 text-xs font-bold ${currency === c ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => { setSettingsOpen(false); setSessionsOpen(true); }} className="block w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Active sessions</button>
                  {canSeeAccess && (
                    <button onClick={() => { setSettingsOpen(false); setAccessOpen(true); }} className="block w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">My access</button>
                  )}
                  <button onClick={() => { setSettingsOpen(false); setReportOpen(true); }} className="block w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Report a problem</button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>
      {reportOpen && <ReportProblemModal onClose={() => setReportOpen(false)} />}
      {sessionsOpen && <SessionsModal onClose={() => setSessionsOpen(false)} />}
      {accessOpen && <MyAccessModal open={accessOpen} onClose={() => setAccessOpen(false)} session={session} />}
    </>
  );
}

/** Phone bottom bar — Home, first sections, More. 56 px + safe-area. */
function MobileNav(): React.JSX.Element {
  const { nav, section, setSection, setTab, setAiOpen} = useConsole();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = nav.sections.slice(0, 3);
  const overflow = nav.sections.slice(3);
  const itemCls = (active: boolean) => `flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-bold ${active ? 'text-orange-600' : 'text-slate-500 dark:text-slate-400'}`;
  const icon = (id: string, cls = 'w-5 h-5') => React.createElement(id === 'home' ? SECTION_ICONS.home : iconFor(id), { className: cls });

  return (
    <>
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 flex h-14 items-stretch border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900" aria-label="Workspace sections">
        <button onClick={() => setSection('home')} aria-current={section === 'home' ? 'page' : undefined} className={itemCls(section === 'home')}>
          {icon('home')}<span>Home</span>
        </button>
        {primary.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)} aria-current={section === s.id ? 'page' : undefined} className={itemCls(section === s.id)}>
            {icon(s.id)}<span className="truncate">{s.label.split(' ')[0]}</span>
          </button>
        ))}
        <button onClick={() => setMoreOpen(true)} aria-expanded={moreOpen} aria-label="More sections" className={itemCls(moreOpen)}>
          <IconDots className="w-5 h-5" /><span>More</span>
        </button>
      </nav>
      {moreOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40" onClick={() => setMoreOpen(false)}>
          <div className="rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
            <nav className="grid gap-1" aria-label="All sections">
              <button onClick={() => { setAiOpen(true); setMoreOpen(false); }} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                <IconSpark className="w-5 h-5" /> Ask AI
              </button>
              {overflow.map((s) => (
                <button key={s.id} onClick={() => { setSection(s.id); setMoreOpen(false); }} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                  {icon(s.id)} {s.label}
                </button>
              ))}
              {nav.homeTabs && nav.homeTabs.length > 1 && section === 'home' && null}
              <button onClick={() => { setSection('home'); setTab('inbox'); setMoreOpen(false); }} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                {icon('home')} Inbox
              </button>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

function SubNav(): React.JSX.Element | null {
  const { nav, section, tab, setTab, projects, projectId} = useConsole();
  // Desktop tabs live inside the sidebar (one tab level). On phone the tab
  // row is a single horizontally scrolling strip with an edge fade.
  const homeTabs = section === 'home' ? nav.homeTabs : undefined;
  const def = section === 'home' ? null : nav.sections.find((s) => s.id === section);
  const tabs = section === 'home'
    ? (homeTabs && homeTabs.length > 1 ? homeTabs.map((t) => ({ id: t, label: SUBTAB_LABELS[t] || t })) : [])
    : (def?.tabs && def.tabs.length > 1 ? def.tabs.map((t) => ({ id: t, label: SUBTAB_LABELS[t] || t })) : []);
  if (tabs.length === 0) return null;
  const sel = projects.find((p) => p.id === projectId);
  const pname = sel?.name;
  return (
<div>
<div
        className="sm:hidden flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: 'linear-gradient(to right, black 88%, transparent)' }}
        role="tablist"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-bold whitespace-nowrap transition ${tab === t.id ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {pname &&<p className="text-xs text-slate-500 mt-1">Context: {pname}</p>}
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sitesafi-sidebar') === '1'; } catch { return false; }
  });
  const toggleSidebar = () => setSidebarCollapsed((c) => {
    try { localStorage.setItem('sitesafi-sidebar', c ? '0' : '1'); } catch { /* storage unavailable */ }
    return !c;
  });
  // P1.7 — warm the lazy section chunks once the shell is idle so sidebar
  // navigation doesn't pay a dynamic-import round trip on throttled links.
  useEffect(() => {
    const warm = () => {
      warmChunk(() => import('./sections/HomeSection'));
      warmChunk(() => import('./sections/ProjectsSection'));
      warmChunk(() => import('./sections/SiteSection'));
      warmChunk(() => import('./sections/MoneySection'));
      warmChunk(() => import('./sections/PeopleSection'));
      warmChunk(() => import('./sections/FilesSection'));
    };
    const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
    if (ric) {
      const id = ric(warm, { timeout: 4000 });
      return () => (window as any).cancelIdleCallback?.(id);
    }
    const t = setTimeout(warm, 1500);
    return () => clearTimeout(t);
  }, []);
  if (portalPreview) return<PortalPreview />;
  return (
<div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
<Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
<MobileNav />
<div className={`${sidebarCollapsed ? 'sm:pl-16' : 'sm:pl-60'} pb-20 sm:pb-0 flex flex-col min-h-screen`}>
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
