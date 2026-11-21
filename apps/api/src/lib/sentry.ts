import * as Sentry from '@sentry/node';

/**
 * Error monitoring (staging hardening). No-op unless SENTRY_DSN is set —
 * dev/e2e runs never emit. PII is scrubbed in beforeSend: no cookies,
 * authorization headers, request bodies, or user emails/IPs leave the box.
 */

const SENSITIVE_KEYS = /pass(word)?|pin|secret|token|authorization|cookie|email|phone|ip|address/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.test(k) ? '[redacted]' : scrub(v, depth + 1);
  }
  return out;
}

let initialized = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || initialized) return;
  initialized = true;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || process.env.GIT_SHA || undefined,
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : 0.1,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.headers?.authorization;
        delete event.request.headers?.cookie;
        if (event.request.url) {
          event.request.url = event.request.url.replace(
            /(\/api\/v1\/portals\/[a-z-]+\/)[^/?#]+/gi,
            '$1[redacted]',
          );
        }
      }
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      if (event.extra) event.extra = scrub(event.extra) as Record<string, unknown>;
      if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;
      return event;
    },
  });
}

export { Sentry };
