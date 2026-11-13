export type PortalLinkKind = 'link' | 'rateLimited' | 'offline' | 'error';

/**
 * Classify a portal-load failure into a plain-language state. API returns
 * 404 for invalid/expired/revoked tokens (no tenant data is disclosed for a
 * bad token, so the contractor name is never shown here).
 */
export function portalErrorKind(e: any): PortalLinkKind {
  const status = e?.status ?? e?.statusCode;
  if (status === 429) return 'rateLimited';
  if (status === 404 || status === 410) return 'link';
  if (e instanceof TypeError || /failed to fetch|network\s?error|load failed|network request failed/i.test(e?.message || '')) return 'offline';
  if (/expired|revoked|invalid|not found/i.test(e?.message || '')) return 'link';
  return 'error';
}

/** Attach the HTTP status to an error so portalErrorKind can classify it. */
export function portalHttpError(message: string, status: number): Error {
  const e = new Error(message) as Error & { status: number };
  e.status = status;
  return e;
}

const COPY: Record<PortalLinkKind, { title: string; body: string }> = {
  link: {
    title: 'This link has expired or been switched off',
    body: 'Ask the project team to send you a new link.',
  },
  rateLimited: {
    title: 'Too many attempts',
    body: 'Wait a minute and try again.',
  },
  offline: {
    title: "Can't reach SiteSafi",
    body: 'Check your connection and try again.',
  },
  error: {
    title: 'Something went wrong',
    body: 'We could not load this portal. Please try again.',
  },
};

/** Shared failure screen for all external portals — distinct, plain-language states. */
export function PortalLinkNotice({ kind, message, onRetry }: { kind: PortalLinkKind; message?: string; onRetry?: () => void }) {
  const copy = COPY[kind];
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center shadow-sm">
        <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${kind === 'error' || kind === 'link' ? 'bg-amber-50 dark:bg-amber-950/40' : 'bg-red-50 dark:bg-red-950/40'}`}>
          <svg className={`w-6 h-6 ${kind === 'error' || kind === 'link' ? 'text-amber-600' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {kind === 'offline' ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12 20.25h.008v.008H12v-.008z" />
            ) : kind === 'rateLimited' ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            )}
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{copy.title}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">{kind === 'error' && message ? message : copy.body}</p>
        {kind === 'offline' && (
          <button
            type="button"
            onClick={onRetry ?? (() => window.location.reload())}
            className="mt-5 min-h-11 px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

/** Amber banner shown while a valid link approaches/passes its expiry date. */
export function PortalExpiryBanner({ expiresAt }: { expiresAt?: string | null }) {
  if (!expiresAt) return null;
  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (daysLeft > 14) return null;
  return (
    <div className={`px-4 py-2.5 text-xs font-medium border-b ${daysLeft <= 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
      {daysLeft <= 0
        ? 'This portal link has expired — contact the project team for a new link.'
        : `This portal link expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${new Date(expiresAt).toLocaleDateString('en-KE')}).`}
    </div>
  );
}
