import React, { useEffect, useState } from 'react';

export interface WebhookLogItem {
  id: string;
  senderPhone: string;
  senderName: string;
  channel: 'WHATSAPP' | 'SMS';
  rawMessage: string;
  detectedCommand: 'DIARY' | 'DELIVERY' | 'INCIDENT' | 'PLANT_FUEL' | 'UNKNOWN';
  processedStatus: 'PROCESSED' | 'FAILED' | 'PENDING_REVIEW';
  extractedData?: any;
  replyMessage: string;
  createdAt: string;
}

export interface SiteAlertItem {
  id: string;
  recipientPhone: string;
  recipientName: string;
  recipientRole: string;
  alertType: 'CRITICAL_SAFETY_STOP_WORK' | 'DIESEL_DISCREPANCY_FLAG' | 'DIESEL_SIPHONING_FLAG' | 'STRUCTURAL_CONCRETE_FAIL' | 'BUDGET_OVERRUN';
  messageBody: string;
  deliveryChannel: 'WHATSAPP' | 'SMS' | 'IN_APP';
  deliveryStatus: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
  sentAt?: string | null;
  createdAt: string;
}

interface WhatsAppSiteWebhookViewProps {
  projectId?: string;
  projectName?: string;
  webhookLogs?: WebhookLogItem[];
  siteAlerts?: SiteAlertItem[];
  userRole?: string;
  onSendWebhook?: (data: any) => Promise<void>;
  onDispatchAlert?: (data: any) => Promise<void>;
}

export const WhatsAppSiteWebhookView: React.FC<WhatsAppSiteWebhookViewProps> = ({
  projectId,
  projectName = 'Riverside Commercial Plaza',
  webhookLogs: initialLogs,
  siteAlerts: initialAlerts,
  userRole: _userRole,
  onSendWebhook,
  onDispatchAlert,
}) => {
  const [activeTab, setActiveTab] = useState<'CHAT_FEED' | 'EMERGENCY_ALERTS'>('CHAT_FEED');
  const [showSimModal, setShowSimModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);

  // Simulation Form states
  const [senderName, setSenderName] = useState('Foreman Kiprono');
  const [senderPhone, setSenderPhone] = useState('+254712345678');
  const [rawMessage, setRawMessage] = useState('#DIARY 14 masons, 22 casuals on site. Column casting ongoing at 3rd floor.');

  // Alert Form states
  const [recipientName, setRecipientName] = useState('Eng. David Mwangi');
  const [recipientPhone, setRecipientPhone] = useState('+254722889900');
  const [recipientRole, setRecipientRole] = useState('PROJECT_MANAGER');
  const [alertType, setAlertType] = useState<
    'CRITICAL_SAFETY_STOP_WORK' | 'DIESEL_DISCREPANCY_FLAG' | 'DIESEL_SIPHONING_FLAG' | 'STRUCTURAL_CONCRETE_FAIL' | 'BUDGET_OVERRUN'
  >('CRITICAL_SAFETY_STOP_WORK');
  const [alertMessage, setAlertMessage] = useState('URGENT: Scaffold edge protection failure observed on North Elevation. Stop work ordered.');

  const isLive = !!projectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive || !projectId) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/site-alerts`, { credentials: 'include' });
      if (res.ok) {
        const aj = await res.json();
        setAlerts((aj.alerts || []) as SiteAlertItem[]);
      }
    } catch { /* keep demo */ }
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/site-webhook-logs`, { credentials: 'include' });
      if (res.ok) {
        const lj = await res.json();
        setLogs(((lj.logs || []) as any[]).map((l) => ({
          id: l.id,
          senderPhone: l.senderPhone || '***',
          senderName: l.senderName || 'Unknown',
          channel: l.channel === 'SMS' ? 'SMS' : 'WHATSAPP',
          rawMessage: l.rawMessage || '',
          detectedCommand: l.detectedCommand || 'UNKNOWN',
          processedStatus: l.processedStatus || 'PROCESSED',
          replyMessage: l.replyMessage || '',
          createdAt: l.createdAt || '',
        })));
      } else {
        setLogs([]);
      }
    } catch { setLogs([]); }
    setLiveLoaded(true);
  }, [isLive, projectId]);

  useEffect(() => { void reload(); }, [reload]);

  // Default logs state
  const [logs, setLogs] = useState<WebhookLogItem[]>(
    initialLogs || [
      {
        id: 'wh-1',
        senderPhone: '+254712345678',
        senderName: 'Foreman Kiprono',
        channel: 'WHATSAPP',
        rawMessage: '#DIARY 14 masons, 22 casuals on site. Column casting ongoing at 3rd floor.',
        detectedCommand: 'DIARY',
        processedStatus: 'PROCESSED',
        extractedData: { masons: 14, casuals: 22 },
        replyMessage: 'Platform: Asante Foreman Kiprono. Rekodi ya Site Diary imepokelewa na kuwekwa kwa mfumo. (Masons: 14, Casuals: 22).',
        createdAt: '2026-11-04T07:45:00Z',
      },
      {
        id: 'wh-2',
        senderPhone: '+254722998877',
        senderName: 'Storekeeper Kamau',
        channel: 'WHATSAPP',
        rawMessage: '#DELIVERY 200 bags Bamburi Nguvu 42.5R from Athi River depot, Waybill #4901',
        detectedCommand: 'DELIVERY',
        processedStatus: 'PROCESSED',
        extractedData: { quantity: '200', summary: '200 bags Bamburi Nguvu 42.5R' },
        replyMessage: 'Platform: Delivery note imethibitishwa: "200 bags Bamburi Nguvu 42.5R". Storekeeper ataangalia mzigo kabla ya kutoa GRN.',
        createdAt: '2026-11-04T08:30:00Z',
      },
      {
        id: 'wh-3',
        senderPhone: '+254733445566',
        senderName: 'Safety Rep Ouma',
        channel: 'WHATSAPP',
        rawMessage: '#INCIDENT CRITICAL STOP-WORK: Scaffolding collapse warning on North Elevation grid B-2. No injuries.',
        detectedCommand: 'INCIDENT',
        processedStatus: 'PROCESSED',
        extractedData: { isSafetyCritical: true },
        replyMessage: 'Platform SAFETY ALERT: Taarifa ya dharura imetumwa kwa Safety Officer na Project Manager mara moja! Hali: CRITICAL STOP-WORK.',
        createdAt: '2026-11-04T09:15:00Z',
      },
    ]
  );

  // Default alerts state
  const [alerts, setAlerts] = useState<SiteAlertItem[]>(
    initialAlerts || [
      {
        id: 'alt-1',
        recipientPhone: '+254733445566',
        recipientName: 'Safety Rep Ouma',
        recipientRole: 'SAFETY_OFFICER',
        alertType: 'CRITICAL_SAFETY_STOP_WORK',
        messageBody: 'URGENT DOSHS ALERT: Scaffolding collapse warning on North Elevation grid B-2. Dispatched via WhatsApp webhook.',
        deliveryChannel: 'WHATSAPP',
        deliveryStatus: 'DELIVERED',
        sentAt: '2026-11-04T09:15:30Z',
        createdAt: '2026-11-04T09:15:20Z',
      },
      {
        id: 'alt-2',
        recipientPhone: '+254722889900',
        recipientName: 'Eng. David Mwangi',
        recipientRole: 'PROJECT_MANAGER',
        alertType: 'STRUCTURAL_CONCRETE_FAIL',
        messageBody: 'URGENT: 28-day cube test for Column C-12 failed target 30 MPa (Achieved 22.4 MPa). Core test requested.',
        deliveryChannel: 'WHATSAPP',
        deliveryStatus: 'DELIVERED',
        sentAt: '2026-11-04T09:40:00Z',
        createdAt: '2026-11-04T09:39:40Z',
      },
    ]
  );

  const handleSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Live webhook ingest requires an HMAC-signed site-ops token only the API
    // backend can mint — simulation is demo-mode only.
    if (isLive) return;
    const upper = rawMessage.toUpperCase();
    let cmd: any = 'UNKNOWN';
    let reply = 'Platform: Message processed.';

    if (upper.includes('#DIARY')) {
      cmd = 'DIARY';
      reply = `Platform: Asante ${senderName}. Rekodi ya Site Diary imepokelewa na kuwekwa kwa mfumo.`;
    } else if (upper.includes('#DELIVERY')) {
      cmd = 'DELIVERY';
      reply = 'Platform: Delivery note imethibitishwa na kuhifadhiwa.';
    } else if (upper.includes('#INCIDENT')) {
      cmd = 'INCIDENT';
      reply = 'Platform SAFETY ALERT: Taarifa ya dharura imetumwa kwa Safety Officer mara moja!';
    } else if (upper.includes('#FUEL')) {
      cmd = 'PLANT_FUEL';
      reply = 'Platform Fuel Audit: Mafuta yamenakiliwa kwa mfumo.';
    }

    const newLog: WebhookLogItem = {
      id: `wh-${Date.now()}`,
      senderPhone,
      senderName,
      channel: 'WHATSAPP',
      rawMessage,
      detectedCommand: cmd,
      processedStatus: 'PROCESSED',
      replyMessage: reply,
      createdAt: new Date().toISOString(),
    };

    if (onSendWebhook) {
      await onSendWebhook(newLog);
    }
    setLogs([newLog, ...logs]);
    setShowSimModal(false);
  };

  const handleDispatchAlertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newAlert: SiteAlertItem = {
      id: `alt-${Date.now()}`,
      recipientPhone,
      recipientName,
      recipientRole,
      alertType,
      messageBody: alertMessage,
      deliveryChannel: 'WHATSAPP',
      deliveryStatus: 'DELIVERED',
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    if (isLive && projectId) {
      void (async () => {
        try {
          const res = await fetch(`/api/v1/projects/${projectId}/site-alerts`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipientPhone,
              recipientName,
              recipientRole,
              alertType,
              messageBody: alertMessage,
              deliveryChannel: 'WHATSAPP',
            }),
          });
          if (res.ok) await reload();
        } catch { /* keep local */ }
      })();
      setShowAlertModal(false);
      return;
    }

    if (onDispatchAlert) {
      await onDispatchAlert(newAlert);
    }
    setAlerts([newAlert, ...alerts]);
    setShowAlertModal(false);
  };

  if (isLive && !liveLoaded) {
    return <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">Loading WhatsApp ops data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 rounded-xl p-6 text-white shadow-lg border border-emerald-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 mb-2">
              <span>💬 WhatsApp Site Ops Bot &amp; Webhook Engine</span>
              <span>•</span>
              <span>Two-Way Kenya Site Sync</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Field WhatsApp Bot &amp; Incident Dispatch</h1>
            <p className="text-sm text-emerald-200/80 mt-1">
              Project: <span className="font-semibold text-white">{projectName}</span> | Foremen &amp; fundis report daily diaries, materials &amp; safety hazards via WhatsApp (#DIARY, #DELIVERY, #INCIDENT)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSimModal(true)}
              disabled={isLive}
              title={isLive ? 'Inbound webhook simulation requires a signed site-ops token (demo mode only)' : undefined}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors shadow flex items-center gap-2"
            >
              <span>📲</span>
              <span>Simulate Inbound WhatsApp</span>
            </button>
            <button
              onClick={() => setShowAlertModal(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors shadow flex items-center gap-2"
            >
              <span>🚨</span>
              <span>Broadcast Safety Alert</span>
            </button>
          </div>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-emerald-800/50">
          <div className="bg-slate-900/60 rounded-lg p-3 border border-emerald-800/30">
            <div className="text-xs text-emerald-200/70">WhatsApp Messages Processed</div>
            <div className="text-xl font-bold text-white mt-1">{logs.length}</div>
            <div className="text-[10px] text-emerald-400 mt-1">100% Processed &amp; Parsed</div>
          </div>
          <div className="bg-slate-900/60 rounded-lg p-3 border border-emerald-800/30">
            <div className="text-xs text-emerald-200/70">Daily Diary Feeds</div>
            <div className="text-xl font-bold text-white mt-1">{logs.filter((l) => l.detectedCommand === 'DIARY').length}</div>
            <div className="text-[10px] text-slate-400 mt-1">Auto-logged to Site Ledger</div>
          </div>
          <div className="bg-slate-900/60 rounded-lg p-3 border border-emerald-800/30">
            <div className="text-xs text-emerald-200/70">Material Delivery Slips</div>
            <div className="text-xl font-bold text-emerald-300 mt-1">{logs.filter((l) => l.detectedCommand === 'DELIVERY').length}</div>
            <div className="text-[10px] text-emerald-300/80 mt-1">GRN Reconciliation Ready</div>
          </div>
          <div className="bg-slate-900/60 rounded-lg p-3 border border-emerald-800/30">
            <div className="text-xs text-emerald-200/70">Emergency Safety Alerts</div>
            <div className="text-xl font-bold text-rose-400 mt-1">{alerts.length}</div>
            <div className="text-[10px] text-rose-300 mt-1">Dispatched to Engineers</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('CHAT_FEED')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'CHAT_FEED'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <span>📱 Inbound WhatsApp Stream ({logs.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('EMERGENCY_ALERTS')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'EMERGENCY_ALERTS'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <span>🚨 Dispatched Emergency Alerts ({alerts.length})</span>
        </button>
      </div>

      {/* Tab 1: WhatsApp Stream Feed */}
      {activeTab === 'CHAT_FEED' && (
        <div className="space-y-4">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold">
                    WA
                  </span>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {log.senderName} <span className="font-mono text-xs font-normal text-slate-500">({log.senderPhone})</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Via Meta WhatsApp Cloud API
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      log.detectedCommand === 'INCIDENT'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : log.detectedCommand === 'DELIVERY'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : log.detectedCommand === 'DIARY'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    #{log.detectedCommand}
                  </span>
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-mono">
                    ✓ {log.processedStatus}
                  </span>
                </div>
              </div>

              {/* Message and Swahili Bot Reply */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Incoming Field Message
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200 italic">
                    "{log.rawMessage}"
                  </p>
                </div>

                <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40">
                  <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">
                    Automated Swahili / English Reply
                  </div>
                  <p className="text-sm text-emerald-900 dark:text-emerald-200">
                    {log.replyMessage}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Emergency Alerts Table */}
      {activeTab === 'EMERGENCY_ALERTS' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
              Critical Emergency Push &amp; WhatsApp Broadcasts
            </h3>
            <span className="text-xs text-rose-500 font-medium">
              Zero Latency Instant Dispatch
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Alert Trigger Type</th>
                  <th className="py-3 px-4">Message Body</th>
                  <th className="py-3 px-4 text-center">Delivery Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                {alerts.map((alt) => (
                  <tr key={alt.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {alt.recipientName}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                        {alt.recipientRole}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">{alt.recipientPhone}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                        🚨 {alt.alertType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate">
                      {alt.messageBody}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        ✓ {alt.deliveryStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Simulate Inbound WhatsApp Modal */}
      {showSimModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Simulate Inbound WhatsApp / SMS Message
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Simulates webhook payload received from Twilio or Meta WhatsApp Cloud API.
            </p>
            <form onSubmit={handleSimulateSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sender Name
                  </label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone (+254...)
                  </label>
                  <input
                    type="text"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  WhatsApp Message Body
                </label>
                <textarea
                  rows={4}
                  value={rawMessage}
                  onChange={(e) => setRawMessage(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono text-sm"
                  placeholder="E.g. #DIARY 12 masons, 18 casuals or #DELIVERY 100 bags Bamburi or #INCIDENT scaffolding damage"
                  required
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  Prefix with <code>#DIARY</code>, <code>#DELIVERY</code>, <code>#INCIDENT</code>, or <code>#FUEL</code>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSimModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow"
                >
                  Simulate Webhook POST
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Broadcast Emergency Alert Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Broadcast Emergency Safety Alert
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Dispatches instant WhatsApp &amp; SMS notifications to site leadership team.
            </p>
            <form onSubmit={handleDispatchAlertSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Recipient Name
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone (+254...)
                  </label>
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Role
                  </label>
                  <select
                    value={recipientRole}
                    onChange={(e) => setRecipientRole(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  >
                    <option value="PROJECT_MANAGER">Project Manager</option>
                    <option value="SAFETY_OFFICER">Safety Officer</option>
                    <option value="QUANTITY_SURVEYOR">Quantity Surveyor</option>
                    <option value="SITE_SUPERVISOR">Site Supervisor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Alert Type
                  </label>
                  <select
                    value={alertType}
                    onChange={(e: any) => setAlertType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-semibold text-rose-600"
                  >
                    <option value="CRITICAL_SAFETY_STOP_WORK">CRITICAL STOP-WORK</option>
                    <option value="STRUCTURAL_CONCRETE_FAIL">CONCRETE CUBE FAILURE</option>
                    <option value="DIESEL_DISCREPANCY_FLAG">DIESEL DISCREPANCY ALERT</option>
                    <option value="DIESEL_SIPHONING_FLAG">DIESEL DISCREPANCY (LEGACY FLAG)</option>
                    <option value="BUDGET_OVERRUN">BUDGET OVERRUN ALERT</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Message Body
                </label>
                <textarea
                  rows={3}
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAlertModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg shadow"
                >
                  Broadcast Immediate Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
