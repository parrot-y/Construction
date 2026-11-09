import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Peripheral-module quarantine (audit A-06).
 *
 * Plant telematics, survey, tender, steel takeoff, asphalt and geofence
 * modules are flagged as peripheral: they are stable but receive no new
 * feature work. Set DISABLED_MODULES to a comma-separated subset to remove
 * them from the attack surface entirely (routes return 404).
 *
 *   DISABLED_MODULES=plant,survey,tender,steel,asphalt,geofence
 *
 * Default: all enabled (dev/test). Production deploys should disable the
 * modules that are not piloted.
 */

export const MODULE_PREFIXES: Record<string, RegExp[]> = {
  plant: [
    /\/api\/v1\/projects\/[^/]+\/telematics-/,
    /\/api\/v1\/projects\/[^/]+\/canbus-devices/,
    /\/api\/v1\/projects\/[^/]+\/maintenance-alerts/,
    /\/api\/v1\/projects\/[^/]+\/equipment/,
    /\/api\/v1\/telematics\//,
  ],
  survey: [
    /\/api\/v1\/projects\/[^/]+\/soil-tests/,
    /\/api\/v1\/projects\/[^/]+\/topographic-surveys/,
  ],
  tender: [/\/api\/v1\/projects\/[^/]+\/tenders/],
  steel: [/\/api\/v1\/projects\/[^/]+\/structural-steel-takeoffs/],
  asphalt: [/\/api\/v1\/projects\/[^/]+\/asphalt-batches/],
  geofence: [
    /\/api\/v1\/projects\/[^/]+\/geofences/,
    /\/api\/v1\/projects\/[^/]+\/clock-(events|in)/,
  ],
};

export function disabledModules(): Set<string> {
  return new Set(
    (process.env.DISABLED_MODULES || '')
      .split(',')
      .map((m) => m.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isModuleEnabled(module: string): boolean {
  return !disabledModules().has(module);
}

const moduleGatePlugin = fp(async (server: FastifyInstance) => {
  const disabled = disabledModules();
  if (disabled.size === 0) return;

  const active = [...disabled].flatMap((m) => MODULE_PREFIXES[m] ?? []);
  server.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url.split('?')[0] ?? '';
    if (active.some((re) => re.test(url))) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });
    }
  });
}, { name: 'module-gate' });

export default moduleGatePlugin;
