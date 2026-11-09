import { execSync } from 'child_process';
import path from 'path';

/**
 * E2E global setup: bring the e2e database to a known state.
 *
 * Requires E2E_DATABASE_URL pointing at a dedicated Postgres database
 * (never the dev or production database). Runs real Prisma migrations
 * and the app's own seed so every test works against real accounts.
 */
export default async function globalSetup(): Promise<void> {
  const dbUrl = process.env.E2E_MIGRATOR_DATABASE_URL || process.env.E2E_DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      'E2E_DATABASE_URL (app role) and optionally E2E_MIGRATOR_DATABASE_URL (owner) are required.',
    );
  }
  if (!dbUrl.includes('e2e')) {
    throw new Error('Refusing to run e2e setup against a non-e2e database.');
  }

  const repoRoot = path.resolve(__dirname, '..');
  const env = { ...process.env, DATABASE_URL: dbUrl };

  execSync('pnpm --filter @construction/db exec prisma migrate deploy', {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });

  // Re-apply RLS policies + helper-function grants (idempotent; mirrors the
  // production deploy step in docs/DEPLOY.md).
  execSync('pnpm --filter @construction/db exec prisma db execute --file prisma/rls.sql --schema prisma/schema.prisma', {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });

  // Grant the runtime role access to every table the migrations created.
  const grantsSql = `
    GRANT USAGE ON SCHEMA public TO db_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO db_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO db_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE db_migrator IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO db_app;
    ALTER DEFAULT PRIVILEGES FOR ROLE db_migrator IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO db_app;
  `;
  execSync('pnpm --filter @construction/db exec prisma db execute --stdin --schema prisma/schema.prisma', {
    cwd: repoRoot,
    env,
    input: grantsSql,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  execSync('pnpm --filter @construction/db exec tsx prisma/seed.ts', {
    cwd: repoRoot,
    env: { ...env, NODE_ENV: 'test' },
    stdio: 'inherit',
  });
}
