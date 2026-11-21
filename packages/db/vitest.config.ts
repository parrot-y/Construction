import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // scrypt N=2^17 costs ~1s per hash — allow headroom.
    testTimeout: 30000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgresql://db_app:app_secret@localhost:54329/construction_test?host=/tmp&schema=public',
    },
  },
});
