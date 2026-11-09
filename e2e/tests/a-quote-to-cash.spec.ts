import { test, expect } from '@playwright/test';
import { login, apiGet, apiPost, API } from './helpers';

/**
 * Workflow A — quote created → sent → public link opened → accepted →
 * project created → deposit invoice drafted and linked.
 * Runs against the real API + database. The public quote page is opened
 * in a real browser; no API stubs anywhere.
 */
test.describe('A. Quote → cash', () => {
  test('full chain through the public link', async ({ request, page }) => {
    const admin = await login(request, 'admin@apexbuilders.co.ke');

    // 1. Create quote
    const createRes = await apiPost(request, admin, '/api/v1/quotes', {
      title: `E2E Family Home Extension ${Date.now()}`,
      clientName: 'E2E Client',
      clientEmail: 'e2e-client@example.com',
      siteLocation: 'Nairobi',
      currency: 'KES',
      taxPct: 16,
      depositPct: 30,
      items: [
        { description: 'Foundation & slab', unit: 'm2', quantity: 120, unitRate: 8500 },
        { description: 'Masonry walls', unit: 'm2', quantity: 200, unitRate: 3200 },
      ],
    });
    expect(createRes.status(), await createRes.text()).toBe(201);
    const quote = await createRes.json();
    const quoteId = quote.quote?.id || quote.id;
    expect(quoteId).toBeTruthy();

    // 2. Send → returns one-time share token
    const sendRes = await apiPost(request, admin, `/api/v1/quotes/${quoteId}/send`, { channel: 'link' });
    expect(sendRes.status(), await sendRes.text()).toBe(200);
    const sent = await sendRes.json();
    const shareToken = sent.shareToken || sent.share_token;
    expect(shareToken).toBeTruthy();

    // 3. Open the public link in a real browser
    await page.goto(`/?portal=quote&token=${shareToken}`);
    await expect(page.getByText(/quotation|quote/i).first()).toBeVisible({ timeout: 20_000 });

    // 4. Accept via the public endpoint (same call the page makes)
    const acceptRes = await request.post(`${API}/api/public/quotes/${shareToken}/respond`, {
      data: { action: 'accept', typedName: 'E2E Client' },
    });
    expect(acceptRes.status(), await acceptRes.text()).toBe(200);

    // 5. Convert → project + deposit invoice
    const convertRes = await apiPost(request, admin, `/api/v1/quotes/${quoteId}/convert`, {
      createDepositInvoice: true,
    });
    expect(convertRes.status(), await convertRes.text()).toBe(201);
    const converted = await convertRes.json();
    const projectId = converted.project?.id;
    expect(projectId).toBeTruthy();
    expect(converted.depositInvoice?.id).toBeTruthy();

    // 6. Verify linkage: invoice belongs to the new project
    const invRes = await apiGet(request, admin, `/api/v1/invoices/${converted.depositInvoice.id}`);
    expect(invRes.status()).toBe(200);
    const invBody = await invRes.json();
    const inv = invBody.invoice || invBody;
    const invProject = inv.project?.id || inv.project_id || inv.projectId;
    expect(String(invProject)).toBe(String(projectId));

    // 7. Invalid token must fail honestly
    const badRes = await request.get(`${API}/api/public/quotes/not-a-real-token`);
    expect([400, 404, 410]).toContain(badRes.status());
  });
});
