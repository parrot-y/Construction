import React, { useEffect, useRef, useState } from 'react';
import { useConsole } from './ConsoleContext';
import { IconSend, IconSpark, IconX } from './icons';
import { SUBTAB_LABELS } from './navConfig';

interface Msg { role: 'user' | 'bot'; text: string; link?: { section: string; tab: string; label: string } }

/**
 * Site Safi Assistant — deterministic navigation assistant.
 * Routes intents to the right workspace section. NOT an LLM; clearly
 * labelled so it never pretends to be AI. API-key LLM hookup lands here later.
 */
const INTENTS: { pattern: RegExp; section: string; tab: string; answer: string }[] = [
  { pattern: /daily log|site diary|log.*site/i, section: 'site', tab: 'dailylog', answer: 'Open the daily log to record today\u2019s site work, labour and photos.' },
  { pattern: /punch|snag|defect/i, section: 'site', tab: 'punch', answer: 'The punch list tracks snags from raise to verified close.' },
  { pattern: /checklist/i, section: 'site', tab: 'checklists', answer: 'Checklists and trade assignments live here.' },
  { pattern: /inspection|quality|cube/i, section: 'site', tab: 'inspections', answer: 'Inspections, cube tests and quality records are in this tab.' },
  { pattern: /observ|action plan|corrective/i, section: 'site', tab: 'observations', answer: 'Observations raise corrective actions with owners and due dates.' },
  { pattern: /safety|incident|accident|near miss/i, section: 'site', tab: 'safety', answer: 'The safety register logs incidents, investigations and actions.' },
  { pattern: /attendance|muster|labou?r|worker.*check/i, section: 'site', tab: 'attendance', answer: 'Attendance tracks daily labourer check-in/out and hours.' },
  { pattern: /drawings?|plans?|boq|bill of quantity|schedule|gantt|timeline/i, section: 'projects', tab: 'all', answer: 'Project schedule, drawings vault and BOQ sit under Projects.' },
  { pattern: /variation|change order|\bco\b|claim/i, section: 'projects', tab: 'changeorders', answer: 'Change orders and claims are managed under Projects \u2192 Change orders.' },
  { pattern: /rfi|clarification|coordination/i, section: 'projects', tab: 'coordination', answer: 'RFIs and coordination requests live under Projects \u2192 Coordination.' },
  { pattern: /correspondence|letter|submittal|transmittal|notice/i, section: 'projects', tab: 'correspondence', answer: 'The correspondence log records letters, submittals and notices.' },
  { pattern: /invoice|billing|payment|receivable|\bar\b/i, section: 'money', tab: 'invoices', answer: 'Invoices, payments and receivables are under Money \u2192 Invoices.' },
  { pattern: /quote|estimate|proposal|tender|bid/i, section: 'money', tab: 'quotes', answer: 'Quotes and tender bids are under Money \u2192 Quotes.' },
  { pattern: /commitment|subcontract|retention|bond|certificate|valuation|pay ?app/i, section: 'money', tab: 'commitments', answer: 'Commitments, valuations and payment applications are under Money \u2192 Commitments.' },
  { pattern: /inventory|stock|material|store|equipment|plant/i, section: 'money', tab: 'inventory', answer: 'Materials and equipment stock are under Money \u2192 Inventory.' },
  { pattern: /financial|cost|budget|cash ?flow|expens|spend/i, section: 'money', tab: 'financials', answer: 'Budget vs actual, costs and cash flow are under Money \u2192 Financials.' },
  { pattern: /team|member|invite|role|permission|directory|crew/i, section: 'people', tab: 'team', answer: 'Team roles, crews, subcontractors and the directory are under People.' },
  { pattern: /document|file|report|export/i, section: 'files', tab: 'companydocs', answer: 'Company documents and reports are under Files & reports.' },
  { pattern: /hello|hi|help|what can you/i, section: 'home', tab: '', answer: 'I can take you to any workspace section \u2014 try \u201cdaily log\u201d, \u201cinvoices\u201d, \u201cpunch list\u201d or \u201cteam\u201d.' },
];

const SUGGESTIONS = ['How many open snags?', 'Show me invoices', 'Open punch list', 'What\u2019s the budget status?'];

/** Live-data intents — answer with real numbers from the API (honest, no LLM). */
const DATA_INTENTS: { pattern: RegExp; run: (projectId: string) => Promise<string> }[] = [
  {
    pattern: /how many|count|number of|status of|open/i,
    run: async (projectId: string) => {
      if (!projectId) return '';
      const get = (u: string) => fetch(u, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const [snags, variations, attendance] = await Promise.all([
        get(`/api/v1/projects/${projectId}/snags`),
        get(`/api/v1/projects/${projectId}/variations`),
        get(`/api/v1/projects/${projectId}/attendance?days=1`),
      ]);
      const snagRows = (snags?.data || snags || []) as any[];
      const openSnags = snagRows.filter((x) => !['CLOSED', 'RESOLVED', 'VERIFIED'].includes(String(x.status))).length;
      const coRows = (variations?.data || variations || []) as any[];
      const pendingCOs = coRows.filter((v) => ['DRAFT', 'PM_REVIEW', 'OWNER_REVIEW', 'SUBMITTED'].includes(String(v.status))).length;
      const todayCount = attendance?.summary?.present ?? attendance?.count ?? null;
      const parts: string[] = [];
      if (snagRows.length) parts.push(`${openSnags} open snag${openSnags === 1 ? '' : 's'} of ${snagRows.length}`);
      if (coRows.length) parts.push(`${pendingCOs} change order${pendingCOs === 1 ? '' : 's'} awaiting action`);
      if (todayCount !== null) parts.push(`${todayCount} labourers checked in today`);
      return parts.length ? `Live project status: ${parts.join(' · ')}.` : '';
    },
  },
  {
    pattern: /overdue|unpaid|outstanding/i,
    run: async (projectId: string) => {
      if (!projectId) return '';
      const j = await fetch(`/api/v1/invoices?projectId=${projectId}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const rows = (j?.invoices || j?.data || []) as any[];
      if (!rows.length) return '';
      const outstanding = rows.filter((i) => Number(i.balance_due_num ?? i.balance_due ?? 0) > 0);
      const total = outstanding.reduce((a, i) => a + Number(i.balance_due_num ?? i.balance_due ?? 0), 0);
      return `${outstanding.length} unpaid invoice${outstanding.length === 1 ? '' : 's'} — KES ${total.toLocaleString('en-KE', { maximumFractionDigits: 0 })} outstanding.`;
    },
  },
  {
    pattern: /attendance|muster|who.*site|labou?r.*today/i,
    run: async (projectId: string) => {
      if (!projectId) return '';
      const j = await fetch(`/api/v1/projects/${projectId}/attendance`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const n = j?.summary?.present ?? j?.count;
      return typeof n === 'number' ? `${n} labourer${n === 1 ? '' : 's'} recorded present today.` : '';
    },
  },
];

export default function AskAiPanel(): React.JSX.Element {
  const { aiOpen, setAiOpen, setSection, setTab, nav, projectId } = useConsole();
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'bot', text: 'Hi — I\u2019m the Site Safi assistant. Tell me what you need and I\u2019ll take you to the right workspace section.' },
  ]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, aiOpen]);

  const allowedTabs = (sec: string): string[] => {
    if (sec === 'home') return nav.homeTabs || [];
    return nav.sections.find((s) => s.id === sec)?.tabs || [];
  };

  const send = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    const isQuestion = /how many|how much|status|count|open|overdue|today|many|much/i.test(q);
    if (isQuestion) {
      const din = DATA_INTENTS.find((d) => d.pattern.test(q));
      if (din) {
        din.run(projectId).then((answer) => {
          if (answer) {
            setMsgs((m) => [...m, { role: 'bot', text: answer }]);
          } else {
            setMsgs((m) => [...m, { role: 'bot', text: 'I couldn\u2019t pull live numbers for that — try asking about snags, change orders, invoices or attendance.' }]);
          }
        });
        return;
      }
    }
    const hit = INTENTS.find((i) => i.pattern.test(q));
    if (hit) {
      const tabs = allowedTabs(hit.section);
      const useTab = tabs.includes(hit.tab) ? hit.tab : (tabs[0] || '');
      const canGo = hit.section === 'home' ? true : tabs.length > 0;
      setMsgs((m) => [...m, {
        role: 'bot',
        text: hit.answer,
        link: canGo ? { section: hit.section, tab: useTab, label: `${SUBTAB_LABELS[useTab] || hit.section}` } : undefined,
      }]);
      return;
    }
    setMsgs((m) => [...m, {
      role: 'bot',
      text: 'I can route you to any section — try one of the suggestions below, or open the section you need from the sidebar.',
    }]);
  };

  const go = (section: string, t: string) => {
    setSection(section);
    setTab(t);
    setAiOpen(false);
  };

  if (!aiOpen) return <></>;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center"><IconSpark className="w-4 h-4" /></span>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Site Safi Assistant</p>
            <p className="text-[10px] text-slate-400">Navigation assistant — beta</p>
          </div>
        </div>
        <button onClick={() => setAiOpen(false)} aria-label="Close assistant" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
          <IconX className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
              m.role === 'user'
                ? 'bg-orange-600 text-white rounded-br-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm'
            }`}>
              <p>{m.text}</p>
              {m.link && (
                <button
                  onClick={() => go(m.link!.section, m.link!.tab)}
                  className="mt-2 text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
                >
                  Open {m.link.label} →
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="px-4 pb-2 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)}
            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
            {s}
          </button>
        ))}
      </div>

      <form
        className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about projects, invoices, site…"
          aria-label="Ask the Site Safi assistant"
          className="flex-1 text-sm border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button type="submit" aria-label="Send" className="w-11 h-11 rounded-xl bg-orange-600 text-white flex items-center justify-center hover:bg-orange-700 transition">
          <IconSend className="w-4 h-4" />
        </button>
      </form>
      <p className="px-4 pb-3 text-[10px] text-slate-400">Navigation assistant preview — connects to AI providers once keys are configured.</p>
    </div>
  );
}
