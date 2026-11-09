import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgresql://db_app:app_secret@localhost:54329/construction_test?host=/tmp',
      JWT_SECRET: process.env.JWT_SECRET || 'dev-super-secure-jwt-signing-secret-key-32-chars-minimum!',
      COOKIE_SECRET: process.env.COOKIE_SECRET || 'dev-super-secure-cookie-secret-key-32-chars!',
      MPESA_WEBHOOK_SECRET:
        process.env.MPESA_WEBHOOK_SECRET || 'mjengo-daraja-webhook-secret-production',
      SITE_OPS_WEBHOOK_SECRET:
        process.env.SITE_OPS_WEBHOOK_SECRET || 'mjengo-site-ops-webhook-secret-production-32-chars!',
    },
  },
});
