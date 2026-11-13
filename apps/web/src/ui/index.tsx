import React from 'react';

/** Product UI kit — see docs/DESIGN_SYSTEM.md. */

// ---------------------------------------------------------------- formatKes
const kesFormatter = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0});

/**"KES 2,250,000" — accepts Decimal-ish strings/numbers; never shows raw decimals. */
export function formatKes(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return '—';
  return `KES ${kesFormatter.format(Math.round(n))}`;
}

// ------------------------------------------------------------------ Button
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const btnBase =
  'inline-flex items-center justify-center gap-1.5 font-bold rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const btnVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600',
  secondary: 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50',
  ghost: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 focus-visible:outline-danger-600',
};
const btnSizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs min-h-[36px]',
  md: 'px-4 py-2 text-sm min-h-[44px]',
};

export function Button({
  variant = 'primary', size = 'md', className = '', ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize}) {
  return<button className={`${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${className}`} {...props} />;
}

// ------------------------------------------------------------------- Input
export function Input({ label, error, className = '', id, ...props}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string}) {
  const inputId = id ?? props.name;
  return (
<div className={className}>
      {label &&<label htmlFor={inputId} className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{label}</label>}
<input
        id={inputId}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600"
        {...props}
      />
      {error &&<p className="mt-1 text-xs text-danger-600">{error}</p>}
</div>
);
}

export function Select({ label, className = '', id, children, ...props}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string}) {
  const inputId = id ?? props.name;
  return (
<div className={className}>
      {label &&<label htmlFor={inputId} className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{label}</label>}
<select
        id={inputId}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600"
        {...props}
      >
        {children}
</select>
</div>
);
}

// -------------------------------------------------------------------- Card
export function Card({ className = '', children, ...props}: React.HTMLAttributes<HTMLDivElement>) {
  return (
<div className={`bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm ${className}`} {...props}>
      {children}
</div>
);
}

// ------------------------------------------------------------------- Badge
type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';
const badgeTones: Record<BadgeTone, string> = {
  success: 'bg-success-50 text-success-700 dark:bg-success-50/10 dark:text-success-600',
  warning: 'bg-warning-50 text-warning-700 dark:bg-warning-50/10 dark:text-warning-600',
  danger: 'bg-danger-50 text-danger-700 dark:bg-danger-50/10 dark:text-danger-600',
  info: 'bg-info-50 text-info-700 dark:bg-info-50/10 dark:text-info-600',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-50/10 dark:text-brand-500',
};

export function Badge({ tone = 'neutral', children, className = ''}: { tone?: BadgeTone; children: React.ReactNode; className?: string}) {
  return (
<span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${badgeTones[tone]} ${className}`}>
      {children}
</span>
);
}

// -------------------------------------------------------------------- Tabs
export function Tabs({ tabs, active, onChange}: { tabs: { id: string; label: string}[]; active: string; onChange: (id: string) => void}) {
  return (
<div role="tablist" className="flex gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
      {tabs.map((t) => (
<button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={`px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition ${
            active === t.id
              ? 'border-brand-600 text-brand-700 dark:text-brand-500'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
}`}
        >
          {t.label}
</button>
))}
</div>
);
}

// ------------------------------------------------------------------- Modal
export function Modal({ open, onClose, title, children, wide}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose();};
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
}, [open, onClose]);
  if (!open) return null;
  return (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
<div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
<div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
<button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
</div>
<div className="px-5 py-4">{children}</div>
</div>
</div>
);
}

// ------------------------------------------------------------------ States
export function EmptyState({ title, hint, action}: { title: string; hint?: string; action?: React.ReactNode}) {
  return (
<div className="flex flex-col items-center justify-center text-center py-10 px-4">
<div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
<svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
</div>
<p className="text-sm font-bold text-slate-700 dark:text-slate-300">{title}</p>
      {hint &&<p className="text-xs text-slate-400 mt-1 max-w-sm">{hint}</p>}
      {action &&<div className="mt-4">{action}</div>}
</div>
);
}

export function ErrorState({ message, onRetry}: { message?: string; onRetry?: () => void}) {
  return (
<div className="flex flex-col items-center justify-center text-center py-10 px-4">
<p className="text-sm font-bold text-danger-600">Something went wrong</p>
      {message &&<p className="text-xs text-slate-400 mt-1 max-w-sm">{message}</p>}
      {onRetry &&<Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Retry</Button>}
</div>
);
}

export function Skeleton({ className = ''}: { className?: string}) {
  return<div className={`animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800 ${className}`} />;
}

// -------------------------------------------------------------- PageHeader
export function PageHeader({ title, subtitle, actions}: { title: string; subtitle?: string; actions?: React.ReactNode}) {
  return (
<div className="flex flex-wrap items-start justify-between gap-3 mb-5">
<div>
<h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle &&<p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
</div>
      {actions &&<div className="flex items-center gap-2">{actions}</div>}
</div>
);
}

// ------------------------------------------------------------------- Table
export function Table({ head, children}: { head: string[]; children: React.ReactNode}) {
  return (
<div className="overflow-x-auto">
<table className="w-full text-sm">
<thead>
<tr className="border-b border-slate-200 dark:border-slate-800 text-left">
            {head.map((h) => (
<th key={h} className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
))}
</tr>
</thead>
<tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
</table>
</div>
);
}

// ------------------------------------------------------- CopyWhatsAppButton
/** Copies a prefilled WhatsApp message (link + context). Sending stays simulated — this only copies text. */
export function CopyWhatsAppButton({
  message, label = 'Copy WhatsApp', className = '',
}: { message: string; label?: string; className?: string}) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context) — leave button state unchanged.
    }
  };
  return (
<button
      type="button"
      onClick={() => void copy()}
      title="Copies a prefilled WhatsApp message — sending is not automated"
      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md transition ${className}`}
    >
      {copied ? 'Copied!' : label}
</button>
);
}
