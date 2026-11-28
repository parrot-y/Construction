import React, { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * P1.6 — lazy() throws "Failed to fetch dynamically imported module" when a
 * chunk cannot be downloaded (offline, flaky link, stale deploy). Left raw,
 * that rejection crashes the route error boundary. lazyChunk degrades to an
 * honest, recoverable panel instead: plain words, a Retry that reloads.
 */
function ChunkUnavailable(): React.JSX.Element {
  return (
    <div className="min-h-[40vh] flex items-center justify-center p-6" role="alert">
      <div className="max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center shadow-sm">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">This section didn't load</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          We couldn't download this part of SiteSafi — usually a connection problem. Check your network and try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 px-6 py-2.5 rounded-lg bg-orange-700 hover:bg-orange-800 text-white text-sm font-semibold transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export function lazyChunk<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch(() => Promise.resolve({ default: ChunkUnavailable as unknown as T })),
  );
}

/** Fire-and-forget chunk warm — failures are expected offline and harmless. */
export function warmChunk(factory: () => Promise<unknown>): void {
  // Warm is best-effort: offline or a flaky link just means the chunk loads
  // on first navigation instead — never worth surfacing.
  void factory().catch(() => {}); // eslint-disable-line -- intentional
}
