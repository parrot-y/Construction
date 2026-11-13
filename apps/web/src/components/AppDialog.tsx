import { useCallback, useEffect, useRef, useState } from 'react';

export interface DialogOptions {
  title: string;
  message?: string;
  /** 'prompt' shows a labelled input and resolves with its value (null on cancel). */
  mode?: 'confirm' | 'prompt';
  inputLabel?: string;
  inputPlaceholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** When set, confirm stays disabled until the value meets this length. */
  minLength?: number;
}

interface Pending {
  opts: DialogOptions;
  resolve: (value: string | boolean | null) => void;
}

const FOCUSABLE = 'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible replacement for window.confirm/window.prompt: focus trap,
 * Escape cancels, labelled controls, 44px targets, resolves a promise.
 * Render `{dialog.element}` once per view; call `await dialog.ask(opts)`.
 */
export function useAppDialog() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const settle = useCallback((result: string | boolean | null) => {
    setPending((p) => {
      p?.resolve(result);
      return null;
    });
    previousFocus.current?.focus?.();
  }, []);

  const ask = useCallback((opts: DialogOptions): Promise<string | boolean | null> => {
    setValue(opts.defaultValue ?? '');
    previousFocus.current = document.activeElement as HTMLElement | null;
    return new Promise((resolve) => setPending({ opts, resolve }));
  }, []);

  // Confirm → true; prompt → string ('' allowed only if no minLength); cancel → null/false.
  const confirm = useCallback((opts: Omit<DialogOptions, 'mode'>): Promise<boolean> =>
    ask({ ...opts, mode: 'confirm' }).then((v) => v === true), [ask]);
  const prompt = useCallback((opts: Omit<DialogOptions, 'mode'>): Promise<string | null> =>
    ask({ ...opts, mode: 'prompt' }).then((v) => (typeof v === 'string' ? v : null)), [ask]);

  useEffect(() => {
    if (!pending) return;
    const el = dialogRef.current;
    const focusables = el?.querySelectorAll<HTMLElement>(FOCUSABLE);
    (focusables?.[0] ?? el)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); settle(pending.opts.mode === 'prompt' ? null : false); return; }
      if (e.key !== 'Tab' || !el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => !n.hasAttribute('disabled'));
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [pending, settle]);

  const tooShort = pending?.opts.mode === 'prompt' && (pending.opts.minLength ?? 0) > 0 && value.trim().length < (pending.opts.minLength ?? 0);

  const element = pending ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/50" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        tabIndex={-1}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 outline-none"
      >
        <h2 id="app-dialog-title" className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
          {pending.opts.title}
        </h2>
        {pending.opts.message && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 whitespace-pre-line">{pending.opts.message}</p>
        )}
        {pending.opts.mode === 'prompt' && (
          <div className="mb-4">
            <label htmlFor="app-dialog-input" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              {pending.opts.inputLabel ?? 'Value'}
            </label>
            <input
              id="app-dialog-input"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={pending.opts.inputPlaceholder}
              className="w-full min-h-11 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            {tooShort && (
              <p className="text-xs text-red-600 mt-1">At least {(pending.opts.minLength ?? 0)} characters required.</p>
            )}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => settle(pending.opts.mode === 'prompt' ? null : false)}
            className="min-h-11 px-5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            {pending.opts.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            disabled={!!tooShort}
            onClick={() => settle(pending.opts.mode === 'prompt' ? value : true)}
            className={`min-h-11 px-5 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 ${
              pending.opts.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            {pending.opts.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { ask, confirm, prompt, element };
}
