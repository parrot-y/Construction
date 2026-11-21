import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { login, apiPost, apiGet, unwrap, API } from './helpers';

/**
 * Stage-7 — payment recording concurrency (dev contract).
 * Parallel identical payment POSTs must never double-post: the invoice row
 * lock + idempotency key + unique reference guarantee exactly one payment
 * row, and invoice.amount_paid always equals the sum of payment rows.
 */

const RUN = Date.now();

async function sentInvoice(request: any, admin: any, tag: string): Promise<string> {
  const inv = await apiPost(request, admin, '/api/v1/invoices', {
    title: `Concurrency ${tag} ${RUN}`, clientName: 'Concurrency Client', currency: 'KES',
    taxPct: 0,
    items: [{ description: 'Works', unit: 'sum', quantity: 1, unitRate: 100000 }],
  });
  expect(inv.status(), await inv.text()).toBe(201);
  const id = unwrap(await inv.json()).invoice?.id || unwrap(await inv.json()).id;
  const send = await apiPost(request, admin, `/api/v1/invoices/${id}/send`, { selfApprovalReason: 'Concurrency test send reason' });
  expect([200, 201], await send.text()).toContain(send.status());
  return id;
}

async function paymentRows(request: any, admin: any, invoiceId: string) {
  const res = await apiGet(request, admin, `/api/v1/invoices/${invoiceId}`);
  const body = unwrap(await res.json());
  const inv = body.invoice || body;
  return { payments: inv.payments || inv.payment_history || [], amountPaid: Number(inv.amount_paid ?? inv.amountPaid ?? 0) };
}

test.describe('Payment concurrency — race-safe + idempotent', () => {
  test('2 and 10 parallel identical payment POSTs record exactly one payment', async ({ request }) => {
    const admin = await login(request, 'admin@apexbuilders.co.ke');

    for (const burst of [2, 10]) {
      const invoiceId = await sentInvoice(request, admin, `burst-${burst}`);
      const key = `conc-${burst}-${randomUUID()}`;
      const payload = { amount: 100000, method: 'M_PESA', reference: `CC${burst}${RUN}` };

      const results = await Promise.all(
        Array.from({ length: burst }, () =>
          request.post(`${API}/api/v1/invoices/${invoiceId}/payments`, {
            headers: {
              cookie: admin.cookie,
              'content-type': 'application/json',
              'idempotency-key': key,
            },
            data: payload,
          }),
        ),
      );

      const statuses = results.map((r) => r.status());
      // Every request must succeed (replays return the original 201).
      for (const r of results) expect([200, 201], await r.text()).toContain(r.status());
      const bodies = await Promise.all(results.map((r) => r.json()));
      const paymentIds = new Set(bodies.map((b: any) => (b.payment || b.data?.payment)?.id).filter(Boolean));
      expect(paymentIds.size, `${burst} parallel posts must yield one payment id`).toBe(1);

      const { payments, amountPaid } = await paymentRows(request, admin, invoiceId);
      expect(payments.length, `${burst} parallel posts must yield exactly one payment row`).toBe(1);
      const sum = payments.reduce((a: number, p: any) => a + Number(p.amount ?? p.amount_kes ?? 0), 0);
      expect(amountPaid).toBeCloseTo(sum, 2);
    }

    // Distinct keys, same full amount: first wins, rest get 409 (PAID).
    const invoiceId = await sentInvoice(request, admin, 'distinct-keys');
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        apiPost(request, admin, `/api/v1/invoices/${invoiceId}/payments`, {
          amount: 100000, method: 'CASH', reference: `DK${i}${RUN}`,
        }, { 'idempotency-key': `dk-${i}-${randomUUID()}` }),
      ),
    );
    const ok = results.filter((r) => [200, 201].includes(r.status()));
    const conflicts = results.filter((r) => r.status() === 409);
    expect(ok.length, 'exactly one full payment may succeed').toBe(1);
    expect(conflicts.length + ok.length).toBe(5);

    const { payments, amountPaid } = await paymentRows(request, admin, invoiceId);
    expect(payments.length).toBe(1);
    expect(amountPaid).toBeCloseTo(100000, 2);
  });
});
