import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

/**
 * Stage 6 — portal closeout loop (S6.2).
 *
 *  - Consultant portal lists snags awaiting verification and can VERIFY
 *    (VERIFIED_CLOSED) or REJECT (reason >= 15 chars + photo evidence).
 *  - Client portal exposes the closeout block and acknowledges practical
 *    completion exactly once.
 *  - Subcontractor portal requests a retention release only when its
 *    package's snags are verified closed; duplicate requests are refused.
 */
describe('Portal closeout loop (Stage 6)', () => {
  const server = buildServer();
  let adminCookie: string;
  let tenantId: string;
  let projectId: string;

  const authed = () => ({ cookie: adminCookie });
  const RUN = Date.now() % 100000;

  const mkLink = async (portalType: string, extra: any = {}) => {
    const r = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/portals/links`,
      headers: authed(),
      payload: { portalType, stakeholderName: `S6 ${portalType} ${RUN}`, expiresInDays: 30, ...extra },
    });
    expect(r.statusCode, `${portalType} link: ${r.body}`).toBe(201);
    return JSON.parse(r.body).data.token as string;
  };

  const createSnag = async (tradeCategory: string) => {
    const r = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/snags`, headers: authed(),
      payload: {
        locationFloor: 'Ground', locationRoom: 'Portal test room', tradeCategory,
        description: `Portal closeout snag ${RUN}`, severity: 'MINOR',
      },
    });
    expect(r.statusCode, r.body).toBe(201);
    const body = JSON.parse(r.body);
    return body.id ?? body.data?.id ?? body.snag?.id;
  };

  const setSnagStatus = (snagId: string, status: string) =>
    server.inject({
      method: 'PATCH', url: `/api/v1/projects/${projectId}/snags/${snagId}/status`,
      headers: authed(), payload: { status },
    });

  const toReview = async (snagId: string) => {
    for (const s of ['IN_PROGRESS', 'READY_FOR_REVIEW']) {
      const r = await setSnagStatus(snagId, s);
      expect(r.statusCode, `${s}: ${r.body}`).toBeLessThan(300);
    }
  };

  beforeAll(async () => {
    await server.ready();
    const login = await server.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    adminCookie = login.headers['set-cookie'] as string;
    tenantId = JSON.parse(login.body).user.tenant.id;
    const projRes = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: authed() });
    projectId = JSON.parse(projRes.body).data[0].id;

    // The acknowledge-once contract is per project — reset any ack left by a
    // previous run of this suite on the shared seeded project.
    await withTenantTx(prisma, tenantId, (tx) =>
      tx.practicalCompletionAcknowledgement.deleteMany({ where: { project_id: projectId } }),
    );
  });

  // ------------------------------------------------------------------
  it('consultant portal lists reviewable snags and verifies one', async () => {
    const snagId = await createSnag('GENERAL');
    await toReview(snagId);

    const token = await mkLink('CONSULTANT');
    const res = await server.inject({ method: 'GET', url: `/api/v1/portals/consultant/${token}` });
    expect(res.statusCode).toBe(200);
    const d = JSON.parse(res.body).data;
    const mine = (d.snags || []).find((s: any) => s.id === snagId);
    expect(mine, 'snag visible to consultant').toBeTruthy();
    expect(mine.status).toBe('READY_FOR_REVIEW');

    const verify = await server.inject({
      method: 'POST', url: `/api/v1/portals/consultant/${token}/snags/${snagId}/review`,
      payload: { action: 'VERIFY' },
    });
    expect(verify.statusCode, verify.body).toBe(200);
    expect(JSON.parse(verify.body).data.status).toBe('VERIFIED_CLOSED');

    // Second review is refused — the snag is closed.
    const again = await server.inject({
      method: 'POST', url: `/api/v1/portals/consultant/${token}/snags/${snagId}/review`,
      payload: { action: 'VERIFY' },
    });
    expect(again.statusCode).toBe(409);
  });

  it('consultant rejection requires a real reason and photo evidence', async () => {
    const snagId = await createSnag('GENERAL');
    await toReview(snagId);
    const token = await mkLink('CONSULTANT');
    const url = `/api/v1/portals/consultant/${token}/snags/${snagId}/review`;

    const shortReason = await server.inject({ method: 'POST', url, payload: { action: 'REJECT', reason: 'bad', photoStorageKey: `${tenantId}/${projectId}/x.jpg` } });
    expect(shortReason.statusCode).toBe(400);

    const noPhoto = await server.inject({ method: 'POST', url, payload: { action: 'REJECT', reason: 'Alignment is still visibly wrong on site today' } });
    expect(noPhoto.statusCode).toBe(400);

    const foreignKey = await server.inject({ method: 'POST', url, payload: { action: 'REJECT', reason: 'Alignment is still visibly wrong on site today', photoStorageKey: 'other-tenant/other-project/x.jpg' } });
    expect(foreignKey.statusCode).toBe(400);

    const ok = await server.inject({
      method: 'POST', url,
      payload: { action: 'REJECT', reason: 'Tile alignment still visible at the patio door — make good and resubmit', photoStorageKey: `${tenantId}/${projectId}/reject-evidence.jpg` },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(JSON.parse(ok.body).data.status).toBe('REJECTED');

    // REJECTED is not a dead end — the contractor can send it back for rework.
    const rework = await setSnagStatus(snagId, 'IN_PROGRESS');
    expect(rework.statusCode).toBeLessThan(300);
  });

  it('client portal exposes closeout and acknowledges practical completion once', async () => {
    // Ensure a practical completion certificate exists for the portal feed.
    await withTenantTx(prisma, tenantId, async (tx) => {
      const existing = await tx.defectsLiabilityCertificate.findFirst({
        where: { project_id: projectId, certificate_type: 'PRACTICAL_COMPLETION' },
      });
      if (!existing) {
        await tx.defectsLiabilityCertificate.create({
          data: {
            tenant_id: tenantId, project_id: projectId,
            certificate_type: 'PRACTICAL_COMPLETION',
            certificate_reference: `PC-PORTAL-${RUN}`,
            issue_date: new Date(), effective_date: new Date(),
            dlp_duration_months: 6, retention_amount_released: '0.00',
            architect_name: 'Arch. Test', qs_name: 'QS Test',
          },
        });
      }
    });

    const token = await mkLink('CLIENT');
    const res = await server.inject({ method: 'GET', url: `/api/v1/portals/client/${token}` });
    expect(res.statusCode).toBe(200);
    const d = JSON.parse(res.body).data;
    expect(d.closeout, 'closeout block present').toBeTruthy();
    expect(d.closeout.practicalCompletion, 'PC certificate visible').toBeTruthy();
    expect(d.closeout.retention).toBeTruthy();
    expect(d.closeout.acknowledged).toBeNull();

    const ack = await server.inject({
      method: 'POST', url: `/api/v1/portals/client/${token}/closeout/acknowledge`,
      payload: { typedName: 'Dr. Client Name' },
    });
    expect(ack.statusCode, ack.body).toBe(201);

    const again = await server.inject({
      method: 'POST', url: `/api/v1/portals/client/${token}/closeout/acknowledge`,
      payload: { typedName: 'Dr. Client Name' },
    });
    expect(again.statusCode).toBe(409);

    const fresh = await server.inject({ method: 'GET', url: `/api/v1/portals/client/${token}` });
    const fd = JSON.parse(fresh.body).data;
    expect(fd.closeout.acknowledged.byName).toBe('Dr. Client Name');
  });

  it('subcontractor retention release is gated on closed package snags and single-use', async () => {
    const TRADE = `S6PORTAL-${RUN}`;
    const pkgRes = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/subcontractors`, headers: authed(),
      payload: { tradeCategory: TRADE, firmName: `S6 Sub ${RUN}`, subcontractSum: '200000.00', retentionRatePct: '10.00', status: 'ACTIVE' },
    });
    expect(pkgRes.statusCode, pkgRes.body).toBeLessThan(300);
    const pkgId = JSON.parse(pkgRes.body).id ?? JSON.parse(pkgRes.body).data?.id;

    // Valuation with retention withheld, approved for payment.
    await withTenantTx(prisma, tenantId, (tx) =>
      tx.subcontractorValuation.create({
        data: {
          tenant_id: tenantId, project_id: projectId, subcontractor_package_id: pkgId,
          certificate_no: `S6-VAL-${RUN}`, valuation_date: new Date(),
          gross_work_certified_kes: '100000.00', retention_rate_pct: '10.00',
          retention_deducted_kes: '10000.00', withholding_tax_deducted_kes: '0.00',
          net_payable_kes: '90000.00', payment_status: 'APPROVED_FOR_PAYMENT',
        },
      }),
    );

    const snagId = await createSnag(TRADE);
    const token = await mkLink('SUBCONTRACTOR', { stakeholderName: `S6 Sub ${RUN}`, subcontractorPackageId: pkgId });
    const url = `/api/v1/portals/subcontractor/${token}/retention-release`;

    // Package snag still open -> refused.
    const early = await server.inject({ method: 'POST', url });
    expect(early.statusCode).toBe(409);

    // Close the snag through the real transition chain.
    for (const s of ['IN_PROGRESS', 'READY_FOR_REVIEW', 'VERIFIED_CLOSED']) {
      const r = await setSnagStatus(snagId, s);
      expect(r.statusCode, `${s}: ${r.body}`).toBeLessThan(300);
    }

    const ok = await server.inject({ method: 'POST', url });
    expect(ok.statusCode, ok.body).toBe(201);
    const rel = JSON.parse(ok.body).data;
    expect(rel.status).toBe('PENDING_QS_REVIEW');
    expect(rel.moietyStage).toBe('FIRST_MOIETY_PRACTICAL_COMPLETION');
    expect(Number(rel.releaseAmount)).toBe(5000); // 50% of KES 10,000 held

    // Single-use: a second request while one is pending -> 409.
    const dup = await server.inject({ method: 'POST', url });
    expect(dup.statusCode).toBe(409);

    // The GET payload lists the release for this package only.
    const get = await server.inject({ method: 'GET', url: `/api/v1/portals/subcontractor/${token}` });
    const gd = JSON.parse(get.body).data;
    expect((gd.retentionReleases || []).some((r: any) => r.id === rel.id)).toBe(true);
    expect(gd.retentionRelease.held).toBe('10000.00');
  });

  it('retention rate is data-driven per package — a 10% package withholds 10%', async () => {
    const TRADE = `S6-TENPCT-${RUN}`;
    const pkgRes = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/subcontractors`, headers: authed(),
      payload: { tradeCategory: TRADE, firmName: `S6 TenPct ${RUN}`, subcontractSum: '100000.00', retentionRatePct: '10.00', status: 'ACTIVE' },
    });
    expect(pkgRes.statusCode, pkgRes.body).toBeLessThan(300);
    const pkgId = JSON.parse(pkgRes.body).id ?? JSON.parse(pkgRes.body).data?.id;

    const token = await mkLink('SUBCONTRACTOR', { stakeholderName: `S6 TenPct ${RUN}`, subcontractorPackageId: pkgId });
    const submit = await server.inject({
      method: 'POST', url: `/api/v1/portals/subcontractor/${token}/valuations`,
      payload: { grossWorkCertifiedKes: '50000.00', notes: 'Ten percent retention check' },
    });
    expect(submit.statusCode, submit.body).toBe(201);
    const val = JSON.parse(submit.body).data ?? JSON.parse(submit.body);
    // retention_deducted = gross × package retention_rate_pct (10%), never a
    // hard-coded 5%.
    expect(Number(val.retentionDeductedKes ?? val.retention_deducted_kes)).toBe(5000);
    expect(Number(val.retentionRatePct ?? val.retention_rate_pct)).toBe(10);
  });
});
