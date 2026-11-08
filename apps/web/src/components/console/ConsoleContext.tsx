import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthSession } from '../../types/auth';
import { getRoleNav, RoleNav } from './navConfig';

export interface ProjectOpt { id: string; name: string; code: string; status?: string; location?: string; original_contract_sum?: number | string; contract_currency?: string }

interface ConsoleCtx {
  session: AuthSession;
  role: string;
  roleLabel: string;
  nav: RoleNav;
  projects: ProjectOpt[];
  projectId: string;
  setProjectId: (id: string) => void;
  currency: 'KES' | 'USD';
  setCurrency: (c: 'KES' | 'USD') => void;
  section: string;
  setSection: (s: string) => void;
  tab: string;
  setTab: (t: string) => void;
  aiOpen: boolean;
  setAiOpen: (v: boolean) => void;
  newMenuOpen: boolean;
  setNewMenuOpen: (v: boolean) => void;
  dark: boolean;
  toggleDark: () => void;
  portalPreview: { type: string; token: string; name: string; role?: string } | null;
  setPortalPreview: (v: { type: string; token: string; name: string; role?: string } | null) => void;
}

const Ctx = createContext<ConsoleCtx | null>(null);
export const useConsole = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useConsole outside provider');
  return c;
};

const ROLE_LABELS: Record<string, string> = {
  COMPANY_ADMIN: 'Company Admin', ADMIN: 'Admin', EXECUTIVE: 'Executive',
  PM_QS: 'Project Manager', SUPERINTENDENT: 'Superintendent',
  SITE_SUPERVISOR: 'Site Supervisor', SITE_ENGINEER: 'Site Engineer',
  TRADE_LEAD: 'Trade Lead', FOREMAN: 'Foreman', WORKER: 'Worker',
  VIEWER: 'Viewer', CLIENT: 'Client', CONSULTANT: 'Consultant',
  SUBCONTRACTOR: 'Subcontractor', SUPPLIER: 'Supplier', COMPLIANCE: 'Compliance',
};

export function ConsoleProvider({ session, children }: { session: AuthSession; children: React.ReactNode }) {
  const role = session.user.role;
  const nav = getRoleNav(role);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [projectId, setProjectId] = useState('');
  const [currency, setCurrencyState] = useState<'KES' | 'USD'>('KES');
  const [section, setSection] = useState<string>('home');
  const [tab, setTab] = useState<string>('');
  const [aiOpen, setAiOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [portalPreview, setPortalPreview] = useState<{ type: string; token: string; name: string; role?: string } | null>(null);

  useEffect(() => {
    fetch('/api/v1/projects', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => {
        const list = (j.data || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code, status: p.status, location: p.location, original_contract_sum: p.original_contract_sum, contract_currency: p.contract_currency }));
        setProjects(list);
        if (list.length && !projectId) setProjectId(list[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('sitesafi-currency');
    if (stored === 'KES' || stored === 'USD') setCurrencyState(stored);
    if (localStorage.getItem('sitesafi-dark') === '1') {
      setDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const setCurrency = (c: 'KES' | 'USD') => {
    setCurrencyState(c);
    localStorage.setItem('sitesafi-currency', c);
  };
  const toggleDark = () => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('sitesafi-dark', next ? '1' : '0');
      return next;
    });
  };

  // when section changes, default tab = first allowed tab
  useEffect(() => {
    if (section === 'home') {
      const first = nav.homeTabs?.[0];
      setTab(first || 'dashboard');
      return;
    }
    const def = nav.sections.find((s) => s.id === section);
    setTab(def?.tabs?.[0] || '');
  }, [section, nav]);

  const value: ConsoleCtx = {
    session, role, roleLabel: ROLE_LABELS[role] || role,
    nav, projects, projectId, setProjectId, currency, setCurrency,
    section, setSection, tab, setTab, aiOpen, setAiOpen,
    newMenuOpen, setNewMenuOpen, dark, toggleDark,
    portalPreview, setPortalPreview,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
