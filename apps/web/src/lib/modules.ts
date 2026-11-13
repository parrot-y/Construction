/**
 * Module feature flags (B1 pilot scope).
 *
 * Two layers:
 *  - PERIPHERAL_MODULES: ids that can be gated per tenant. Anything not in
 *    this list is Pilot Core and always visible.
 *  - Runtime flags: ConsoleContext fetches /api/v1/company/modules once per
 *    session and calls configureRuntimeModules(); when configured the set is
 *    authoritative (non-core OFF unless the tenant flag enables it).
 *  - Env/dev fallback: before runtime flags load, VITE_ENABLE_PERIPHERAL_MODULES
 *    and DEV decide (keeps unauthenticated/portal surfaces unchanged).
 */

export const PERIPHERAL_MODULES = [
  'equipment',
  'telematics',
  'soil',
  'survey',
  'tenders',
  'steel',
  'asphalt',
  'geofence',
  'rmc',
  'muster',
  'independent',
  'rebar',
  'safety',
  'correspondence',
  'inventory',
] as const;

/** Legacy aliases used at call sites → canonical flag ids. */
const ALIASES: Record<string, string> = {
  plant: 'telematics',
};

export type PeripheralModule = (typeof PERIPHERAL_MODULES)[number];

let runtimeModules: Set<string> | null = null;

/** Called once per session with the tenant's enabled non-core module ids. */
export function configureRuntimeModules(modules: string[] | null): void {
  runtimeModules = modules ? new Set(modules) : null;
}

export function runtimeModulesConfigured(): boolean {
  return runtimeModules !== null;
}

const DEV_ALL = import.meta.env.DEV === true;

export function isModuleEnabled(id: string): boolean {
  const canonical = ALIASES[id] ?? id;
  if (!(PERIPHERAL_MODULES as readonly string[]).includes(canonical)) return true;
  // Authoritative once the tenant's flags have loaded.
  if (runtimeModules !== null) return runtimeModules.has(canonical);
  if (DEV_ALL) return true;
  const enabled = (import.meta.env.VITE_ENABLE_PERIPHERAL_MODULES || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  return enabled.includes(canonical) || enabled.includes(id);
}
