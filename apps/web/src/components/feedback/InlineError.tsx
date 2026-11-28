import type { ReactNode } from 'react';
import { apiErrorMessage } from '../../lib/api';

/**
 * P1.2 — inline error next to a form/section. Accepts ANY thrown value and
 * renders the plain apiErrorMessage. Optionally offers Try again.
 */
export function InlineError({ error, onRetry, className = '' }: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  if (!error) return null;
  return (
    <div role="alert" className={`flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 ${className}`}>
      <span className="flex-1">{apiErrorMessage(error)}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-bold text-red-700 underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * P1.2 — form-level error banner. `fields` maps input names to messages
 * (from ApiError.fields or local validation).
 */
export function FormError({ error, fields, className = '' }: {
  error?: unknown;
  fields?: Record<string, string>;
  className?: string;
}) {
  const hasFields = fields && Object.keys(fields).length > 0;
  if (!error && !hasFields) return null;
  return (
    <div role="alert" className={`rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 ${className}`}>
      {error ? <p className="font-semibold">{apiErrorMessage(error)}</p> : null}
      {hasFields && (
        <ul className="mt-1 list-disc pl-5 space-y-0.5">
          {Object.entries(fields!).map(([k, v]) => <li key={k}><span className="font-medium">{k}:</span> {v}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Field-level message under a single input. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="mt-1 text-xs font-medium text-red-700">{message}</p>;
}

/** Busy label for submit buttons — disables + shows progress. */
export function SubmitLabel({ busy, idle, busyText = 'Saving…' }: { busy: boolean; idle: ReactNode; busyText?: string }) {
  return <>{busy ? busyText : idle}</>;
}
