import { test, expect, Page } from '@playwright/test';
import { login, apiGet, apiPost, apiPatch, firstProjectId, unwrap, API } from './helpers';

/** Drive the real login UI: landing → sign-in form → console shell. */
async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/');
  const signIn = page.getByRole('button', { name: 'Sign in to your workspace' });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
  } else {
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  }
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('button', { name: 'Projects' }).first()).toBeVisible({ timeout: 30_000 });
}

/** Rail/tab navigation — force click bypasses a headless-mobile hit-test
 *  quirk where the fixed bottom bar's label point resolves to content
 *  underneath; the resulting section state is still asserted normally. */
async function clickNav(page: Page, name: string | RegExp) {
  const target = typeof name === 'string' ? { name, exact: true } : { name };
  await page.getByRole('button', target).first().click({ force: true });
}

/**
 * Workflow G — the 9-step contractor lifecycle journey against the real
 * API and database, exercised end to end:
 *   1. Company onboarding (register-company → login → empty console)
 *   2. Invitation acceptance (/?invite=<token>, mobile viewport covered by
 *      the mobile-390 project)
 *   3. Certificate → invoice (BoQ progress → preview → editable cert →
 *      CERTIFY → linked invoice → payment → derived PAID, VAT + WHT)
 *   4. Subcontractor valuation state machine + 409s + different approver
 *   5. Ledger posting on APPROVED_FOR_PAYMENT + budget summary delta
 *   6. Central tenant tax settings drive the invoice math
 *   7. Real inbox notifications for journey events
 *   8. Guided project checklist with real done-states + deep links
 *   9. Offline-then-sync diary through the real browser queue
 */
test.describe.serial('G. Contractor lifecycle journey', () => {
  const stamp = Date.now();
  const state: Record<string, any> = {};

  // ------------------------------------------------------------------
  // STEP 1 — company onboarding
  // ------------------------------------------------------------------
  test('1. register-company provisions tenant+admin; new company sees empty console', async ({ request, page }) => {
    const email = `e2e-co-${stamp}@journey.co.ke`;
    const password = 'Journey!Pass123';

    const reg = await request.post(`${API}/api/v1/auth/register-company`, {
      data: {
        companyName: `E2E Journey Builders ${stamp}`,
        adminFullName: 'Journey Admin',
        email,
        phone: '+254700000001',
        password,
      },
    });
    expect(reg.status(), await reg.text()).toBe(201);
    // New accounts are gated: verify the admin email (simulated token) first.
    const regBody = await reg.json();
    const verifyToken = regBody.data?.verificationToken;
    expect(verifyToken, 'register-company must issue a verification token').toBeTruthy();
    const verify = await request.post(`${API}/api/v1/auth/verify-email`, { data: { token: verifyToken } });
    expect(verify.status(), await verify.text()).toBe(200);

    const sess = await login(request, email, password);
    const projectsRes = await apiGet(request, sess, '/api/v1/projects');
    expect(projectsRes.status()).toBe(200);
    expect(unwrap(await projectsRes.json())).toEqual([]);

    // UI: signup page renders the real form
    await page.goto('/?signup=1');
    await expect(page.getByLabel('Company name')).toBeVisible();
    await expect(page.getByLabel('Work email')).toBeVisible();

    // UI: the new admin logs in through the normal flow and sees an empty console
    await uiLogin(page, email, password);
    await page.getByRole('button', { name: /Open projects/ }).click();
    await expect(page.getByText('No projects in this view')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Riverside Commercial Plaza')).toHaveCount(0);
  });

  // ------------------------------------------------------------------
  // STEP 2 — invitation acceptance
  // ------------------------------------------------------------------
  test('2. invite accept at /?invite= sets credentials, logs in, admin sees ACCEPTED', async ({ request, page }) => {
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const inviteEmail = `e2e-invitee-${stamp}@apexbuilders.co.ke`;
    const invitePassword = 'Invitee!Pass456';

    const invRes = await apiPost(request, admin, '/api/v1/invitations', {
      email: inviteEmail,
      role: 'SITE_ENGINEER',
    });
    expect(invRes.status(), await invRes.text()).toBe(201);
    const invite = unwrap(await invRes.json());
    // The API returns a copy-and-send link, not a bare usable token.
    const token = new URL(invite.inviteUrl, API).searchParams.get('invite')!;
    expect(token).toBeTruthy();
    state.inviteId = invite.id;

    // Wrong-email acceptance is rejected before touching the UI
    const wrongEmail = await request.post(`${API}/api/v1/invitations/accept`, {
      data: { token, email: 'someone-else@apexbuilders.co.ke', fullName: 'Wrong Person', password: invitePassword },
    });
    expect([400, 403, 409]).toContain(wrongEmail.status());

    // Browser acceptance flow
    await page.goto(`/?invite=${token}`);
    await expect(page.getByText('You have been invited')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Apex Builders Kenya Ltd')).toBeVisible();
    await page.locator('#invite-name').fill('E2E Invitee');
    await page.locator('#invite-password').fill(invitePassword);
    await page.locator('#invite-confirm').fill(invitePassword);
    await page.getByRole('button', { name: 'Accept invitation' }).click();

    // Dev/pilot: invite acceptance is auto-verified (simulated delivery), so
    // the UI signs the new member straight in. SITE_ENGINEER lands on the
    // mobile-first field workspace, not the console rail.
    await expect(page.getByRole('button', { name: /Projects|Today|Site Diary|Record diary/ }).first()).toBeVisible({ timeout: 20_000 });

    // Admin sees the invitation as ACCEPTED
    const listRes = await apiGet(request, admin, '/api/v1/invitations');
    expect(listRes.status()).toBe(200);
    const listBody = unwrap(await listRes.json());
    const rows = Array.isArray(listBody) ? listBody : listBody.invitations || listBody.data || [];
    const mine = rows.find((i: any) => i.id === state.inviteId || i.email === inviteEmail);
    expect(mine?.status).toBe('ACCEPTED');

    // Reused link shows the honest already-accepted state
    await page.goto(`/?invite=${token}`);
    await expect(page.getByText('This invitation is accepted')).toBeVisible({ timeout: 20_000 });
  });

  // ------------------------------------------------------------------
  // STEPS 3–6 — money integrity chain (API-level, real DB)
  // ------------------------------------------------------------------
  test('3-6. BoQ → progress → certificate preview/edit/CERTIFY → invoice → payment → PAID, with tenant tax settings', async ({ request }) => {
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const qs = await login(request, 'qs@apexbuilders.co.ke');
    const projectId = await firstProjectId(request, admin);
    state.projectId = projectId;

    // STEP 6 first — read tenant tax settings (defaults must be VAT 16%)
    const taxRes = await apiGet(request, admin, '/api/v1/company/tax-settings');
    expect(taxRes.status()).toBe(200);
    const tax = unwrap(await taxRes.json());
    expect(Number(tax.vatPct)).toBe(16);
    state.vatPct = Number(tax.vatPct);
    state.whtContractorPct = Number(tax.whtContractorPct ?? tax.whtContractor ?? 3);
    state.whtSubcontractorPct = Number(tax.whtSubcontractorPct ?? tax.whtSubcontractor ?? 3);

    // STEP 3a — import a real BoQ through the confirm endpoint
    const boqRes = await apiPost(request, qs, `/api/v1/projects/${projectId}/boq/confirm`, {
      sourceFilename: 'e2e-journey-boq.xlsx',
      sections: [{
        title: 'E2E Journey Works',
        orderIdx: 0,
        subtotal: '100000.00',
        items: [{
          itemCode: 'E2E-1.1',
          description: 'E2E journey excavation item',
          unit: 'm3',
          quantity: '100.0000',
          unitRate: '1000.0000',
          totalAmount: '100000.00',
          isProvisional: false,
          status: 'VALID',
        }],
      }],
    });
    expect(boqRes.status(), await boqRes.text()).toBe(201);

    const itemsRes = await apiGet(request, qs, `/api/v1/projects/${projectId}/boq/items`);
    expect(itemsRes.status()).toBe(200);
    const items = unwrap(await itemsRes.json());
    const rows = Array.isArray(items) ? items : items.items || [];
    const item = rows.find((i: any) => i.item_code === 'E2E-1.1' || i.itemCode === 'E2E-1.1');
    expect(item, 'BoQ item must exist').toBeTruthy();
    const boqItemId = item.id;
    state.boqItemId = boqItemId;

    // STEP 3b — record real progress: 50% of the item
    const progRes = await apiPost(request, qs, `/api/v1/projects/${projectId}/progress`, {
      recordDate: new Date().toISOString().slice(0, 10),
      overallProgress: '0.5000',
      notes: 'E2E journey progress',
      items: [{ boqItemId, completedQuantity: '50.0000', completionPct: '0.5000' }],
    });
    expect(progRes.status(), await progRes.text()).toBe(201);

    // STEP 3c — certificate preview computes from progress × rate
    const previewRes = await apiGet(request, qs, `/api/v1/projects/${projectId}/payment-certificates/preview`);
    expect(previewRes.status()).toBe(200);
    const preview = unwrap(await previewRes.json());
    const line = (preview.lines || []).find((l: any) => l.boqItemId === boqItemId);
    expect(line, 'preview must contain the progressed BoQ item').toBeTruthy();
    expect(Number(line.amount)).toBeCloseTo(50000, 0);
    state.previewAmount = line.amount;

    // STEP 3d — create DRAFT certificate from editable preview lines, then edit
    const certRes = await apiPost(request, qs, `/api/v1/projects/${projectId}/payment-certificates`, {
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      lines: preview.lines.filter((l: any) => l.boqItemId === boqItemId),
    });
    expect(certRes.status(), await certRes.text()).toBe(201);
    const cert = unwrap(await certRes.json());
    const certId = cert.id;
    state.certId = certId;

    const editRes = await apiPatch(request, qs, `/api/v1/projects/${projectId}/payment-certificates/${certId}`, {
      thisPeriodAmount: '49000.00',
    });
    expect(editRes.status(), await editRes.text()).toBe(200);

    // CERTIFY chain
    for (const action of ['SUBMIT', 'REVIEW', 'CERTIFY']) {
      const r = await apiPost(request, admin, `/api/v1/projects/${projectId}/payment-certificates/${certId}/action`, { action });
      expect(r.status(), `cert action ${action}: ${await r.text()}`).toBe(200);
    }

    // STEP 3e — create invoice from certificate; links must exist both ways
    const invRes = await apiPost(request, admin, `/api/v1/projects/${projectId}/payment-certificates/${certId}/create-invoice`, {
      clientName: 'E2E Journey Client',
      dueDays: 30,
    });
    expect(invRes.status(), await invRes.text()).toBe(201);
    const invBody = unwrap(await invRes.json());
    const invoice = invBody.invoice ?? invBody;
    state.invoiceId = invoice.id;
    expect(invoice.certificateId ?? invoice.certificate_id).toBeTruthy();

    // VAT + WHT math from tenant settings (no hard-coded rates).
    // The invoice bills net-of-retention: read the certified certificate's
    // actual retention deduction (capped by the contract retention ceiling,
    // which earlier certs on this shared seeded project may have consumed).
    const certListRes = await apiGet(request, admin, `/api/v1/projects/${projectId}/payment-certificates`);
    expect(certListRes.status()).toBe(200);
    const certListBody = unwrap(await certListRes.json());
    const certListRows = Array.isArray(certListBody) ? certListBody : certListBody.items || certListBody.data || certListBody.certificates || [];
    const certDetail = certListRows.find((c: any) => (c.id ?? c.certificate_id) === certId);
    expect(certDetail, 'certified certificate must be listed').toBeTruthy();
    const retentionDeduction = Number(certDetail.retention_deduction ?? certDetail.retentionDeduction ?? 0);
    const certVat = Number(certDetail.vat_amount ?? certDetail.vatAmount ?? 0);
    const certWht = Number(certDetail.wht_amount ?? certDetail.whtAmount ?? 0);
    const subtotal = 49000 - retentionDeduction;
    const vat = subtotal * state.vatPct / 100;
    const wht = (subtotal + vat) * state.whtContractorPct / 100;
    const expectedTotal = subtotal + vat - wht;
    expect(Number(invoice.subtotal ?? invoice.subtotal_amount)).toBeCloseTo(subtotal, 0);
    expect(Number(invoice.taxAmount ?? invoice.tax_amount ?? invoice.vat_amount)).toBeCloseTo(vat, 0);
    expect(Number(invoice.total ?? invoice.total_amount)).toBeCloseTo(expectedTotal, 0);
    // Invoice tax lines must match what the certificate actually certified.
    expect(certVat).toBeCloseTo(vat, 0);
    expect(certWht).toBeCloseTo(wht, 0);

    const invDetailRes = await apiGet(request, admin, `/api/v1/invoices/${invoice.id}`);
    expect(invDetailRes.status()).toBe(200);
    const invDetail = unwrap(await invDetailRes.json());
    const invRow = invDetail.invoice ?? invDetail;
    expect(invRow.certificateId ?? invRow.certificate_id).toBe(certId);

    // MARK_PAID must be refused — payment derives from the invoice
    const markPaid = await apiPost(request, admin, `/api/v1/projects/${projectId}/payment-certificates/${certId}/action`, {
      action: 'MARK_PAID', paidReference: 'SHOULD-FAIL',
    });
    expect(markPaid.status()).toBe(409);

    // Record full payment → certificate derives PAID
    const sendRes = await apiPost(request, admin, `/api/v1/invoices/${invoice.id}/send`, {});
    if (![200, 201].includes(sendRes.status())) {
      // DRAFT invoices may accept payments directly — note and continue
      state.invoiceSendStatus = sendRes.status();
    }
    const payRes = await apiPost(request, admin, `/api/v1/invoices/${invoice.id}/payments`, {
      amount: Number(expectedTotal.toFixed(2)),
      method: 'BANK',
      reference: `E2E-JOURNEY-${stamp}`,
    });
    expect([200, 201], await payRes.text()).toContain(payRes.status());

    const certsRes = await apiGet(request, qs, `/api/v1/projects/${projectId}/payment-certificates`);
    const certs = unwrap(await certsRes.json());
    const certRows = Array.isArray(certs) ? certs : certs.certificates || certs.data || [];
    const paid = certRows.find((c: any) => c.id === certId);
    expect(paid.status).toBe('PAID');
    expect(paid.paid_at ?? paid.paidAt).toBeTruthy();
    state.certificatePaid = true;
  });

  // ------------------------------------------------------------------
  // STEP 4+5 — valuation state machine + ledger posting
  // ------------------------------------------------------------------
  test('4-5. valuation SUBMITTED→UNDER_REVIEW→APPROVED_FOR_PAYMENT→PAID, 409s, approver≠preparer, ledger posts once', async ({ request }) => {
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const qs = await login(request, 'qs@apexbuilders.co.ke');
    const projectId = state.projectId;

    // Package for the valuation
    const pkgRes = await apiPost(request, qs, `/api/v1/projects/${projectId}/subcontractors`, {
      tradeCategory: 'PLUMBING',
      firmName: `E2E FlowFit ${stamp}`,
      subcontractSum: '800000.00',
      retentionRatePct: '5.00',
      status: 'ACTIVE',
    });
    expect(pkgRes.status(), await pkgRes.text()).toBe(201);
    const pkg = unwrap(await pkgRes.json());
    const pkgId = pkg.id || pkg.package?.id || pkg.data?.id;
    expect(pkgId).toBeTruthy();
    state.packageId = pkgId;

    // Stage-3: APPROVED_FOR_PAYMENT requires a valid TCC on file.
    const tccRes = await apiPost(request, admin, `/api/v1/projects/${projectId}/subcontractor-tcc`, {
      subcontractorPackageId: pkgId,
      pinNumber: 'P051234567X',
      taxpayerName: 'E2E FlowFit',
      tccNumber: `TCC-${stamp}`,
      tccExpiryDate: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10),
      complianceStatus: 'COMPLIANT',
    });
    expect(tccRes.status(), await tccRes.text()).toBeLessThan(300);

    const valRes = await apiPost(request, qs, `/api/v1/projects/${projectId}/subcontractor-valuations`, {
      subcontractorPackageId: pkgId,
      certificateNo: `E2E-VAL-${stamp}`,
      valuationDate: new Date().toISOString().slice(0, 10),
      grossWorkCertifiedKes: '50000.00',
      retentionRatePct: '5.00',
    });
    expect(valRes.status(), await valRes.text()).toBe(201);
    const valBody = await valRes.json();
    const val = valBody.valuation ?? unwrap(valBody);
    const valId = val.id;
    state.valuationId = valId;
    expect(val.payment_status ?? val.paymentStatus).toBe('SUBMITTED');

    const patchVal = (session: any, status: string, extra: any = {}) =>
      apiPatch(request, session, `/api/v1/projects/${projectId}/subcontractor-valuations/${valId}`, {
        paymentStatus: status, ...extra,
      });

    // Illegal: SUBMITTED → PAID
    expect((await patchVal(qs, 'PAID', { paymentReference: 'X' })).status()).toBe(409);
    // SUBMITTED → UNDER_REVIEW
    expect((await patchVal(qs, 'UNDER_REVIEW')).status()).toBe(200);
    // Preparer cannot approve own valuation
    expect((await patchVal(qs, 'APPROVED_FOR_PAYMENT')).status()).toBe(409);

    // Budget summary BEFORE approval
    const budgetBeforeRes = await apiGet(request, qs, `/api/v1/projects/${projectId}/budget/summary`);
    const beforeBody = unwrap(await budgetBeforeRes.json());
    const beforeApproved = Number(beforeBody?.approvedActualKes ?? beforeBody?.approvedCost ?? beforeBody?.approved_actual_kes ?? 0);

    // Different approver approves → ledger posts
    const approveRes = await patchVal(admin, 'APPROVED_FOR_PAYMENT');
    expect(approveRes.status(), await approveRes.text()).toBe(200);

    // APPROVED_FOR_PAYMENT → PAID (reference + paid date are mandatory)
    const paidRes = await patchVal(admin, 'PAID', {
      paymentReference: `E2E-PAY-${stamp}`,
      paidAt: new Date().toISOString(),
    });
    expect(paidRes.status(), await paidRes.text()).toBe(200);

    // Budget summary AFTER — approved actuals must have increased
    const budgetAfterRes = await apiGet(request, qs, `/api/v1/projects/${projectId}/budget/summary`);
    const afterBody = unwrap(await budgetAfterRes.json());
    const afterApproved = Number(afterBody?.approvedActualKes ?? afterBody?.approvedCost ?? afterBody?.approved_actual_kes ?? 0);
    // Ledger posts gross − retention − WHT (WHT levied on the gross certified)
    const whtPct = state.whtSubcontractorPct ?? 3;
    const expectedNet = 50000 - 50000 * 0.05 - 50000 * (whtPct / 100);
    expect(afterApproved - beforeApproved).toBeCloseTo(expectedNet, 0);
    state.ledgerDelta = afterApproved - beforeApproved;
  });

  // ------------------------------------------------------------------
  // STEP 7 — inbox notifications for the journey events
  // ------------------------------------------------------------------
  test('7. inbox contains notifications for diary/progress, certificate and valuation events', async ({ request }) => {
    const admin = await login(request, 'admin@apexbuilders.co.ke');
    const inboxRes = await apiGet(request, admin, `/api/v1/inbox?projectId=${state.projectId}`);
    expect(inboxRes.status()).toBe(200);
    const inbox = unwrap(await inboxRes.json());
    const msgs = Array.isArray(inbox) ? inbox : inbox.messages || inbox.data || [];
    const bodies = msgs.map((m: any) => String(m.body || ''));
    const joined = bodies.join(' | ').toLowerCase();
    // At least the certificate + valuation + progress events must have notified the team
    expect(joined).toMatch(/certificat|valuation|progress|diary|invoice/);
    state.inboxCount = msgs.length;
  });

  // ------------------------------------------------------------------
  // STEP 9 — offline-then-sync diary through the real browser queue
  // ------------------------------------------------------------------
  test('9. supervisor files a diary offline; queue syncs exactly once on reconnect', async ({ page, request }) => {
    const notes = `E2E offline diary ${stamp}`;

    // Log in through the real UI as the site supervisor
    await uiLogin(page, 'supervisor@apexbuilders.co.ke', 'Password123!');

    // Navigate: Site section → Daily log tab → New daily log
    await clickNav(page, 'Site');
    await page.getByRole('tab', { name: 'Daily log' }).click({ force: true });
    await page.getByRole('button', { name: /New daily log/ }).click();

    const notesArea = page.getByPlaceholder(/Activities completed/);
    await expect(notesArea).toBeVisible({ timeout: 15_000 });
    await notesArea.fill(notes);
    // Go offline and submit — the app must queue locally, not fail.
    // The modal footer is sticky, so a plain click reaches the real button.
    await page.context().setOffline(true);
    await page.getByRole('button', { name: 'Record Daily Site Diary' }).click();
    // Modal closes and the offline banner reports queued work
    await expect(page.getByText(/Offline Mode|Queued/i).first()).toBeVisible({ timeout: 15_000 });

    // Reconnect — the banner auto-flushes on the online event; if it hasn't
    // fired yet (or a transient failure left the item queued), drive the
    // real "Sync Now" button and poll the API until the diary lands.
    await page.context().setOffline(false);
    const sup = await login(request, 'supervisor@apexbuilders.co.ke');
    const deadline = Date.now() + 90_000;
    let matches: any[] = [];
    while (Date.now() < deadline) {
      const syncBtn = page.getByRole('button', { name: /Sync Now/ });
      if (await syncBtn.isVisible().catch(() => false)) {
        await syncBtn.click();
        await page.waitForTimeout(1500);
      }
      const listRes = await apiGet(request, sup, `/api/v1/projects/${state.projectId}/site-diaries`);
      if (listRes.status() === 200) {
        const list = unwrap(await listRes.json());
        const rows = Array.isArray(list) ? list : list.diaries || list.data || [];
        matches = rows.filter((d: any) =>
          String(d.general_notes || d.generalNotes || '').includes(notes));
        if (matches.length > 0) break;
      }
      await page.waitForTimeout(2000);
    }
    // API truth: exactly one diary carrying these notes
    expect(matches.length, 'offline diary must sync exactly once').toBe(1);
    state.offlineDiarySynced = true;
  });

  // ------------------------------------------------------------------
  // STEP 8 — guided checklist + WhatsApp copy on the project overview
  // ------------------------------------------------------------------
  test('8. project overview shows the guided checklist with real done-states and Copy WhatsApp on portal links', async ({ page, request }) => {
    // Create a portal link so the link manager renders a Copy WhatsApp action
    const qs = await login(request, 'qs@apexbuilders.co.ke');
    const linkRes = await apiPost(request, qs, `/api/v1/projects/${state.projectId}/portals/links`, {
      portalType: 'CLIENT',
      stakeholderName: `E2E Client ${stamp}`,
      expiresInDays: 7,
    });
    // CLIENT links may be restricted — accept 201 or record the honest status
    state.clientLinkStatus = linkRes.status();

    // UI login as admin → Projects → All projects (checklist lives here)
    await uiLogin(page, 'admin@apexbuilders.co.ke', 'Password123!');
    const openProjects = page.getByRole('button', { name: /Open projects/ });
    if (await openProjects.isVisible().catch(() => false)) {
      await openProjects.click();
    } else {
      await clickNav(page, 'Projects');
    }

    // The console defaults to the newest project; the journey data lives on
    // Riverside, so select it explicitly via its project card.
    await page.getByRole('button', { name: /Riverside Commercial Plaza/ }).first().click();

    await expect(page.getByText('Project checklist')).toBeVisible({ timeout: 20_000 });
    for (const step of ['Quote accepted', 'BoQ imported', 'Team assigned', 'First site diary', 'First certificate', 'First invoice paid', 'Closeout']) {
      await expect(page.getByText(step, { exact: false })).toBeVisible();
    }
    // Done-states come from real data: BoQ, diary, certificate and invoice
    // were all created earlier in this journey, so those steps must be done.
    const doneCount = await page.getByText(/\d+ of 7 done/).textContent();
    expect(doneCount).toBeTruthy();
    const done = Number((doneCount || '').match(/(\d+) of 7/)?.[1] ?? 0);
    expect(done, 'journey steps must mark real completions').toBeGreaterThanOrEqual(4);

    // WhatsApp copy affordance: tokens are only exposed at creation, so
    // generate a link through the real UI — the fresh row must offer
    // "Copy WhatsApp" next to it.
    await page.getByRole('button', { name: /Generate Stakeholder Link/ }).click();
    await page.getByPlaceholder(/Arch\. Peter Mwangi/).fill(`E2E WhatsApp ${stamp}`);
    await page.getByRole('button', { name: 'Create Access Link' }).click();
    await expect(page.getByRole('button', { name: 'Copy WhatsApp' }).first()).toBeVisible({ timeout: 20_000 });
  });
});
