import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { apiErrorMessage } from '../../lib/api';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (err: unknown, fallback?: string) => void;
  info: (message: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

const KIND_STYLES: Record<ToastKind, string> = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  error: 'border-red-300 bg-red-50 text-red-900',
  info: 'border-slate-300 bg-white text-slate-800',
};

/**
 * P1.2 — the one toast channel. `toast.error(err)` accepts ANY thrown value
 * and renders the plain apiErrorMessage — raw TypeErrors never reach users.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setItems((cur) => [...cur.slice(-4), { id, kind, message }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), kind === 'error' ? 8000 : 4500);
  }, []);

  const api = useMemo<ToastApi>(() => ({
    success: (m) => push('success', m),
    error: (err, fallback) => push('error', apiErrorMessage(err, fallback)),
    info: (m) => push('info', m),
  }), [push]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed bottom-20 sm:bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2 pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto rounded-lg border px-3.5 py-2.5 text-sm font-medium shadow-lg ${KIND_STYLES[t.kind]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  // Safe fallback outside the provider (tests, isolated views).
  return ctx ?? {
    success: () => {},
    error: (err, fallback) => { console.error(apiErrorMessage(err, fallback)); },
    info: () => {},
  };
}
