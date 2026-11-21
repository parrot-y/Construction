import { describe, expect, it } from 'vitest';
import { redactDeep, redactHeaders, redactUrl } from './lib/logRedaction';

describe('log redaction', () => {
  it('redacts portal bearer tokens in URL paths', () => {
    expect(redactUrl('/api/v1/portals/consultant/abc123SECRETtoken/rfis/42/reply'))
      .toBe('/api/v1/portals/consultant/[redacted]/rfis/42/reply');
    expect(redactUrl('/api/v1/portals/compliance/t0k3n/visits'))
      .toBe('/api/v1/portals/compliance/[redacted]/visits');
    expect(redactUrl('/api/v1/portals/validate/sometoken'))
      .toBe('/api/v1/portals/validate/[redacted]');
  });

  it('leaves non-portal URLs untouched', () => {
    expect(redactUrl('/api/v1/projects/123/costs?limit=10')).toBe('/api/v1/projects/123/costs?limit=10');
    expect(redactUrl('/health')).toBe('/health');
  });

  it('redacts token query parameters', () => {
    expect(redactUrl('/api/v1/public/quotes/respond?token=sekret&x=1'))
      .toBe('/api/v1/public/quotes/respond?token=[redacted]&x=1');
    expect(redactUrl('/cb?access_token=abc#frag')).toBe('/cb?access_token=[redacted]#frag');
  });

  it('drops credential headers to [redacted]', () => {
    const out = redactHeaders({
      host: 'api.example.com',
      cookie: 'session=abc',
      authorization: 'Bearer xyz',
      'set-cookie': 'a=b',
      'user-agent': 'vitest',
    });
    expect(out.cookie).toBe('[redacted]');
    expect(out.authorization).toBe('[redacted]');
    expect(out['set-cookie']).toBe('[redacted]');
    expect(out.host).toBe('api.example.com');
    expect(out['user-agent']).toBe('vitest');
  });

  it('redacts secret-looking fields recursively', () => {
    const out = redactDeep({
      email: 'a@b.c',
      password: 'hunter2',
      nested: { pin: '123456', note: 'ok', list: [{ token: 't', keep: 1 }] },
    }) as any;
    expect(out.password).toBe('[redacted]');
    expect(out.nested.pin).toBe('[redacted]');
    expect(out.nested.list[0].token).toBe('[redacted]');
    expect(out.nested.list[0].keep).toBe(1);
    expect(out.email).toBe('a@b.c');
  });
});
