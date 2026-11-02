import { describe, expect, it } from 'vitest';
import { HealthCheckResponseSchema } from '@construction/validation';
import { buildServer } from './index';

describe('Fastify API server baseline suite', () => {
  it('responds with 200 OK and valid health schema on GET /health', async () => {
    const app = buildServer();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    // Validate payload matches shared Zod schema
    const parsed = HealthCheckResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe('ok');
      expect(parsed.data.version).toBe('0.1.0');
      expect(new Date(parsed.data.timestamp).getTime()).not.toBeNaN();
    }
  });
});
