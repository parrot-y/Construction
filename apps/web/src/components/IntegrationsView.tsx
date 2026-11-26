import React, { useEffect, useState} from 'react';
import { PRODUCT_NAME } from '../lib/product';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';

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

interface MessageDelivery {
  id: string;
  channel: string;
  provider: string;
  recipientMasked: string;
  subject: string | null;
  bodyExcerpt: string | null;
  status: 'SIMULATED' | 'DELIVERED' | 'FAILED' | string;
  providerReference: string | null;
  errorMessage: string | null;
  source: string;
  createdAt: string;
  sentAt: string | null;
}

const DELIVERY_STYLE: Record<string, string> = {
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SIMULATED: 'bg-amber-50 text-amber-800 border-amber-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
};

const CHANNEL_ICON: Record<string, string> = { SMS: '', WHATSAPP: '', EMAIL: ''};

export default function IntegrationsView(): React.JSX.Element {
  const [items, setItems] = useState<IntegrationStatus[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testTo, setTestTo] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [deliveries, setDeliveries] = useState<MessageDelivery[]>([]);
  const [deliveriesError, setDeliveriesError] = useState(false);

  const loadDeliveries = () => {
    api.get<{ data?: MessageDelivery[] }>('/api/v1/message-deliveries?limit=20')
      .then((j) => { setDeliveries(j.data || []); setDeliveriesError(false); })
      .catch(() => setDeliveriesError(true)); // intentionally ignored: log is supplementary — show note, keep providers usable
  };

  useEffect(() => {
    api.get<any>('/api/v1/integrations/status')
      .then((j) => setItems(j.integrations || []))
      .catch(() => setItems([])) // intentionally ignored: status endpoint may be forbidden — show empty state
      .finally(() => setLoaded(true));
    loadDeliveries();
}, []);

  const runTest = async (it: IntegrationStatus) => {
    const to = (testTo[it.provider] || '').trim();
    if (!to) return;
    setTesting(it.provider);
    try {
      const json = await api.post<TestResult>('/api/v1/integrations/test', { channel: it.channel, to, message: `${PRODUCT_NAME} integration check — ${it.provider} is reachable.`});
      setResults((prev) => ({ ...prev, [it.provider]: json}));
      loadDeliveries();
} catch {
      setResults((prev) => ({ ...prev, [it.provider]: { ok: false, simulated: false, provider: it.provider, error: 'Network error'}}));
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
<span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                          Webhook endpoint for provider console:<code className="bg-slate-50 px-1 rounded">{it.webhookHint}</code>
</p>
)}
</div>
</div>

<div className="flex items-center gap-2 shrink-0">
<input
                      value={testTo[it.provider] || ''}
                      onChange={(e) => setTestTo((p) => ({ ...p, [it.provider]: e.target.value}))}
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

      {/* P5.7 — durable delivery log: every outbound SMS/WhatsApp/email
          dispatch with honest status (SIMULATED when unconfigured). */}
<div className="border-t border-slate-200 px-5 py-4" data-testid="delivery-log">
<div className="flex items-center justify-between mb-2">
<span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Recent deliveries</span>
<span className="text-[10px] text-slate-400">Recipients are masked; simulated sends are labelled, never shown as delivered.</span>
</div>
        {deliveriesError ? (
<p className="text-[11px] text-slate-400">Delivery log unavailable.</p>
) : deliveries.length === 0 ? (
<p className="text-[11px] text-slate-400">No outbound messages recorded yet.</p>
) : (
<div className="overflow-x-auto">
<table className="w-full text-[11px]">
<thead>
<tr className="text-left text-slate-400 border-b border-slate-100">
<th className="py-1.5 pr-3 font-semibold">When</th>
<th className="py-1.5 pr-3 font-semibold">Channel</th>
<th className="py-1.5 pr-3 font-semibold">To</th>
<th className="py-1.5 pr-3 font-semibold">Provider</th>
<th className="py-1.5 pr-3 font-semibold">Status</th>
<th className="py-1.5 pr-3 font-semibold">Source</th>
<th className="py-1.5 font-semibold">Message</th>
</tr>
</thead>
<tbody>
              {deliveries.map((d) => (
<tr key={d.id} className="border-b border-slate-50 align-top">
<td className="py-1.5 pr-3 text-slate-500 whitespace-nowrap tabular-nums">
                    {formatDateTime(d.createdAt)}
</td>
<td className="py-1.5 pr-3 font-semibold text-slate-700">{d.channel}</td>
<td className="py-1.5 pr-3 text-slate-600 font-mono">{d.recipientMasked}</td>
<td className="py-1.5 pr-3 text-slate-500">{d.provider}</td>
<td className="py-1.5 pr-3">
<span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${DELIVERY_STYLE[d.status] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                      {d.status}
</span>
                    {d.errorMessage && <span className="block text-[10px] text-red-500 mt-0.5 max-w-[180px] truncate" title={d.errorMessage}>{d.errorMessage}</span>}
</td>
<td className="py-1.5 pr-3 text-slate-500">{d.source}</td>
<td className="py-1.5 text-slate-500 max-w-[220px] truncate" title={d.bodyExcerpt || ''}>{d.bodyExcerpt || d.subject || '—'}</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</div>
</div>
);
}
