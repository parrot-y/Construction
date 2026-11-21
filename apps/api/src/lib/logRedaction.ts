/**
 * Log redaction (staging hardening): portal bearer tokens live in URL paths
 * (`/api/v1/portals/<type>/<token>/...`) and query strings. Request logs must
 * never persist them, nor cookie/authorization headers or password fields.
 */

const PORTAL_PATH = /(\/api\/v1\/portals\/[a-z-]+\/)[^/?#]+/gi;
const TOKEN_QUERY = /([?&](?:token|access_token|refresh_token|pin)=)[^&#\s]*/gi;
const SECRET_HEADERS = new Set(['cookie', 'authorization', 'set-cookie', 'x-api-key']);
const SECRET_FIELDS = /pass(word)?|pin|secret|token|authorization|cookie/i;

export function redactUrl(url: string | undefined | null): string {
  if (!url) return '';
  return String(url)
    .replace(PORTAL_PATH, '$1[redacted]')
    .replace(TOKEN_QUERY, '$1[redacted]');
}

/** Sanitize a headers object for logging: drop credential-bearing headers. */
export function redactHeaders(headers: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const [k, v] of Object.entries(headers)) {
    if (SECRET_HEADERS.has(k.toLowerCase())) {
      out[k] = '[redacted]';
    } else {
      out[k] = Array.isArray(v) ? v.join(', ') : String(v);
    }
  }
  return out;
}

/** Recursively redact secret-looking keys in a logged object (bodies, errors). */
export function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_FIELDS.test(k) ? '[redacted]' : redactDeep(v, depth + 1);
  }
  return out;
}
