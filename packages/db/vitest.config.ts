import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgresql://db_app:app_secret@127.0.0.1:54329/construction_test?schema=public',
    },
  },
});
