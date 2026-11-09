import React, { useState, useEffect} from 'react';
import { getQueuedMutations, flushSyncQueue, OfflineMutationRecord} from '../services/offline-sync';

export default function OfflineSyncBanner(): React.JSX.Element | null {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
);
  const [queue, setQueue] = useState<OfflineMutationRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const refreshQueue = async () => {
    try {
      const items = await getQueuedMutations();
      setQueue(items);
} catch {
      // Ignored in non-browser environment
}
};

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      handleSync();
};

    const handleOffline = () => {
      setIsOnline(false);
};

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    refreshQueue();
    const interval = setInterval(refreshQueue, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
};
}, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const result = await flushSyncQueue();
      if (result.syncedCount > 0) {
        setSyncMessage(` Synced ${result.syncedCount} offline record(s) to server`);
}
      await refreshQueue();
} catch {
      setSyncMessage(' Sync attempted; will retry when network stabilizes');
} finally {
      setIsSyncing(false);
}
};

  // If online and queue is empty and no sync message, render compact status or hide
  if (isOnline && queue.length === 0 && !syncMessage) {
    return (
<div className="bg-emerald-50/80 border border-emerald-200/80 px-4 py-2 rounded-xl flex items-center justify-between text-xs text-emerald-800">
<div className="flex items-center gap-2">
<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
<span className="font-semibold">Online & Synchronized</span>
<span className="text-emerald-600 hidden sm:inline">• Real-time connection to Site Safi Cloud</span>
</div>
<span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-100 rounded border border-emerald-200 font-semibold">
          IndexedDB Offline Queue Active
</span>
</div>
);
}

  return (
<div
      className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition ${
        !isOnline
          ? 'bg-amber-50 border-amber-300 text-amber-900'
          : 'bg-blue-50 border-blue-200 text-blue-900'
}`}
    >
<div className="flex items-center gap-2.5">
<span
          className={`w-2.5 h-2.5 rounded-full ${
            !isOnline ? 'bg-amber-500' : 'bg-blue-500 animate-pulse'
}`}
        />
<div>
<span className="font-bold">
            {!isOnline ? 'Offline Mode (Working Locally)' : 'Connected • Offline Queue Sync'}
</span>
<p className="text-[11px] opacity-90 mt-0.5">
            {!isOnline
              ? 'Site diaries, progress updates, and photos will be saved locally in IndexedDB and uploaded when network restores.'
              : `${queue.length} field mutation(s) stored in client queue waiting to sync.`}
</p>
</div>
</div>

<div className="flex items-center gap-2">
        {queue.length > 0 && (
<span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-200 text-amber-900 font-mono">
            {queue.length} Queued
</span>
)}

        {isOnline && queue.length > 0 && (
<button
            onClick={handleSync}
            disabled={isSyncing}
            className="px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-xs transition disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : '↻ Sync Now'}
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
