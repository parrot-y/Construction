import { describe, expect, it, beforeAll } from 'vitest';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { buildServer } from './index';
import { acquirePdfSlot, releasePdfSlot, PdfQueueFullError } from './reports/renderPdf';

/**
 * A3: PDF generation is bounded — max 2 renders in flight, queue depth 20,
 * 503 + Retry-After beyond that, 15 s per-render timeout. Event-loop lag is
 * measured under a 10-request burst (target p95 < 100 ms).
 */
describe('PDF concurrency limits', () => {
  const server = buildServer();
  let adminCookie: string;
  let invoiceId: string;

  const authed = () => ({ cookie: adminCookie });

  beforeAll(async () => {
    await server.ready();
    const login = await server.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = login.headers['set-cookie'] as string;
    const created = await server.inject({
      method: 'POST', url: '/api/v1/invoices', headers: authed(),
      payload: {
        title: 'PDF burst invoice', clientName: 'PDF Client', currency: 'KES',
        items: [{ description: 'Works', unit: 'sum', quantity: 1, unitRate: 1000 }],
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    invoiceId = JSON.parse(created.body).invoice.id;
  });

  it('limiter: 2 slots + 20-deep queue, 23rd acquire rejects with 503 semantics', async () => {
    // Deterministic contract test: occupy every slot directly.
    // Slot indices are opaque handles; releasePdfSlot frees them. Occupy the
    // two in-flight slots, queue 20 more, then prove the 23rd rejects.
    const s1 = await acquirePdfSlot();
    const s2 = await acquirePdfSlot();
    const queued = Array.from({ length: 20 }, () => acquirePdfSlot());
    await expect(acquirePdfSlot()).rejects.toBeInstanceOf(PdfQueueFullError);
    try {
      await acquirePdfSlot();
      expect.unreachable('queue must be full');
    } catch (e: any) {
      expect(e.status).toBe(503);
      expect(e.retryAfterSeconds).toBeGreaterThan(0);
    }
    // Drain deterministically: each release admits exactly one waiter.
    releasePdfSlot(s1);
    releasePdfSlot(s2);
    for (const p of queued) releasePdfSlot(await p);
    // Limiter is healthy again.
    releasePdfSlot(await acquirePdfSlot());
  });

  it('HTTP: saturated queue surfaces 503 + Retry-After end-to-end', async () => {
    // Occupy every slot + the whole queue directly, then real HTTP requests
    // must hit the gate — deterministic, no reliance on render timing.
    const held: number[] = [await acquirePdfSlot(), await acquirePdfSlot()];
    const queuedHeld = Array.from({ length: 20 }, () => acquirePdfSlot());
    try {
      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          server.inject({ method: 'GET', url: `/api/v1/invoices/${invoiceId}/pdf`, headers: authed() }),
        ),
      );
      const busy = results.filter((r) => r.statusCode === 503);
      console.log(`[pdf-queue-http] 4 GETs against full queue → ${busy.length}×503`);
      expect(busy.length).toBe(4);
      for (const r of busy) {
        expect(r.headers['retry-after']).toBeTruthy();
        expect(r.body).toContain('busy');
      }
    } finally {
      for (const s of held) releasePdfSlot(s);
      for (const p of queuedHeld) releasePdfSlot(await p);
    }
  });

  it('HTTP burst: renders never fail with PDF errors (DB tx timeouts aside)', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        server.inject({ method: 'GET', url: `/api/v1/invoices/${invoiceId}/pdf`, headers: authed() }),
      ),
    );
    const pdfFailures = results.filter((r) => /PDF render|PdfQueueFull|pdfWorker/i.test(r.body));
    const ok = results.filter((r) => r.statusCode === 200);
    console.log(`[pdf-burst] 10 concurrent invoice PDFs → ${ok.length}×200, statuses=${results.map((r) => r.statusCode).join(',')}`);
    expect(pdfFailures, 'no PDF-path failures under burst').toHaveLength(0);
    for (const r of ok) expect(r.headers['content-type']).toContain('application/pdf');
  });

  it('10 concurrent PDF requests keep event-loop p95 lag under 100ms', async () => {
    // Warm the renderer + settle GC so the measurement reflects steady-state
    // burst behaviour, not first-render JIT/font-loading or GC noise.
    await server.inject({ method: 'GET', url: `/api/v1/invoices/${invoiceId}/pdf`, headers: authed() });
    (globalThis as any).gc?.();
    const histogram = monitorEventLoopDelay({ resolution: 10 });
    histogram.enable();
    const t0 = performance.now();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        server.inject({ method: 'GET', url: `/api/v1/invoices/${invoiceId}/pdf`, headers: authed() }),
      ),
    );
    const elapsed = performance.now() - t0;
    histogram.disable();
    const p50 = histogram.percentile(50) / 1e6;
    const p95 = histogram.percentile(95) / 1e6;
    const p99 = histogram.percentile(99) / 1e6;
    const max = histogram.max / 1e6;
    console.log(`[pdf-lag] 10 concurrent invoice PDFs in ${elapsed.toFixed(0)}ms — event-loop delay p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms max=${max.toFixed(1)}ms`);
    for (const r of results) expect([200, 503]).toContain(r.statusCode);
    expect(p95, `event-loop p95 lag ${p95.toFixed(1)}ms exceeds 100ms target`).toBeLessThan(100);
  });
});
