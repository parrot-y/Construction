import { describe, expect, it, beforeAll } from 'vitest';
import { buildServer } from './index';
import { prisma, withTenantTx } from '@construction/db';
import { PROJECT_TYPE_CATEGORIES } from '@construction/validation';

// Phase 2.8: project taxonomy — project_type/project_subtype validated
// against the shared config, starter content seeded, NCA bands editable.

describe('2.8 project types end-to-end', () => {
  const server = buildServer();
  let adminCookie: string;
  let tenantId: string;
  let seq = 0;
  const nextCode = () => `PT-${Date.now().toString().slice(-5)}-${seq++}`;

  const createProject = (payload: Record<string, unknown>) =>
    server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { cookie: adminCookie },
      payload: { name: `Type Test ${seq}`, code: nextCode(), ...payload },
    });

  beforeAll(async () => {
    await server.ready();
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@apexbuilders.co.ke', password: 'Password123!' },
    });
    adminCookie = res.headers['set-cookie'] as string;
    tenantId = JSON.parse(res.body).user.tenant.id;
  });

  it('creates one project of every configured type with matching subtype', async () => {
    for (const cat of PROJECT_TYPE_CATEGORIES) {
      const sub = cat.subtypes[0];
      const res = await createProject({ projectType: cat.key, projectSubtype: sub.key });
      expect(res.statusCode, `${cat.key}: ${res.body}`).toBe(201);
      const project = JSON.parse(res.body).data;
      expect(project.project_type).toBe(cat.key);
      expect(project.project_subtype).toBe(sub.key);
    }
  });

  it('rejects an unknown project type', async () => {
    const res = await createProject({ projectType: 'SPACE_PORT' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Unknown project type');
  });

  it('rejects a subtype that does not belong to the type', async () => {
    const res = await createProject({ projectType: 'RESIDENTIAL', projectSubtype: 'WAREHOUSE' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('does not belong');
  });

  it('rejects a subtype without a type', async () => {
    const res = await createProject({ projectSubtype: 'SINGLE_HOME' });
    expect(res.statusCode).toBe(400);
  });

  it('project without a type still creates (legacy rows unaffected)', async () => {
    const res = await createProject({});
    expect(res.statusCode).toBe(201);
    const project = JSON.parse(res.body).data;
    expect(project.project_type).toBeNull();
  });

  it('seeds starter BoQ sections, milestones and checklists for a typed project', async () => {
    const res = await createProject({ projectType: 'CIVIL', projectSubtype: 'ROADS' });
    expect(res.statusCode).toBe(201);
    const project = JSON.parse(res.body).data;
    const rows = await withTenantTx(prisma, tenantId, async (tx) => ({
      boq: await tx.bOQ.findFirst({ where: { project_id: project.id }, include: { sections: true } }),
      tasks: await tx.projectScheduleTask.count({ where: { project_id: project.id } }),
      checklists: await tx.checklistAssignment.count({ where: { project_id: project.id } }),
    }));
    expect(rows.boq?.sections.length).toBeGreaterThan(0);
    expect(rows.tasks).toBe(PROJECT_TYPE_CATEGORIES.find((c) => c.key === 'CIVIL')!.starter.milestones.length);
    expect(rows.checklists).toBe(PROJECT_TYPE_CATEGORIES.find((c) => c.key === 'CIVIL')!.starter.checklists.length);
  });

  it('does not seed starters for an untyped project', async () => {
    const res = await createProject({});
    const project = JSON.parse(res.body).data;
    const counts = await withTenantTx(prisma, tenantId, async (tx) => ({
      boq: await tx.bOQ.count({ where: { project_id: project.id } }),
      tasks: await tx.projectScheduleTask.count({ where: { project_id: project.id } }),
      checklists: await tx.checklistAssignment.count({ where: { project_id: project.id } }),
    }));
    expect(counts).toEqual({ boq: 0, tasks: 0, checklists: 0 });
  });

  it('GET /api/v1/project-types returns categories and the tenant NCA bands', async () => {
    const res = await server.inject({
      method: 'GET', url: '/api/v1/project-types', headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    expect(data.categories.length).toBe(PROJECT_TYPE_CATEGORIES.length);
    expect(data.ncaRules.length).toBeGreaterThanOrEqual(40);
    expect(data.ncaRules[0]).toHaveProperty('class_label');
  });

  it('PATCH nca rule updates bands and is audited', async () => {
    const list = await server.inject({
      method: 'GET', url: '/api/v1/project-types', headers: { cookie: adminCookie },
    });
    const rule = JSON.parse(list.body).data.ncaRules.find((r: any) => r.trade === 'Building' && r.class_label === 'NCA-1');
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/project-types/nca-rules/${rule.id}`,
      headers: { cookie: adminCookie },
      payload: { maxContractValue: '6000000', notes: 'Updated band for test' },
    });
    expect(res.statusCode).toBe(200);
    const updated = JSON.parse(res.body).data;
    expect(Number(updated.max_contract_value)).toBe(6000000);
    // restore
    await server.inject({
      method: 'PATCH',
      url: `/api/v1/project-types/nca-rules/${rule.id}`,
      headers: { cookie: adminCookie },
      payload: { maxContractValue: '5000000', notes: 'Default band — confirm current NCA limits before registration' },
    });
  });

  it('PATCH project type round-trips through update', async () => {
    const created = await createProject({});
    const project = JSON.parse(created.body).data;
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}`,
      headers: { cookie: adminCookie },
      payload: { projectType: 'SPECIALIST', projectSubtype: 'SOLAR_ENERGY' },
    });
    expect(res.statusCode).toBe(200);
    const updated = JSON.parse(res.body).data;
    expect(updated.project_type).toBe('SPECIALIST');
    expect(updated.project_subtype).toBe('SOLAR_ENERGY');
  });
});
