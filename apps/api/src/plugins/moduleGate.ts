import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma, withTenantTx } from '@construction/db';

/**
 * Module gating (B1 pilot scope + audit A-06 quarantine).
 *
 * Two layers:
 *  1. DISABLED_MODULES env — global kill switch, comma-separated module ids.
 *  2. tenant_module_flags — per-tenant flags in the DB. Non-core modules are
 *     OFF unless a flag row enables them; the operator enables per tenant via
 *     /api/v1/operator/tenants/:id/modules. Core modules are never gated.
 *
 * The tenant is resolved from the access-token cookie when present; requests
 * without a session skip the DB check and fall through to route auth (401).
 */

export const GATED_MODULES: Record<string, RegExp[]> = {
  telematics: [
    /\/api\/v1\/projects\/[^/]+\/telematics-(devices|pings)/,
    /\/api\/v1\/projects\/[^/]+\/canbus-devices/,
    /\/api\/v1\/telematics\//,
  ],
  equipment: [
    /\/api\/v1\/projects\/[^/]+\/equipment/,
    /\/api\/v1\/projects\/[^/]+\/equipment-logs/,
    /\/api\/v1\/projects\/[^/]+\/maintenance-alerts/,
  ],
  soil: [/\/api\/v1\/projects\/[^/]+\/soil-tests/],
  survey: [/\/api\/v1\/projects\/[^/]+\/topographic-surveys/],
  tenders: [/\/api\/v1\/projects\/[^/]+\/tenders/],
  steel: [/\/api\/v1\/projects\/[^/]+\/structural-steel-takeoffs/],
  asphalt: [/\/api\/v1\/projects\/[^/]+\/asphalt-batches/],
  geofence: [
    /\/api\/v1\/projects\/[^/]+\/geofences/,
    /\/api\/v1\/projects\/[^/]+\/clock-(events|in)/,
  ],
  rmc: [/\/api\/v1\/projects\/[^/]+\/rmc-deliveries/],
  muster: [/\/api\/v1\/projects\/[^/]+\/(muster-rolls|laborers)/],
  independent: [
    /\/api\/v1\/projects\/[^/]+\/independent-inspections/,
    /\/api\/v1\/projects\/[^/]+\/reports\/independent-inspections/,
  ],
  rebar: [/\/api\/v1\/projects\/[^/]+\/bar-bending-schedules/],
  safety: [
    /\/api\/v1\/projects\/[^/]+\/safety-(audits|incidents)/,
    /\/api\/v1\/projects\/[^/]+\/site-alerts/,
  ],
  correspondence: [/\/api\/v1\/projects\/[^/]+\/correspondence/],
  inventory: [
    /\/api\/v1\/projects\/[^/]+\/inventory/,
    /\/api\/v1\/projects\/[^/]+\/material-(requisitions|wastage)/,
  ],
};

/** Legacy env aliases → canonical module ids. */
const ENV_ALIASES: Record<string, string> = {
  plant: 'telematics',
  tender: 'tenders',
  survey: 'survey',
};

export const ALL_GATED_MODULES = Object.keys(GATED_MODULES);

export function disabledModules(): Set<string> {
  return new Set(
    (process.env.DISABLED_MODULES || '')
      .split(',')
      .map((m) => ENV_ALIASES[m.trim().toLowerCase()] ?? m.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function moduleForUrl(url: string): string | null {
  for (const [mod, res] of Object.entries(GATED_MODULES)) {
    if (res.some((re) => re.test(url))) return mod;
  }
  return null;
}

async function tenantModuleEnabled(tenantId: string, module: string): Promise<boolean> {
  const flag = await withTenantTx(prisma, tenantId, (tx) =>
    tx.tenantModuleFlag.findUnique({
      where: { tenant_id_module: { tenant_id: tenantId, module } },
      select: { enabled: true },
    }),
  );
  return flag?.enabled === true;
}

const moduleGatePlugin = fp(async (server: FastifyInstance) => {
  const envDisabled = disabledModules();

  server.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = (request.url.split('?')[0] ?? '');
    const module = moduleForUrl(url);
    if (!module) return;
    if (envDisabled.has(module)) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });
    }

    // Resolve tenant from the access-token cookie without running full auth —
    // this hook runs before the cookie/jwt plugins, so parse the header and
    // verify the JWT directly. Unauthenticated requests fall through to the
    // route's own 401.
    let tenantId: string | undefined;
    try {
      const cookieHeader = request.headers.cookie ?? '';
      const token = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/)?.[1];
      if (token) {
        const payload = server.jwt.verify(decodeURIComponent(token)) as { tenantId?: string; typ?: string };
        if (payload?.typ === 'access' && payload.tenantId) tenantId = payload.tenantId;
      }
    } catch {
      tenantId = undefined;
    }
    if (!tenantId) return; // let route auth handle it

    const enabled = await tenantModuleEnabled(tenantId, module).catch(() => false);
    if (!enabled) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });
    }
  });
}, { name: 'module-gate' });

export default moduleGatePlugin;
