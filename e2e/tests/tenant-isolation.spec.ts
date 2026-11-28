import { test, expect, APIRequestContext } from '@playwright/test';
import { API, login, apiGet, apiPost, unwrap, type Session } from './helpers';

/**
 * Tenant isolation — the OPEN item from PROJECT_STATUS: a real second
 * tenant (self-serve registration) proving RLS holds across every core
 * read surface, not just membership checks on nonexistent projects.
 */

const stamp = Date.now().toString().slice(-6);
const PASSWORD = 'Password123!';
let tenantB: Session;
let tenantA: Session;
let projectAId = '';
let projectBId = '';
const supplierBName = `Isolation Suppliers ${stamp}`;
const supplierAName = `Apex Timber ${stamp}`;

async function registerTenantB(request: APIRequestContext): Promise<Session> {
  const email = `admin.${stamp}@isotenant.test`;
  const r = await request.post(`${API}/api/v1/auth/register-company`, {
    data: {
      companyName: `Isolation Builders ${stamp}`,
      adminFullName: 'Wanjiru Isolation',
      email,
      phone: '+254700111222',
      password: PASSWORD,
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  return login(request, email, PASSWORD);
}

test.describe.serial('tenant isolation — two real tenants', () => {
  test('fixture: register tenant B, seed marker data in both tenants', async ({ request }) => {
    tenantA = await login(request, 'admin@apexbuilders.co.ke');
    tenantB = await registerTenantB(request);
    expect(tenantB.tenantId).not.toBe(tenantA.tenantId);

    // Tenant A marker: first project + a uniquely-named supplier.
    const projectsA = unwrap(await (await apiGet(request, tenantA, '/api/v1/projects')).json());
    const arrA = Array.isArray(projectsA) ? projectsA : projectsA.items || projectsA.projects || [];
    projectAId = arrA[0].id;
    expect(projectAId).toBeTruthy();
    const supA = await apiPost(request, tenantA, '/api/v1/suppliers', { name: supplierAName, phone: '+254711000001' });
    expect(supA.status()).toBe(201);

    // Tenant B marker: own project + supplier.
    const projB = await apiPost(request, tenantB, '/api/v1/projects', {
      name: `Isolation Tower ${stamp}`,
      code: `ISO-${stamp}`,
      location: 'Nakuru, Kenya',
      contractValue: '12000000',
    });
    expect(projB.status(), await projB.text()).toBeLessThan(300);
    const pb = unwrap(await projB.json());
    projectBId = pb.id || pb.data?.id;
    expect(projectBId).toBeTruthy();

    const supB = await apiPost(request, tenantB, '/api/v1/suppliers', { name: supplierBName, phone: '+254711000002' });
    expect(supB.status()).toBe(201);
  });

  test('project reads are tenant-scoped in both directions', async ({ request }) => {
    test.skip(!projectAId || !projectBId, 'needs fixture');

    // B cannot read A's project; A cannot read B's.
    const bReadsA = await apiGet(request, tenantB, `/api/v1/projects/${projectAId}`);
    expect([403, 404]).toContain(bReadsA.status());
    const aReadsB = await apiGet(request, tenantA, `/api/v1/projects/${projectBId}`);
    expect([403, 404]).toContain(aReadsB.status());

    // Project-scoped sub-resources are equally closed: either rejected, or
    // an empty RLS-filtered list — never the other tenant's rows.
    const bPosOnA = await apiGet(request, tenantB, `/api/v1/projects/${projectAId}/purchase-orders`);
    if (bPosOnA.status() === 200) {
      expect(unwrap(await bPosOnA.json())).toEqual([]);
    } else {
      expect([403, 404]).toContain(bPosOnA.status());
    }
    const aBoqOnB = await apiGet(request, tenantA, `/api/v1/projects/${projectBId}/boq/items`);
    if (aBoqOnB.status() === 200) {
      const items = unwrap(await aBoqOnB.json());
      expect(Array.isArray(items) ? items : items.items ?? []).toEqual([]);
    } else {
      expect([403, 404]).toContain(aBoqOnB.status());
    }
  });

  test('list endpoints never leak the other tenant\'s rows', async ({ request }) => {
    test.skip(!projectAId || !projectBId, 'needs fixture');

    // B sees its own marker, never A's project id.
    const projectsB = JSON.stringify(unwrap(await (await apiGet(request, tenantB, '/api/v1/projects')).json()));
    expect(projectsB).toContain(`ISO-${stamp}`);
    expect(projectsB).not.toContain(projectAId);

    // A's list never contains B's project or code.
    const projectsA = JSON.stringify(unwrap(await (await apiGet(request, tenantA, '/api/v1/projects')).json()));
    expect(projectsA).not.toContain(`ISO-${stamp}`);
    expect(projectsA).not.toContain(projectBId);

    const suppliersB = JSON.stringify(unwrap(await (await apiGet(request, tenantB, '/api/v1/suppliers')).json()));
    expect(suppliersB).not.toContain(supplierAName);
    const suppliersA = JSON.stringify(unwrap(await (await apiGet(request, tenantA, '/api/v1/suppliers')).json()));
    expect(suppliersA).not.toContain(supplierBName);

    // Money surfaces: each tenant sees only its own register.
    const regA = JSON.stringify(await (await apiGet(request, tenantA, '/api/v1/purchase-register?limit=50')).json());
    const regB = JSON.stringify(await (await apiGet(request, tenantB, '/api/v1/purchase-register?limit=50')).json());
    expect(regB).not.toContain(supplierAName);
    expect(regA).not.toContain(supplierBName);
  });
});
