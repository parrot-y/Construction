import { describe, expect, it } from 'vitest';
import { VARIATION_SEEDS } from './variation-seeds';

/**
 * K4 — the demo seed must never show the owner two identical change
 * orders. Every seeded variation needs a distinct title, amount, reason
 * and lifecycle state (at minimum: one waiting for owner, one approved,
 * one rejected).
 */
describe('seeded variation orders', () => {
  it('no two variations share title and amount', () => {
    const seen = new Map<string, number>();
    for (const v of VARIATION_SEEDS) {
      const key = `${v.title}::${v.net_amount}`;
      expect(seen.has(key), `duplicate seeded variation: ${key}`).toBe(false);
      seen.set(key, 1);
    }
  });

  it('titles, amounts and reasons are all distinct', () => {
    expect(new Set(VARIATION_SEEDS.map((v) => v.title)).size).toBe(VARIATION_SEEDS.length);
    expect(new Set(VARIATION_SEEDS.map((v) => v.net_amount)).size).toBe(VARIATION_SEEDS.length);
    expect(new Set(VARIATION_SEEDS.map((v) => v.reason)).size).toBe(VARIATION_SEEDS.length);
  });

  it('covers waiting-for-owner, approved and rejected states', () => {
    const states = new Set(VARIATION_SEEDS.map((v) => v.status));
    expect(states.has('OWNER_REVIEW')).toBe(true);
    expect(states.has('APPROVED')).toBe(true);
    expect(states.has('REJECTED')).toBe(true);
  });
});
