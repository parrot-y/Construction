import React, { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../../lib/api';
import { EmptyState, Skeleton } from '../../../ui';
import { InlineError } from '../../feedback/InlineError';
import { formatKes, formatRatio } from '../../../ui';
import { formatDate } from '../../../lib/format';

// ---------------------------------------------------------------------------
// Phase 3.4 Home dashboard — spec block order:
//   Needs you now · progress vs plan (S-curve) · money per project (bars) ·
//   next-weeks cash timeline · site health · latest photos · next milestones.
// A "Client view" toggle reuses progress/money/photos/milestones with
// client-safe wording. Real data only — every block has loading, empty and
// error states; charts carry a table alternative.
// ---------------------------------------------------------------------------

interface Project { id: string; name: string; code?: string; status?: string; original_contract_sum?: string | number | null; project_type?: string | null; }
interface Milestone { id: string; task_name?: string; title?: string; planned_start_date?: string; planned_end_date?: string; status?: string; progress_percentage?: number | string; projectName?: string; }
interface Attention { label: string; detail?: string; section?: string; tab?: string; tone?: 'warn' | 'bad' | 'info'; }

// One aggregate call (P4.1) replaces the per-project fan-outs.
interface HomeSummary {
  moneyPerProject?: { projectId: string; certified: number; invoiced: number; paid: number; retention: number }[] | null;
  milestones?: (Milestone & { projectName?: string })[] | null;
  siteHealth?: { openSnags: number; snagsBySeverity: Record<string, number>; recentIncidents30d: number; diaryDays14: number; missedDiaryDays: number } | null;
  latestPhotos?: { id: string; storage_key: string; caption?: string | null; client_visible?: boolean; entry_date?: string }[] | null;
}

function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-2">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>;
}

const num = (v: any): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

function useFetch<T>(path: string | null, deps: any[] = []) {
  const [state, setState] = useState<{ data?: T; loading: boolean; error?: string | null }>({ loading: !!path });
  useEffect(() => {
    if (!path) { setState({ loading: false }); return; }
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api.get<T>(path)
      .then((data) => { if (live) setState({ data, loading: false }); })
      .catch((err) => { if (live) setState({ loading: false, error: apiErrorMessage(err, 'Could not load this block') }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  return state;
}

function Block({ title, finding, children, table }: { title: string; finding?: string; children: React.ReactNode; table?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        {finding && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{finding}</p>}
      </div>
      {children}
      {table && <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-slate-500">Table view</summary><div className="mt-2">{table}</div></details>}
    </section>
  );
}

const moneyTable = (rows: [string, string][]) => (
  <table className="w-full text-xs"><tbody>
    {rows.map(([k, v]) => <tr key={k} className="border-b border-slate-100 dark:border-slate-800"><td className="py-1.5 pr-3 text-slate-500">{k}</td><td className="py-1.5 text-right font-semibold text-slate-800 dark:text-slate-200">{v}</td></tr>)}
  </tbody></table>
);

interface AttentionStat { label: string; value: number; warn?: boolean; section: string; tab: string }

// --- Block: Needs you now ---------------------------------------------------
function NeedsYouNow({ items, stats, loading, error, onNavigate }: { items: Attention[]; stats: AttentionStat[]; loading: boolean; error?: string | null; onNavigate?: (section: string, tab: string) => void }) {
  if (loading) return <SkeletonRows rows={3} />;
  if (error) return <InlineError error={error} />;
  return (
    <div className="space-y-4">
      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <button key={s.label} type="button" onClick={() => onNavigate?.(s.section, s.tab)}
              className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-orange-400 dark:border-slate-800 dark:hover:border-orange-500">
              <p className="text-xs font-bold text-slate-500">{s.label}</p>
              <p className={`mt-1 text-xl font-bold ${s.warn ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100'}`}>{s.value}</p>
              <p className="mt-0.5 text-xs font-bold text-orange-600">Open list →</p>
            </button>
          ))}
        </div>
      )}
      {!items.length ? <EmptyState title="Nothing needs you right now" hint="Approvals, client requests and overdue items will appear here." /> : (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {items.slice(0, 8).map((it, i) => (
        <li key={i} className="flex items-start gap-2 py-2">
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${it.tone === 'bad' ? 'bg-rose-500' : it.tone === 'warn' ? 'bg-amber-500' : 'bg-sky-500'}`} aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {it.section ? (
                <button type="button" onClick={() => onNavigate?.(it.section!, it.tab || 'all')} className="text-left hover:underline">{it.label}</button>
              ) : it.label}
            </p>
            {it.detail && <p className="text-xs text-slate-500 dark:text-slate-400">{it.detail}</p>}
          </div>
        </li>
      ))}
    </ul>
      )}
    </div>
  );
}

// --- Block: Progress against plan (S-curve) ---------------------------------
function ProgressPlan({ projectId, projectName, clientView, cash }: { projectId?: string; projectName?: string; clientView: boolean; cash: { data?: any; loading: boolean; error?: string | null } }) {
  const { data, loading, error } = cash;
  const wrap = (inner: React.ReactNode) => (
    <Block title={`Progress against plan — ${projectName || 'project'}`} finding="Planned value versus earned value by month.">
      {inner}
    </Block>
  );
  if (!projectId) return wrap(<EmptyState title="No project selected" hint="Pick a project to see progress against plan." />);
  if (loading) return wrap(<SkeletonRows rows={4} />);
  if (error) return wrap(<InlineError error={error} />);
  const series: any[] = data?.sCurveSeries || [];
  if (!series.length) return wrap(<EmptyState title="No progress records yet" hint="Progress is recorded monthly once the project is underway." />);

  const cum = series.map((r, i) => ({
    month: r.period_month,
    planned: series.slice(0, i + 1).reduce((s, x) => s + num(x.plannedValueKes), 0),
    earned: series.slice(0, i + 1).reduce((s, x) => s + num(x.earnedValueKes), 0),
  }));
  const max = Math.max(...cum.map((c) => Math.max(c.planned, c.earned)), 1);
  const W = 560, H = 180, PX = 8, PY = 8;
  const x = (i: number) => PX + (i / Math.max(cum.length - 1, 1)) * (W - PX * 2);
  const y = (v: number) => H - PY - (v / max) * (H - PY * 2);
  const path = (key: 'planned' | 'earned') => cum.map((c, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(c[key]).toFixed(1)}`).join(' ');
  const last = cum[cum.length - 1]!;
  const finding = clientView
    ? `Progress is ${pct(last.earned, last.planned)}% of plan to date.`
    : `Earned value is ${pct(last.earned, last.planned)}% of planned value to date (SPI ${formatRatio(data?.metrics?.spi)}).`;

  const table = moneyTable([
    ['Planned to date', formatKes(last.planned)],
    ['Earned to date', formatKes(last.earned)],
    ['SPI', formatRatio(data?.metrics?.spi)],
    ['CPI', formatRatio(data?.metrics?.cpi)],
  ]);

  return (
    <Block title={`Progress against plan — ${projectName || 'project'}`} finding={finding} table={table}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Planned versus earned value by month">
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={PX} x2={W - PX} y1={y(max * f)} y2={y(max * f)} stroke="var(--color-slate-200)" strokeWidth="1" />)}
        <path d={path('planned')} fill="none" stroke="var(--color-slate-400)" strokeWidth="2" strokeDasharray="5 4" />
        <path d={path('earned')} fill="none" stroke="var(--color-brand-600)" strokeWidth="2.5" />
        <text x={PX} y={PY + 10} fontSize="10" fill="var(--color-slate-500)">{formatKes(max)}</text>
        <text x={PX} y={H - 2} fontSize="10" fill="var(--color-slate-500)">{cum[0]?.month}</text>
        <text x={W - PX - 40} y={H - 2} fontSize="10" fill="var(--color-slate-500)">{last?.month}</text>
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-slate-400" /> Planned</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-orange-600" /> Earned</span>
      </div>
    </Block>
  );
}

// --- Block: Money per project (bars) ----------------------------------------
function MoneyPerProject({ projects, clientView, summary, loading, error }: { projects: Project[]; clientView: boolean; summary?: HomeSummary; loading: boolean; error?: string | null }) {
  const moneyRows = summary?.moneyPerProject || [];
  const wrap = (inner: React.ReactNode) => (
    <Block title="Money per project" finding="Contract, certified, invoiced, paid and retention held per project.">
      {inner}
    </Block>
  );
  if (loading) return wrap(<SkeletonRows rows={4} />);
  if (error) return wrap(<InlineError error={error} />);
  if (!projects.length) return wrap(<EmptyState title="No projects yet" hint="Money per project appears once you have projects." />);
  if (summary && summary.moneyPerProject === null) {
    return wrap(<EmptyState title="Money details aren't shared with your role" hint="Ask your admin for cost-view access to see certified, invoiced and paid amounts." />);
  }

  const rows: Record<string, { certified: number; invoiced: number; paid: number; retention: number }> = {};
  for (const m of moneyRows) rows[m.projectId] = { certified: m.certified, invoiced: m.invoiced, paid: m.paid, retention: m.retention };

  const contract = (p: Project) => num(p.original_contract_sum);
  const maxV = Math.max(1, ...projects.map((p) => Math.max(contract(p), rows[p.id]?.certified || 0)));
  const series: [string, (p: Project) => number][] = [
    ['Contract', contract],
    [clientView ? 'Certified to date' : 'Certified', (p) => rows[p.id]?.certified || 0],
    ['Invoiced', (p) => rows[p.id]?.invoiced || 0],
    ['Paid', (p) => rows[p.id]?.paid || 0],
    ['Retention held', (p) => rows[p.id]?.retention || 0],
  ];
  const colors = ['var(--color-slate-400)', 'var(--color-sky-400)', 'var(--color-amber-500)', 'var(--color-emerald-500)', 'var(--color-brand-500)'];

  return (
    <Block
      title="Money per project"
      finding={clientView ? 'What has been certified, invoiced and paid on each project.' : 'Contract, certified, invoiced, paid and retention held per project.'}
      table={moneyTable(projects.flatMap((p): [string, string][] => series.map(([k, f]): [string, string] => [`${p.name} — ${k}`, formatKes(f(p))])))}
    >
      <div className="space-y-4">
        {projects.map((p) => (
          <div key={p.id}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{p.name}</p>
              <p className="shrink-0 text-xs text-slate-500">{formatKes(contract(p))} contract</p>
            </div>
            <div className="space-y-1">
              {series.map(([label, f], si) => {
                const v = f(p);
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate text-xs text-slate-500">{label}</span>
                    <div className="h-2.5 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                      <div className="h-2.5 rounded" style={{ width: `${pct(v, maxV)}%`, background: colors[si] }} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">{formatKes(v)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        {series.map(([label], i) => <span key={label} className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: colors[i] }} />{label}</span>)}
      </div>
    </Block>
  );
}

// --- Block: Next-weeks cash timeline ----------------------------------------
function CashTimeline({ projectId, projectName, clientView, cash }: { projectId?: string; projectName?: string; clientView: boolean; cash: { data?: any; loading: boolean; error?: string | null } }) {
  const { data, loading, error } = cash;
  const wrap = (inner: React.ReactNode) => (
    <Block title={`Cash forecast — ${projectName || 'project'}`} finding="Net cash flow per month from the EVM forecast.">
      {inner}
    </Block>
  );
  if (!projectId) return null;
  if (loading) return wrap(<SkeletonRows rows={3} />);
  if (error) return wrap(<InlineError error={error} />);
  const series: any[] = (data?.sCurveSeries || []).slice(0, 8);
  if (!series.length) return wrap(<EmptyState title="No cash forecast yet" hint="Forecasts are recorded monthly with progress." />);
  const vals = series.map((r) => num(r.netCashFlowKes));
  const maxAbs = Math.max(1, ...vals.map(Math.abs));
  const W = 560, H = 140, PX = 30, PY = 10;
  const bw = (W - PX * 2) / series.length;
  const zeroY = PY + (H - PY * 2) / 2;
  const table = moneyTable(series.map((r, i): [string, string] => { const v = vals[i] ?? 0; return [String(r.period_month), `${v >= 0 ? '+' : ''}${formatKes(v)}`]; }));
  return (
    <Block
      title={`Cash forecast — ${projectName || 'project'}`}
      finding={clientView ? 'Expected money in and out over the coming months.' : 'Net cash flow per month from the EVM forecast (positive is in, negative is out).'}
      table={table}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly net cash flow forecast">
        <line x1={PX} x2={W - PX} y1={zeroY} y2={zeroY} stroke="var(--color-slate-300)" strokeWidth="1" />
        {vals.map((v0, i) => {
          const v = v0 ?? 0;
          const h = (Math.abs(v) / maxAbs) * (H / 2 - PY);
          return <rect key={i} x={PX + i * bw + bw * 0.2} y={v >= 0 ? zeroY - h : zeroY} width={bw * 0.6} height={Math.max(h, 1)} fill={v >= 0 ? 'var(--color-emerald-500)' : 'var(--color-rose-500)'} rx="2" />;
        })}
        {series.map((r, i) => <text key={i} x={PX + i * bw + bw / 2} y={H - 1} fontSize="9" textAnchor="middle" fill="var(--color-slate-500)">{String(r.period_month).slice(0, 7)}</text>)}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> In</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-rose-500" /> Out</span>
      </div>
    </Block>
  );
}

// --- Block: Site health ------------------------------------------------------
function SiteHealth({ projectId, projectName, clientView, summary, loading, error }: { projectId?: string; projectName?: string; clientView: boolean; summary?: HomeSummary; loading: boolean; error?: string | null }) {
  if (!projectId) return null;
  const health = summary?.siteHealth;
  const wrap = (inner: React.ReactNode) => (
    <Block title={`Site health — ${projectName || 'project'}`} finding="Open snags by severity, recent incidents and diary gaps in the last two weeks.">
      {inner}
    </Block>
  );
  if (loading) return wrap(<SkeletonRows rows={3} />);
  if (error) return wrap(<InlineError error={error} />);
  if (!health) {
    const denied = summary != null && summary.siteHealth === null;
    return wrap(<EmptyState
      title={denied ? "Site health isn't shared with your role" : 'No site data yet'}
      hint={denied ? 'Ask your admin for site-diary access to see snags, incidents and diary gaps.' : 'Snags, incidents and diaries appear here once site work is recorded.'}
    />);
  }

  const openSnags = health.openSnags;
  const bySev = Object.entries(health.snagsBySeverity || {}).filter(([, n]) => n > 0);
  const openIncidents = health.recentIncidents30d;
  const missedDays = health.missedDiaryDays;

  if (clientView) return null; // client view shows only progress/money/photos/milestones

  return (
    <Block title={`Site health — ${projectName || 'project'}`} finding="Open snags by severity, open incidents and diary gaps in the last two weeks.">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-800/50">
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{openSnags}</p>
          <p className="text-xs text-slate-500">Open snags</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-800/50">
          <p className={`text-xl font-bold ${openIncidents ? 'text-rose-600' : 'text-slate-900 dark:text-slate-100'}`}>{openIncidents}</p>
          <p className="text-xs text-slate-500">Incidents (30 days)</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-800/50">
          <p className={`text-xl font-bold ${missedDays > 2 ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100'}`}>{missedDays}</p>
          <p className="text-xs text-slate-500">Missed diary days (14d)</p>
        </div>
      </div>
      {bySev.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {bySev.map(([sev, n]) => (
            <span key={sev} className={`rounded-full px-2 py-0.5 text-xs font-bold ${sev === 'CRITICAL_SAFETY' ? 'bg-rose-100 text-rose-700' : sev === 'FUNCTIONAL' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
              {sev.toLowerCase().replace(/_/g, ' ')} ×{n}
            </span>
          ))}
        </div>
      )}
      {openSnags === 0 && openIncidents === 0 && <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">No open snags or incidents.</p>}
    </Block>
  );
}

// --- Block: Latest photos ----------------------------------------------------
function LatestPhotos({ projectId, projectName, clientView, summary, loading, error }: { projectId?: string; projectName?: string; clientView: boolean; summary?: HomeSummary; loading: boolean; error?: string | null }) {
  const wrapPhotos = (inner: React.ReactNode) => (
    <Block title={`Latest site photos — ${projectName || 'project'}`} finding={clientView ? 'Recent progress photos shared with you.' : 'Most recent diary photos, newest first.'}>
      {inner}
    </Block>
  );
  if (!projectId) return null;
  if (loading) return wrapPhotos(<SkeletonRows rows={2} />);
  if (error) return wrapPhotos(<InlineError error={error} />);
  if (summary != null && summary.latestPhotos === null) {
    return wrapPhotos(<EmptyState title="Site photos aren't shared with your role" hint="Ask your admin for site-diary access to see progress photos." />);
  }
  const photos = (summary?.latestPhotos || [])
    .filter((p) => !clientView || p.client_visible === true)
    .slice(0, 6);
  if (!photos.length) return wrapPhotos(<EmptyState title="No site photos yet" hint="Photos filed in daily diaries will appear here." />);
  return wrapPhotos(
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {photos.map((p, i) => (
          <a key={p.id || i} href={`/uploads/${p.storage_key}`} target="_blank" rel="noreferrer" className="group relative block aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
            <img src={`/uploads/${p.storage_key}`} alt={p.caption || `Site photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
          </a>
        ))}
      </div>
  );
}

// --- Block: Next milestones --------------------------------------------------
function NextMilestones({ clientView, summary, loading, error }: { clientView: boolean; summary?: HomeSummary; loading: boolean; error?: string | null }) {
  const items = (summary?.milestones || []).slice(0, 5);

  const wrap = (inner: React.ReactNode) => (
    <Block title="Next milestones" finding={clientView ? 'The next key dates across your projects.' : 'The next five open schedule tasks across all projects.'}>
      {inner}
    </Block>
  );
  if (loading) return wrap(<SkeletonRows rows={3} />);
  if (error) return wrap(<InlineError error={error} />);
  if (summary != null && summary.milestones === null) {
    return wrap(<EmptyState title="Milestones aren't shared with your role" hint="Ask your admin for site-diary access to see the project schedule." />);
  }
  if (!items.length) return wrap(<EmptyState title="No upcoming milestones" hint="Schedule tasks appear here as they are planned." />);
  return wrap(
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {items.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{t.task_name || t.title}</p>
              <p className="text-xs text-slate-500">{t.projectName}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t.planned_start_date ? formatDate(t.planned_start_date) : '—'}</p>
              <p className="text-xs text-slate-500">{String(t.status || '').toLowerCase().replace('_', ' ')}</p>
            </div>
          </li>
        ))}
      </ul>
  );
}

// --- Dashboard orchestrator --------------------------------------------------
export default function HomeDashboard({ attentionItems, attentionStats = [], attentionLoading, attentionError, projects, projectsReady = true, selectedProject, onNavigate }: {
  attentionItems: Attention[];
  attentionStats?: AttentionStat[];
  attentionLoading: boolean;
  attentionError?: string | null;
  projects: Project[];
  projectsReady?: boolean;
  selectedProject?: Project;
  onNavigate?: (section: string, tab: string) => void;
}) {
  const [clientView, setClientView] = useState(false);
  const sel = selectedProject || projects[0];
  const selId = sel?.id;

  // P4.1: ONE summary call feeds money/milestones/site-health/photos; the
  // cash-flow response is shared by the S-curve and cash-timeline blocks.
  // Wait for the project list before firing so we don't fetch twice.
  const summary = useFetch<HomeSummary>(projectsReady ? `/api/v1/home/summary${selId ? `?projectId=${selId}` : ''}` : null, [selId, projectsReady]);
  const cash = useFetch<any>(projectsReady && selId ? `/api/v1/projects/${selId}/cash-flow` : null, [selId, projectsReady]);
  const blockState = { summary: summary.data, loading: !projectsReady || summary.loading, error: summary.error };
  const cashState = { ...cash, loading: !projectsReady || cash.loading };

  const order = clientView
    ? ['needs', 'progress', 'money', 'photos', 'milestones']
    : ['needs', 'progress', 'money', 'cash', 'health', 'photos', 'milestones'];

  const blocks: Record<string, React.ReactNode> = {
    needs: <Block key="needs" title="Needs you now"><NeedsYouNow items={attentionItems} stats={attentionStats} loading={attentionLoading} error={attentionError} onNavigate={onNavigate} /></Block>,
    progress: <ProgressPlan key="progress" projectId={selId} projectName={sel?.name} clientView={clientView} cash={cashState} />,
    money: <MoneyPerProject key="money" projects={projects} clientView={clientView} {...blockState} />,
    cash: !clientView ? <CashTimeline key="cash" projectId={selId} projectName={sel?.name} clientView={clientView} cash={cashState} /> : null,
    health: !clientView ? <SiteHealth key="health" projectId={selId} projectName={sel?.name} clientView={clientView} {...blockState} /> : null,
    photos: <LatestPhotos key="photos" projectId={selId} projectName={sel?.name} clientView={clientView} {...blockState} />,
    milestones: <NextMilestones key="milestones" clientView={clientView} {...blockState} />,
  };

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setClientView((v) => !v)}
          aria-pressed={clientView}
          className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${clientView ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300' : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'}`}
        >
          {clientView ? 'Client view on' : 'Client view'}
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {order.map((k) => blocks[k])}
      </div>
    </div>
  );
}
