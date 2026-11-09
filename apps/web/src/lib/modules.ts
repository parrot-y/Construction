/**
 * Peripheral-module feature flags (audit A-3.7 / MVP_SCOPE).
 *
 * Modules outside the MVP core chain (quote → project → BoQ → site diary →
 * variation → payment certificate → invoice → payment → retention) are
 * hidden from navigation unless explicitly enabled.
 *
 *   VITE_ENABLE_PERIPHERAL_MODULES=plant,survey,tender,steel,asphalt,geofence,rebar,rmc
 *
 * In dev/test builds all modules are visible so the full surface stays
 * exercisable; production builds show only the MVP chain unless the env
 * flag opts modules back in.
 */

export const PERIPHERAL_MODULES = [
  'tenders',
  'equipment',
  'telematics',
  'geofence',
  'rebar',
  'rmc',
  'steel',
  'soil',
  'asphalt',
  'survey',
] as const;

export type PeripheralModule = (typeof PERIPHERAL_MODULES)[number];

const DEV_ALL = import.meta.env.DEV === true;

export function isModuleEnabled(id: string): boolean {
  if (!(PERIPHERAL_MODULES as readonly string[]).includes(id)) return true;
  if (DEV_ALL) return true;
  const enabled = (import.meta.env.VITE_ENABLE_PERIPHERAL_MODULES || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  return enabled.includes(id);
}
