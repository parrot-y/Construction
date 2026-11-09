import React, { useState} from 'react';
import { AuthSession} from '../types/auth';

const input = 'w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500';
const label = 'block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1';

const COUNTRIES = ['Kenya', 'Uganda', 'Tanzania', 'Rwanda', 'Ethiopia', 'South Sudan', 'United Kingdom', 'United States', 'United Arab Emirates', 'Canada', 'Australia', 'Germany', 'Other'];

export default function ClientAccountView({ session, onSaved}: { session: AuthSession; onSaved?: () => void}): React.JSX.Element {
  const { user} = session;
  const [form, setForm] = useState({
    fullName: user.fullName || '',
    phoneNumber: (user as any).phoneNumber || '',
    country: (user as any).country || '',
});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string} | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/v1/auth/me', {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ fullName: form.fullName, phoneNumber: form.phoneNumber || null, country: form.country || null}),
});
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.message || 'Save failed');
      setMsg({ ok: true, text: 'Profile saved.'});
      onSaved?.();
} catch (err: any) {
      setMsg({ ok: false, text: err.message});
} finally {
      setSaving(false);
}
};

  return (
<div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-lg">
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Account</h3>
<p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{user.email}</p>
<form onSubmit={submit} className="space-y-4">
<div>
<label className={label}>Full name</label>
<input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value})} className={input} />
</div>
<div>
<label className={label}>Phone or WhatsApp</label>
<input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value})} placeholder="+254…" className={input} />
</div>
<div>
<label className={label}>Country you live in</label>
<select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value})} className={input}>
<option value="">Select…</option>
            {COUNTRIES.map((c) =><option key={c} value={c}>{c}</option>)}
</select>
</div>
        {msg &&<p className={`text-xs font-semibold ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>}
<button type="submit" disabled={saving}
          className="px-5 py-2.5 text-sm font-bold bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg">
          {saving ? 'Saving…' : 'Save'}
</button>
</form>
</div>
);
}
