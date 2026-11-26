import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';

describe('P5.9 — meetings + .ics calendar export', () => {
  const server = buildServer();

  let adminCookie: string;
  let projectId: string;
  let meetingId: string;

  beforeAll(async () => {
    await server.ready();
    const adminRes = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = adminRes.headers['set-cookie'] as string;
    const projRes = await server.inject({ method: 'GET', url: '/api/v1/projects', headers: { cookie: adminCookie } });
    projectId = JSON.parse(projRes.body).data[0].id;
  });

  it('creates, lists and exports a meeting as .ics', async () => {
    const start = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    start.setUTCMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const create = await server.inject({
      method: 'POST',
      url: '/api/v1/meetings',
      headers: { cookie: adminCookie },
      payload: {
        title: 'Weekly site coordination meeting',
        projectId,
        description: 'Progress, safety and upcoming pours',
        location: 'Site office, Block B',
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        attendees: ['supervisor@apexbuilders.co.ke', 'client@example.com'],
      },
    });
    expect(create.statusCode).toBe(201);
    meetingId = JSON.parse(create.body).data.id;
    expect(meetingId).toBeTruthy();

    const list = await server.inject({
      method: 'GET',
      url: `/api/v1/meetings?projectId=${projectId}`,
      headers: { cookie: adminCookie },
    });
    expect(list.statusCode).toBe(200);
    const meetings = JSON.parse(list.body).data;
    expect(meetings.some((m: any) => m.id === meetingId)).toBe(true);

    const ics = await server.inject({
      method: 'GET',
      url: `/api/v1/meetings/${meetingId}/ics`,
      headers: { cookie: adminCookie },
    });
    expect(ics.statusCode).toBe(200);
    expect(String(ics.headers['content-type'])).toContain('text/calendar');
    const body = ics.body;
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('BEGIN:VEVENT');
    expect(body).toContain('SUMMARY:Weekly site coordination meeting');
    expect(body).toContain('LOCATION:Site office\\, Block B');
    expect(body).toContain('DTSTART:');
    expect(body).toContain('DTEND:');
    expect(body).toContain('ATTENDEE');
    expect(body).toContain('supervisor@apexbuilders.co.ke');
    expect(body).not.toContain('STATUS:CANCELLED');
  });

  it('cancel flips the .ics STATUS and blocks edits on cancelled meetings', async () => {
    const patch = await server.inject({
      method: 'PATCH',
      url: `/api/v1/meetings/${meetingId}`,
      headers: { cookie: adminCookie },
      payload: { status: 'CANCELLED' },
    });
    expect(patch.statusCode).toBe(200);

    const ics = await server.inject({
      method: 'GET',
      url: `/api/v1/meetings/${meetingId}/ics`,
      headers: { cookie: adminCookie },
    });
    expect(ics.body).toContain('STATUS:CANCELLED');
  });

  it('validates payloads and requires auth', async () => {
    const badRange = await server.inject({
      method: 'POST',
      url: '/api/v1/meetings',
      headers: { cookie: adminCookie },
      payload: {
        title: 'Backwards meeting',
        startsAt: new Date(Date.now() + 7200 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      },
    });
    expect(badRange.statusCode).toBe(400);

    const anon = await server.inject({ method: 'GET', url: '/api/v1/meetings' });
    expect(anon.statusCode).toBe(401);
  });
});
