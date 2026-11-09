/**
 * Shared portal link state component (audit item 11):
 * expired, revoked/invalid, and generic error states for all external portals.
 */
export function PortalLinkNotice({ kind, message }: { kind: 'expired' | 'revoked' | 'error'; message?: string }) {
  const copy =
    kind === 'expired'
      ? { title: 'This link has expired', body: 'Portal links are time-limited. Ask the project team to regenerate your access link.' }
      : kind === 'revoked'
        ? { title: 'This link was revoked', body: 'Access to this portal has been withdrawn. Contact the project team if you believe this is a mistake.' }
        : { title: 'Something went wrong', body: message || 'We could not load this portal. Check your connection and try again.' };
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
        <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${kind === 'error' ? 'bg-red-50' : 'bg-amber-50'}`}>
          <svg className={`w-6 h-6 ${kind === 'error' ? 'text-red-600' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {kind === 'error' ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            )}
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">{copy.title}</h2>
        <p className="text-sm text-slate-600">{copy.body}</p>
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
