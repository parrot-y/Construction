import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

/**
 * Gate-5 G5-7: Company documents vault — categories, unfiled triage,
 * expiry tracking, permission scoping.
 */
describe('Gate-5 G5-7: Company documents vault', () => {
  const server = buildServer();

  let adminCookie: string;
  let supervisorCookie: string;
  let clientCookie: string;
  let unfiledId: string;
  let certId: string;

  beforeAll(async () => {
    await server.ready();
    const login = async (email: string) => {
      const res = await server.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Password123!' } });
      return { cookie: res.headers['set-cookie'] as string, body: JSON.parse(res.body) };
    };
    const admin = await login('admin@apexbuilders.co.ke');
    adminCookie = admin.cookie;
    supervisorCookie = (await login('supervisor@apexbuilders.co.ke')).cookie;
    clientCookie = (await login('client@apexbuilders.co.ke')).cookie;
  });

  it('creates unfiled doc (no category) then files it via PATCH', async () => {
    const res = await server.inject({
      method: 'POST', url: '/api/v1/company/documents', headers: { cookie: adminCookie },
      payload: { title: 'NCA Registration Certificate 2026', fileName: 'nca-cert.pdf', mimeType: 'application/pdf' },
    });
    expect(res.statusCode).toBe(201);
    unfiledId = JSON.parse(res.body).data.id;

    const unfiled = await server.inject({ method: 'GET', url: '/api/v1/company/documents?unfiled=1', headers: { cookie: adminCookie } });
    expect(JSON.parse(unfiled.body).data.some((d: any) => d.id === unfiledId)).toBe(true);

    const file = await server.inject({
      method: 'PATCH', url: `/api/v1/company/documents/${unfiledId}`, headers: { cookie: adminCookie },
      payload: { category: 'CERTIFICATION', referenceNo: 'NCA/2026/00417', expiryDate: '2027-03-31' },
    });
    expect(file.statusCode).toBe(200);

    const after = await server.inject({ method: 'GET', url: `/api/v1/company/documents?category=CERTIFICATION`, headers: { cookie: adminCookie } });
    const doc = JSON.parse(after.body).data.find((d: any) => d.id === unfiledId);
    expect(doc).toBeTruthy();
    expect(doc.reference_no).toBe('NCA/2026/00417');
    expect(doc.expiry_status).toBe('VALID');
  });

  it('expiry statuses: expired + expiring-soon derived correctly', async () => {
    const past = await server.inject({
      method: 'POST', url: '/api/v1/company/documents', headers: { cookie: adminCookie },
      payload: { title: 'Expired Workmen Compensation Policy', category: 'INSURANCE', expiryDate: '2020-01-01' },
    });
    expect(past.statusCode).toBe(201);

    const soon = await server.inject({
      method: 'POST', url: '/api/v1/company/documents', headers: { cookie: adminCookie },
      payload: { title: 'Contractors All Risks — renews soon', category: 'INSURANCE', expiryDate: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) },
    });
    expect(soon.statusCode).toBe(201);
    certId = JSON.parse(soon.body).data.id;

    const list = await server.inject({ method: 'GET', url: '/api/v1/company/documents?expiring=1', headers: { cookie: adminCookie } });
    const docs = JSON.parse(list.body).data;
    const expiredDoc = docs.find((d: any) => d.title.includes('Workmen'));
    const soonDoc = docs.find((d: any) => d.id === certId);
    expect(expiredDoc.expiry_status).toBe('EXPIRED');
    expect(soonDoc.expiry_status).toBe('EXPIRING_SOON');

    const feed = await server.inject({ method: 'GET', url: '/api/v1/company/documents/expiring', headers: { cookie: adminCookie } });
    expect(JSON.parse(feed.body).data.length).toBeGreaterThanOrEqual(2);
  });

  it('archive hides from active list', async () => {
    const res = await server.inject({
      method: 'PATCH', url: `/api/v1/company/documents/${certId}`, headers: { cookie: adminCookie },
      payload: { status: 'ARCHIVED' },
    });
    expect(res.statusCode).toBe(200);
    const list = await server.inject({ method: 'GET', url: '/api/v1/company/documents?category=INSURANCE', headers: { cookie: adminCookie } });
    expect(JSON.parse(list.body).data.some((d: any) => d.id === certId)).toBe(false);
  });

  it('RBAC: client can read vault but cannot upload; supervisor lacks DOCUMENT_MANAGE', async () => {
    const read = await server.inject({ method: 'GET', url: '/api/v1/company/documents', headers: { cookie: clientCookie } });
    expect(read.statusCode).toBe(200); // PROJECT_VIEW-level read? client has REPORT_VIEW

    const clientWrite = await server.inject({
      method: 'POST', url: '/api/v1/company/documents', headers: { cookie: clientCookie },
      payload: { title: 'Nope' },
    });
    expect(clientWrite.statusCode).toBe(403);

    const supWrite = await server.inject({
      method: 'POST', url: '/api/v1/company/documents', headers: { cookie: supervisorCookie },
      payload: { title: 'Nope' },
    });
    expect(supWrite.statusCode).toBe(403); // SITE_SUPERVISOR lacks DOCUMENT_MANAGE

    // supervisor CAN read
    const supRead = await server.inject({ method: 'GET', url: '/api/v1/company/documents', headers: { cookie: supervisorCookie } });
    expect(supRead.statusCode).toBe(200);
  });

  it('search q= filters title/reference', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/company/documents?q=NCA', headers: { cookie: adminCookie } });
    const docs = JSON.parse(res.body).data;
    expect(docs.some((d: any) => d.id === unfiledId)).toBe(true);
    expect(docs.every((d: any) => d.title.toUpperCase().includes('NCA') || (d.reference_no || '').includes('NCA'))).toBe(true);
  });
});
