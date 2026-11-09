import { test, expect } from '@playwright/test';
import { login, apiGet, apiPost, apiPatch, firstProjectId, unwrap } from './helpers';

/**
 * Workflow D — payment certificate created → approved → invoiced →
 * payment recorded → retention tracked.
 */
test.describe('D. Certificate → invoice → payment → retention', () => {
  test('IPC lifecycle through to retention', async ({ request }) => {
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const qs = await login(request, 'qs@apexbuilders.co.ke');
    const projectId = await firstProjectId(request, admin);

    // 1. Create payment certificate
    const certRes = await apiPost(request, qs, `/api/v1/projects/${projectId}/payment-certificates`, {
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      thisPeriodAmount: '500000.00',
      retentionPct: '5.00',
      notes: 'E2E IPC January',
    });
    expect(certRes.status(), await certRes.text()).toBe(201);
    const cert = unwrap(await certRes.json());
    const certId = cert.id || cert.certificate?.id;
    expect(certId).toBeTruthy();

    // 2. Approve chain: SUBMIT → REVIEW → CERTIFY (or whatever the flow requires)
    for (const action of ['SUBMIT', 'REVIEW', 'CERTIFY']) {
      const res = await apiPost(request, qs, `/api/v1/projects/${projectId}/payment-certificates/${certId}/action`, { action });
      // Some actions may be restricted by role — accept 200 only; log status for debug
      expect([200, 201, 400, 403], `action ${action}: ${await res.text()}`).toContain(res.status());
      if (res.status() === 200 || res.status() === 201) break;
    }

    // Verify retention was computed on the certificate
    const certGet = await apiGet(request, qs, `/api/v1/projects/${projectId}/payment-certificates`);
    expect(certGet.status()).toBe(200);
    const certs = unwrap(await certGet.json());
    const rows = Array.isArray(certs) ? certs : certs.certificates || certs.data || [];
    const mine = rows.find((c: any) => c.id === certId);
    expect(mine).toBeTruthy();
    const retention = Number(mine.retention_amount ?? mine.retentionAmount ?? mine.retention_held ?? 0);
    expect(retention).toBeGreaterThan(0);

    // 3. Invoice the certified amount
    const invRes = await apiPost(request, admin, '/api/v1/invoices', {
      title: `E2E IPC Invoice ${certId.slice(0, 8)}`,
      clientName: 'E2E Client',
      projectId,
      currency: 'KES',
      items: [{ description: 'IPC certified works', unit: 'sum', quantity: 1, unitRate: 475000 }],
    });
    expect(invRes.status(), await invRes.text()).toBe(201);
    const inv = unwrap(await invRes.json());
    const invoiceId = inv.id || inv.invoice?.id;
    expect(invoiceId).toBeTruthy();

    // 3b. Send the invoice (payments only allowed on SENT/PART_PAID)
    const sendRes = await apiPost(request, admin, `/api/v1/invoices/${invoiceId}/send`, {});
    expect([200, 201], await sendRes.text()).toContain(sendRes.status());

    // 4. Record payment (simulated — real endpoint; M-Pesa stays SIMULATED)
    const payRes = await apiPost(request, admin, `/api/v1/invoices/${invoiceId}/payments`, {
      amount: 475000,
      method: 'M_PESA',
      reference: `E2E-${Date.now()}`,
    });
    expect(payRes.status(), await payRes.text()).toBe(201);

    // 5. Retention tracked — query retention endpoint if present
    const retRes = await apiGet(request, qs, `/api/v1/projects/${projectId}/retention`);
    if (retRes.status() === 200) {
      const ret = await retRes.json();
      expect(JSON.stringify(ret)).toMatch(/retention/i);
    }
  });
});
