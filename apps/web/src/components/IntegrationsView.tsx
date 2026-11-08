import React, { useEffect, useState } from 'react';

interface IntegrationStatus {
  provider: string;
  channel: 'SMS' | 'WHATSAPP' | 'EMAIL';
  configured: boolean;
  envVars: string[];
  webhookHint?: string;
}

interface TestResult {
  ok: boolean;
  simulated: boolean;
  provider: string;
  reference?: string;
  error?: string;
}

const CHANNEL_ICON: Record<string, string> = { SMS: '💬', WHATSAPP: '🟢', EMAIL: '✉️' };

export default function IntegrationsView(): React.JSX.Element {
  const [items, setItems] = useState<IntegrationStatus[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testTo, setTestTo] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, TestResult>>({});

  useEffect(() => {
    fetch('/api/v1/integrations/status', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('forbidden'))))
      .then((j) => setItems(j.integrations || []))
      .catch(() => setItems([]))
      .finally(() => setLoaded(true));
  }, []);

  const runTest = async (it: IntegrationStatus) => {
    const to = (testTo[it.provider] || '').trim();
    if (!to) return;
    setTesting(it.provider);
    try {
      const res = await fetch('/api/v1/integrations/test', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: it.channel, to, message: `Site Safi integration check — ${it.provider} is reachable.` }),
      });
      const json = await res.json();
      setResults((prev) => ({ ...prev, [it.provider]: json }));
    } catch {
      setResults((prev) => ({ ...prev, [it.provider]: { ok: false, simulated: false, provider: it.provider, error: 'Network error' } }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" data-testid="integrations-view">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Integrations</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Messaging & tax providers. Unconfigured services record sends as simulated — nothing is faked as delivered.
          </p>
        </div>
      </div>

      {!loaded ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading integrations…</div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">Integrations status unavailable.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((it) => {
            const result = results[it.provider];
            return (
              <div key={it.provider} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-lg leading-none mt-0.5">{CHANNEL_ICON[it.channel]}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{it.provider}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          it.configured ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-500 border border-slate-200'
                        }`}>
                          {it.configured ? 'Configured' : 'Not configured'}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {it.envVars.map((v) => (
                          <code key={v} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{v}</code>
                        ))}
                      </div>
                      {it.webhookHint && (
                        <p className="text-[11px] text-slate-400 mt-1.5">
                          Webhook endpoint for provider console: <code className="bg-slate-50 px-1 rounded">{it.webhookHint}</code>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      value={testTo[it.provider] || ''}
                      onChange={(e) => setTestTo((p) => ({ ...p, [it.provider]: e.target.value }))}
                      placeholder={it.channel === 'EMAIL' ? 'name@example.com' : '+2547…'}
                      className="w-44 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                    />
                    <button
                      onClick={() => runTest(it)}
                      disabled={testing === it.provider || !(testTo[it.provider] || '').trim()}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white rounded-lg transition"
                    >
                      {testing === it.provider ? 'Sending…' : 'Send test'}
                    </button>
                  </div>
                </div>

                {result && (
                  <div className={`mt-3 text-xs rounded-lg px-3 py-2 border ${
                    result.simulated
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : result.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    {result.simulated
                      ? 'No provider configured — message recorded as simulated, nothing sent.'
                      : result.ok
                        ? `Delivered via ${result.provider}${result.reference ? ` · ref ${result.reference}` : ''}`
                        : `Send failed: ${result.error || 'unknown error'}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
