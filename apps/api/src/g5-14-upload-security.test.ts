import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildServer } from './index';
import type { FastifyInstance } from 'fastify';

/**
 * Audit H-02: upload hardening — magic-byte verification, mime-derived
 * extension, authenticated tenant-scoped serving.
 */

// 1x1 transparent PNG
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const buildMultipart = (filename: string, mimetype: string, data: Buffer) => {
  const boundary = '----testboundary1234';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimetype}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, data, tail]), contentType: `multipart/form-data; boundary=${boundary}` };
};

describe('H-02: Upload security', () => {
  let server: FastifyInstance;
  let adminCookie: string;
  let projectId: string;
  let storageKey: string;

  beforeAll(async () => {
    server = buildServer();
    const login = await server.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = login.headers['set-cookie'] as string;
    const list = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie: adminCookie } });
    projectId = JSON.parse(list.body).data[0].id;
  });

  afterAll(async () => {
    await server.close();
  });

  it('accepts a real PNG and stores it under a mime-derived extension', async () => {
    const { payload, contentType } = buildMultipart('evil.php.png', 'image/png', PNG_1PX);
    const res = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/uploads`,
      headers: { cookie: adminCookie, 'content-type': contentType },
      payload,
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body).data;
    storageKey = body.storageKey;
    expect(storageKey).toMatch(/\.png$/);
    expect(storageKey).not.toContain('evil');
  });

  it('rejects content whose bytes do not match the declared mime type', async () => {
    const fake = Buffer.from('MZ' + 'x'.repeat(64)); // PE header masquerading as PNG
    const { payload, contentType } = buildMultipart('fake.png', 'image/png', fake);
    const res = await server.inject({
      method: 'POST', url: `/api/v1/projects/${projectId}/uploads`,
      headers: { cookie: adminCookie, 'content-type': contentType },
      payload,
    });
    expect(res.statusCode).toBe(415);
  });

  it('serves files only to authenticated tenant members with nosniff', async () => {
    // unauthenticated -> 401
    const anon = await server.inject({ method: 'GET', url: `/uploads/${storageKey}` });
    expect(anon.statusCode).toBe(401);

    // authenticated member -> 200 with hardening headers
    const ok = await server.inject({ method: 'GET', url: `/uploads/${storageKey}`, headers: { cookie: adminCookie } });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['x-content-type-options']).toBe('nosniff');
    expect(ok.headers['content-type']).toContain('image/png');
    expect(ok.rawPayload.equals(PNG_1PX)).toBe(true);
  });

  it('fails closed on traversal and cross-tenant keys', async () => {
    const trav = await server.inject({
      method: 'GET', url: `/uploads/${storageKey.split('/')[0]}/${storageKey.split('/')[1]}/..%2F..%2Fetc%2Fpasswd`,
      headers: { cookie: adminCookie },
    });
    expect([403, 404]).toContain(trav.statusCode);

    const otherTenant = '00000000-0000-4000-8000-000000000000';
    const cross = await server.inject({
      method: 'GET',
      url: `/uploads/${otherTenant}/${storageKey.split('/')[1]}/x.png`,
      headers: { cookie: adminCookie },
    });
    expect(cross.statusCode).toBe(404);
  });
});
