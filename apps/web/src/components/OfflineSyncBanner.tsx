import React, { useState, useEffect, useCallback } from 'react';
import { getQueuedMutations, flushSyncQueue, OfflineMutationRecord } from '../services/offline-sync';
import { onApiUnreachable, apiTransport } from '../lib/api';

const HEALTH_URL = '/health';

/**
 * P1.5 — connection status, honestly shown:
 *  - a small status dot is always present (no permanent banner)
 *  - amber message only when offline or changes are waiting to send
 *  - "Can't reach the server" + health poll when api calls fail with
 *    kind 'network' (emitted by lib/api via onApiUnreachable)
 */
export default function OfflineSyncBanner(): React.JSX.Element | null {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [queue, setQueue] = useState<OfflineMutationRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState<boolean>(false);
  const [retrying, setRetrying] = useState<boolean>(false);

  const refreshQueue = useCallback(async () => {
    try {
      const items = await getQueuedMutations();
      setQueue(items);
    } catch {
      // IndexedDB unavailable (private mode etc.) — nothing queued to show.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => { setIsOnline(true); handleSync(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // P1.5: api layer emits when a request fails with kind 'network'.
    const offUnreachable = onApiUnreachable(() => setUnreachable(true));

    refreshQueue();
    const interval = setInterval(refreshQueue, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      offUnreachable();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshQueue]);

  // Health poll while the unreachable banner is shown — clears it on recovery.
  useEffect(() => {
    if (!unreachable) return;
    let stopped = false;
    const poll = async () => {
      try {
        const res = await apiTransport(HEALTH_URL, { timeoutMs: 8_000 });
        if (res.ok && !stopped) {
          setUnreachable(false);
          setIsOnline(true);
          void refreshQueue();
        }
      } catch {
        // still unreachable — keep polling
      }
    };
    void poll();
    const t = setInterval(poll, 10_000);
    return () => { stopped = true; clearInterval(t); };
  }, [unreachable, refreshQueue]);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const result = await flushSyncQueue();
      if (result.syncedCount > 0) {
        setSyncMessage(`Sent ${result.syncedCount} saved ${result.syncedCount === 1 ? 'entry' : 'entries'}`);
      }
      await refreshQueue();
    } catch {
      setSyncMessage('Sync attempted; will retry when the network stabilizes.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await apiTransport(HEALTH_URL, { timeoutMs: 8_000 });
      if (res.ok) {
        setUnreachable(false);
        setIsOnline(true);
        await handleSync();
      }
    } catch {
      // still down — banner stays
    } finally {
      setRetrying(false);
    }
  };

  const dotColor = unreachable || !isOnline ? 'bg-amber-500' : queue.length > 0 ? 'bg-blue-500' : 'bg-emerald-500';
  const dotTitle = unreachable ? "Can't reach the server" : !isOnline ? 'Offline' : queue.length > 0 ? 'Syncing saved changes' : 'Online';

  // Compact status dot — always rendered, never a banner by itself.
  const dot = (
    <span
      title={dotTitle}
      aria-label={dotTitle}
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotColor}${unreachable || !isOnline || queue.length > 0 ? ' animate-pulse' : ''}`}
    />
  );

  if (unreachable) {
    return (
      <div className="p-3 rounded-xl border bg-amber-50 border-amber-300 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <div>
            <span className="font-bold">Can't reach the server. Retrying…</span>
            <p className="text-[11px] opacity-90 mt-0.5">Your changes are kept. We'll reconnect automatically.</p>
          </div>
        </div>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="px-3 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md transition disabled:opacity-50"
        >
          {retrying ? 'Checking…' : 'Retry now'}
        </button>
      </div>
    );
  }

  if (!isOnline || queue.length > 0 || syncMessage) {
    return (
      <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition ${
        !isOnline ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-blue-50 border-blue-200 text-blue-900'
      }`}>
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${!isOnline ? 'bg-amber-500' : 'bg-blue-500 animate-pulse'}`} />
          <div>
            <span className="font-bold">{!isOnline ? 'Working offline' : 'Sending saved changes'}</span>
            <p className="text-[11px] opacity-90 mt-0.5">
              {!isOnline
                ? 'Saved on this phone — will send when you have signal.'
                : queue.length > 0
                  ? `${queue.length} entr${queue.length === 1 ? 'y' : 'ies'} saved on this phone, sending…`
                  : 'All sent.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-200 text-amber-900 tabular-nums">
              {queue.length} Queued
            </span>
          )}
          {isOnline && queue.length > 0 && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-xs transition disabled:opacity-50"
            >
              {isSyncing ? 'Syncing…' : 'Sync now'}
            </button>
          )}
          {syncMessage && (
            <span className="text-[11px] font-medium text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
              {syncMessage}
            </span>
          )}
        </div>
      </div>
    );
  }

  // All good: just the dot, inline with surrounding chrome.
  return <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">{dot}Online</span>;
}
