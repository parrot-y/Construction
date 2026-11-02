import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgresql://db_app:app_secret@127.0.0.1:54329/construction_test?schema=public',
      JWT_SECRET: process.env.JWT_SECRET || 'dev-super-secure-jwt-signing-secret-key-32-chars-minimum!',
      COOKIE_SECRET: process.env.COOKIE_SECRET || 'dev-super-secure-cookie-secret-key-32-chars!',
    },
  },
});
