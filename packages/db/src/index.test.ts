import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './index';

describe('packages/db cryptographic security functions', () => {
  it('correctly hashes and verifies a valid password', async () => {
    const raw = 'Password123!@#';
    const hash = await hashPassword(raw);

    expect(hash).toContain(':');
    expect(await verifyPassword(raw, hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const raw = 'ValidSecret123';
    const hash = await hashPassword(raw);

    expect(await verifyPassword('WrongPassword', hash)).toBe(false);
  });

  it('handles malformed hashes safely without throwing unhandled exceptions', async () => {
    expect(await verifyPassword('test', 'malformed_hash_no_colon')).toBe(false);
  });
});
