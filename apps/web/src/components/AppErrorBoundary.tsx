import React from 'react';
import * as Sentry from '@sentry/react';
import { PRODUCT_NAME } from '../lib/product';

interface Props {
  children: React.ReactNode;
  /** Short label for Sentry tags, e.g. "portal:consultant" or "console:money". */
  label?: string;
}
interface State {
  error: Error | null;
  refId: string | null;
}

/**
 * Route/module-level crash guard. A render failure inside a portal view or
 * console section shows a recoverable fallback — the shell stays alive —
 * and reports to Sentry with a user-visible reference id.
 */
export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, refId: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const refId = crypto.randomUUID();
    this.setState({ refId });
    Sentry.captureException(error, {
      tags: { boundary: this.props.label ?? 'app' },
      extra: { refId, componentStack: info.componentStack },
    });
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6" role="alert">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-red-500 text-xl font-bold mb-4">!</div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            This section hit an unexpected error. The rest of {PRODUCT_NAME} is still working.
          </p>
          {this.state.refId && (
            <p className="text-xs text-slate-400 mb-5">Reference: <code className="font-mono">{this.state.refId}</code></p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
