import React, { useCallback, useEffect, useState } from 'react';

interface CrewMember { id: string; name: string; trade?: string | null; phone?: string | null; daily_rate_kes?: string | null }
interface Crew {
  id: string; name: string; trade: string; foreman_name?: string | null;
  status: string; notes?: string | null; project_id?: string | null;
  project?: { id: string; name: string; code: string } | null;
  members: CrewMember[]; member_count: number; daily_cost_kes: string;
}

const TRADES = ['General', 'Masonry', 'Concrete', 'Steel Fixing', 'Carpentry', 'Electrical', 'Plumbing', 'Painting', 'Tiling & Flooring', 'Roofing', 'Structural Steel', 'Welding & Fabrication', 'Glazing & Aluminium', 'Waterproofing', 'Scaffolding', 'Demolition', 'HVAC', 'Fire & Security Systems', 'Plastering', 'Excavation', 'Finishes', 'MEP', 'Other'];

export default function CrewsView({ canManage = true }: { canManage?: boolean }): React.JSX.Element {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState<Record<string, { name: string; trade: string; phone: string }>>({});
  const [form, setForm] = useState({ name: '', trade: 'Masonry', foremanName: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/crews?status=ACTIVE', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load crews');
      const json = await res.json();
      setCrews(json.data || []);
    } catch (err: any) {
      setError(err?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/crews', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, trade: form.trade, foremanName: form.foremanName || null, notes: form.notes || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Failed (${res.status})`);
      setShowForm(false);
      setForm({ name: '', trade: 'Masonry', foremanName: '', notes: '' });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id: string) => {
    try {
      await fetch(`/api/v1/crews/${id}`, { method: 'DELETE', credentials: 'include' });
      await load();
    } catch { /* ignore */ }
  };

  const addMember = async (crewId: string) => {
    const f = memberForm[crewId];
    if (!f?.name?.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/v1/crews/${crewId}/members`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: f.name.trim(), trade: f.trade || null, phone: f.phone || null }),
      });
      setMemberForm((prev) => ({ ...prev, [crewId]: { name: '', trade: '', phone: '' } }));
      await load();
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const removeMember = async (crewId: string, memberId: string) => {
    try {
      await fetch(`/api/v1/crews/${crewId}/members/${memberId}`, { method: 'DELETE', credentials: 'include' });
      await load();
    } catch { /* ignore */ }
  };

  if (loading) {
    return <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading crews…</div>;
  }

  const input = 'w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const label = 'block text-[11px] font-semibold text-slate-600 mb-1';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Crews</h3>
          <p className="text-xs text-slate-500">{crews.length} active crew{crews.length === 1 ? '' : 's'} — trade teams with foremen and members</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm((v) => !v)} className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
            {showForm ? 'Cancel' : '+ New Crew'}
          </button>
        )}
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg">{error}</div>}

      {showForm && canManage && (
        <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1"><span className={label}>Crew name *</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Masonry Crew A" className={input} /></label>
          <label className="space-y-1"><span className={label}>Trade *</span>
            <select value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} className={input}>
              {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select></label>
          <label className="space-y-1"><span className={label}>Foreman</span>
            <input value={form.foremanName} onChange={(e) => setForm({ ...form, foremanName: e.target.value })} className={input} /></label>
          <label className="space-y-1"><span className={label}>Notes</span>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={input} /></label>
          <div className="sm:col-span-2 flex justify-end">
            <button onClick={() => void create()} disabled={saving || form.name.length < 2}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              {saving ? 'Saving…' : 'Create crew'}
            </button>
          </div>
        </div>
      )}

      {crews.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">No active crews yet{canManage ? ' — create your first crew' : ''}.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {crews.map((c) => (
            <div key={c.id} className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{c.name}</h4>
                  <p className="text-[11px] text-slate-500">
                    {c.trade}{c.foreman_name ? ` · Foreman: ${c.foreman_name}` : ''}
                    {c.project ? ` · ${c.project.code}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded-full">{c.member_count} members</span>
                  {canManage && (
                    <button onClick={() => void deactivate(c.id)} className="text-[10px] font-semibold text-rose-500 hover:text-rose-700">Deactivate</button>
                  )}
                </div>
              </div>
              <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">
                {expanded === c.id ? 'Hide members' : `Members (${c.members.length}) · est. KES ${parseFloat(c.daily_cost_kes).toLocaleString()}/day`}
              </button>
              {expanded === c.id && (
                <div className="border-t border-slate-100 pt-2 space-y-1.5">
                  {c.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700">{m.name}{m.trade ? <span className="text-slate-400"> · {m.trade}</span> : null}{m.phone ? <span className="text-slate-400"> · {m.phone}</span> : null}</span>
                      {canManage && <button onClick={() => void removeMember(c.id, m.id)} className="text-[10px] text-rose-500 hover:text-rose-700">✕</button>}
                    </div>
                  ))}
                  {canManage && (
                    <div className="flex gap-1.5 pt-1">
                      <input placeholder="Member name" value={memberForm[c.id]?.name ?? ''}
                        onChange={(e) => setMemberForm({ ...memberForm, [c.id]: { name: e.target.value, trade: memberForm[c.id]?.trade ?? '', phone: memberForm[c.id]?.phone ?? '' } })}
                        className="flex-1 border border-slate-300 rounded px-2 py-1 text-[11px]" />
                      <input placeholder="Trade" value={memberForm[c.id]?.trade ?? ''}
                        onChange={(e) => setMemberForm({ ...memberForm, [c.id]: { ...memberForm[c.id]!, name: memberForm[c.id]?.name ?? '', trade: e.target.value, phone: memberForm[c.id]?.phone ?? '' } })}
                        className="w-24 border border-slate-300 rounded px-2 py-1 text-[11px]" />
                      <button onClick={() => void addMember(c.id)} disabled={saving}
                        className="px-2.5 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50">Add</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
