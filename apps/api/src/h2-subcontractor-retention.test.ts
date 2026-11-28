import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';

/**
 * H2 — subcontractor retention, request to paid.
 *
 * Portal request -> QS recommends -> director approves (maker-checker:
 * requester/recommender cannot self-approve without a 15-char override)
 * -> payout recorded once with a reference -> portal shows PAID and the
 * package ledger reconciles -> a second request for the same moiety is
 * refused.
 */
describe('H2 subcontractor retention request-to-paid', () => {
  const server = buildServer();
  const RUN = Date.now() % 100000;
  const TRADE = `H2RET-${RUN}`;

  let adminCookie: string;
  let qsCookie: string;
  let execCookie: string;
  let tenantId: string;
  let projectId: string;
  let pkgId: string;
  let portalToken: string;
  let releaseId: string;

  const authed = (c: string) => ({ cookie: c });
  const login = async (email: string) => {
    const r = await server.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email, password: 'Password123!' },
    });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    return { cookie: r.headers['set-cookie'] as string, tenantId: body.user.tenant.id, userId: body.user.id };
  };

  const reviewUrl = (id: string) =>
    `/api/v1/projects/${projectId}/subcontractor-retention-releases/${id}/review`;

  beforeAll(async () => {
    await server.ready();
    const admin = await login('admin@apexbuilders.co.ke');
    adminCookie = admin.cookie;
    tenantId = admin.tenantId;
    const qs = await login('qs@apexbuilders.co.ke');
    qsCookie = qs.cookie;
    execCookie = (await login('executive@apexbuilders.co.ke')).cookie;

    const proj = await server.inject({
      method: 'POST', url: '/api/v1/projects', headers: authed(adminCookie),
      payload: {
        name: `H2 Retention ${RUN}`, code: `H2-${RUN}`, location: 'Nairobi',
        clientName: 'H2 Client', contractSum: '500000.00',
      },
    });
    expect(proj.statusCode, proj.body).toBeLessThan(300);
    projectId = JSON.parse(proj.body).id ?? JSON.parse(proj.body).data?.id;

    // PM_QS is project-scoped — add them as a member so the review route's
    // membership guard lets them recommend.
    const member = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/members`, headers: authed(adminCookie),
      payload: { userId: qs.userId, role: 'PM_QS' },
    });
    expect([200, 201, 409]).toContain(member.statusCode);

    const pkg = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/subcontractors`, headers: authed(adminCookie),
      payload: { tradeCategory: TRADE, firmName: `H2 Electricals ${RUN}`, subcontractSum: '200000.00', retentionRatePct: '10.00', status: 'ACTIVE' },
    });
    expect(pkg.statusCode, pkg.body).toBeLessThan(300);
    pkgId = JSON.parse(pkg.body).id ?? JSON.parse(pkg.body).data?.id;

    // Retention withheld on an approved valuation: 10% of 100,000 = 10,000.
    await withTenantTx(prisma, tenantId, (tx) =>
      tx.subcontractorValuation.create({
        data: {
          tenant_id: tenantId, project_id: projectId, subcontractor_package_id: pkgId,
          certificate_no: `H2-VAL-${RUN}`, valuation_date: new Date(),
          gross_work_certified_kes: '100000.00', retention_rate_pct: '10.00',
          retention_deducted_kes: '10000.00', withholding_tax_deducted_kes: '0.00',
          net_payable_kes: '90000.00', payment_status: 'APPROVED_FOR_PAYMENT',
        },
      }),
    );

    // Package snag must be verified closed before a release can be requested.
    const snag = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/snags`, headers: authed(adminCookie),
      payload: {
        locationFloor: 'Ground', locationRoom: 'H2 room', tradeCategory: TRADE,
        description: `H2 snag ${RUN}`, severity: 'MINOR',
      },
    });
    expect(snag.statusCode, snag.body).toBe(201);
    const snagId = JSON.parse(snag.body).id ?? JSON.parse(snag.body).data?.id ?? JSON.parse(snag.body).snag?.id;
    for (const s of ['IN_PROGRESS', 'READY_FOR_REVIEW', 'VERIFIED_CLOSED']) {
      const r = await server.inject({
        method: 'PATCH', url: `/api/v1/projects/${projectId}/snags/${snagId}/status`,
        headers: authed(adminCookie), payload: { status: s },
      });
      expect(r.statusCode, `${s}: ${r.body}`).toBeLessThan(300);
    }

    const link = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/portals/links`, headers: authed(adminCookie),
      payload: { portalType: 'SUBCONTRACTOR', stakeholderName: `H2 Sub ${RUN}`, subcontractorPackageId: pkgId, expiresInDays: 30 },
    });
    expect(link.statusCode, link.body).toBe(201);
    portalToken = JSON.parse(link.body).data.token;
  });

  it('portal request lands as PENDING_QS_REVIEW with the first-moiety amount', async () => {
    const r = await server.inject({ method: 'POST', url: `/api/v1/portals/subcontractor/${portalToken}/retention-release` });
    expect(r.statusCode, r.body).toBe(201);
    const rel = JSON.parse(r.body).data;
    releaseId = rel.id;
    expect(rel.status).toBe('PENDING_QS_REVIEW');
    expect(rel.moietyStage).toBe('FIRST_MOIETY_PRACTICAL_COMPLETION');
    expect(Number(rel.releaseAmount)).toBe(5000); // 50% of KES 10,000 held

    const list = await server.inject({
      method: 'GET', url: `/api/v1/projects/${projectId}/subcontractor-retention-releases`, headers: authed(adminCookie),
    });
    const row = JSON.parse(list.body).releases.find((x: any) => x.id === releaseId);
    expect(row.status).toBe('PENDING_QS_REVIEW');
  });

  it('maker-checker: wrong role cannot approve; requester/recommender cannot self-approve', async () => {
    // PM_QS may recommend but not approve.
    const rec = await server.inject({
      method: 'POST', url: reviewUrl(releaseId), headers: authed(qsCookie),
      payload: { action: 'RECOMMEND', qsRecommendationNotes: 'QS verified against certified valuations.' },
    });
    expect(rec.statusCode, rec.body).toBe(200);
    expect(JSON.parse(rec.body).status).toBe('QS_RECOMMENDED');

    const qsApprove = await server.inject({
      method: 'POST', url: reviewUrl(releaseId), headers: authed(qsCookie),
      payload: { action: 'APPROVE' },
    });
    expect(qsApprove.statusCode).toBe(403);

    // A second recommend is refused — the release already moved on.
    const rec2 = await server.inject({
      method: 'POST', url: reviewUrl(releaseId), headers: authed(adminCookie),
      payload: { action: 'RECOMMEND' },
    });
    expect(rec2.statusCode).toBe(409);
  });

  it('director approves, payout is recorded once, portal shows PAID and ledger reconciles', async () => {
    const appr = await server.inject({
      method: 'POST', url: reviewUrl(releaseId), headers: authed(execCookie),
      payload: { action: 'APPROVE' },
    });
    expect(appr.statusCode, appr.body).toBe(200);
    expect(JSON.parse(appr.body).status).toBe('APPROVED_BY_DIRECTOR');

    // MARK_PAID requires a disbursement reference.
    const noRef = await server.inject({
      method: 'POST', url: reviewUrl(releaseId), headers: authed(execCookie),
      payload: { action: 'MARK_PAID' },
    });
    expect(noRef.statusCode).toBe(400);

    const paid = await server.inject({
      method: 'POST', url: reviewUrl(releaseId), headers: authed(execCookie),
      payload: { action: 'MARK_PAID', disbursementRef: 'MPESA-B2C-H2-001' },
    });
    expect(paid.statusCode, paid.body).toBe(200);
    const p = JSON.parse(paid.body);
    expect(p.status).toBe('PAID');
    expect(p.disbursementRef).toBe('MPESA-B2C-H2-001');
    expect(p.disbursedAt).toBeTruthy();

    // Payout is single-use.
    const again = await server.inject({
      method: 'POST', url: reviewUrl(releaseId), headers: authed(execCookie),
      payload: { action: 'MARK_PAID', disbursementRef: 'MPESA-B2C-H2-002' },
    });
    expect(again.statusCode).toBe(409);

    // Portal now shows the release paid and outstanding retention reduced.
    const get = await server.inject({ method: 'GET', url: `/api/v1/portals/subcontractor/${portalToken}` });
    const gd = JSON.parse(get.body).data;
    const mine = (gd.retentionReleases || []).find((r: any) => r.id === releaseId);
    expect(mine.status).toBe('PAID');
    expect(mine.disbursementRef).toBe('MPESA-B2C-H2-001');
    expect(gd.retentionRelease.released).toBe('5000.00');
    expect(gd.retentionRelease.held).toBe('10000.00');
    expect(gd.retentionRelease.outstanding).toBe('5000.00');

    // A second request for the same moiety is refused — first moiety is paid,
    // so the portal now demands the defects-liability gate for moiety two.
    const second = await server.inject({ method: 'POST', url: `/api/v1/portals/subcontractor/${portalToken}/retention-release` });
    expect(second.statusCode).toBe(409);

    // Console-side duplicate for the same moiety is refused too.
    const consoleDup = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/subcontractor-retention-releases`, headers: authed(adminCookie),
      payload: {
        subcontractorPackageId: pkgId, releaseNo: `RET-DUP-${RUN}`,
        moietyStage: 'FIRST_MOIETY_PRACTICAL_COMPLETION',
        totalRetentionHeld: '10000.00', releasePercentage: '50.00', releaseAmount: '5000.00',
      },
    });
    expect(consoleDup.statusCode).toBe(409);
  });

  it('admin override: self-approval needs a 15-character reason and is audit-logged', async () => {
    // Console-created release requested AND recommended by admin -> approve
    // by the same admin must carry an override reason.
    const create = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/subcontractor-retention-releases`, headers: authed(adminCookie),
      payload: {
        subcontractorPackageId: pkgId, releaseNo: `RET-OVR-${RUN}`,
        moietyStage: 'SECOND_MOIETY_FINAL_COMPLETION',
        totalRetentionHeld: '10000.00', releasePercentage: '50.00', releaseAmount: '5000.00',
        defectClearanceVerified: true,
      },
    });
    expect(create.statusCode, create.body).toBe(201);
    const id = JSON.parse(create.body).id;

    await server.inject({
      method: 'POST', url: reviewUrl(id), headers: authed(adminCookie),
      payload: { action: 'RECOMMEND' },
    });
    const short = await server.inject({
      method: 'POST', url: reviewUrl(id), headers: authed(adminCookie),
      payload: { action: 'APPROVE', overrideReason: 'too short' },
    });
    expect(short.statusCode).toBe(409);

    const ok = await server.inject({
      method: 'POST', url: reviewUrl(id), headers: authed(adminCookie),
      payload: { action: 'APPROVE', overrideReason: 'Sole director on site; minuted in site records.' },
    });
    expect(ok.statusCode, ok.body).toBe(200);

    const audit = await withTenantTx(prisma, tenantId, (tx) =>
      tx.auditLog.findFirst({
        where: { entity_id: id, entity_type: 'SUBCONTRACTOR_RETENTION_RELEASE' },
        orderBy: { created_at: 'desc' },
      }),
    );
    expect(JSON.stringify(audit?.changes ?? {})).toContain('approvalOverrideReason');
  });
});
