import { test, expect } from '@playwright/test';

/**
 * Stage-7 — web security headers (dev contract).
 * The SPA must be served with a strict CSP (no unsafe-inline scripts),
 * HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy and Permissions-Policy
 * in every non-dev environment — enforced here against the dev server which
 * emits the identical header set via vite.config.ts (parity with nginx.conf).
 */
test.describe('Web security headers', () => {
  test('root document carries the full header set', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBe(200);
    const h = res.headers();

    const csp = h['content-security-policy'] || '';
    expect(csp, 'CSP must be present').toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("script-src 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('upgrade-insecure-requests');

    expect(h['strict-transport-security']).toContain('max-age=');
    expect(h['x-frame-options']?.toUpperCase()).toBe('DENY');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBeTruthy();
    expect(h['permissions-policy']).toBeTruthy();
  });

  test('client-side navigation fallback also carries headers', async ({ request }) => {
    const res = await request.get('/some/spa/route');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers()['x-frame-options']?.toUpperCase()).toBe('DENY');
  });
});
