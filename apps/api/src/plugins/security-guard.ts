import { prisma } from '@construction/db';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

interface RoleCheckResult {
  current_user: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
}

const securityGuardPluginAsync: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Only run against real database connections
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    const roles = await prisma.$queryRaw<RoleCheckResult[]>`
      SELECT current_user, rolsuper, rolbypassrls 
      FROM pg_roles 
      WHERE rolname = current_user
    `;

    if (!roles || roles.length === 0) {
      throw new Error('Security Guard check failed: could not verify current database role');
    }

    const { current_user, rolsuper, rolbypassrls } = roles[0]!;

    if (rolsuper) {
      throw new Error(
        `CRITICAL SECURITY VIOLATION: Database connection is using superuser role "${current_user}". Superusers silently bypass PostgreSQL Row-Level Security!`,
      );
    }

    if (rolbypassrls) {
      throw new Error(
        `CRITICAL SECURITY VIOLATION: Database connection role "${current_user}" has BYPASSRLS enabled. This violates tenant isolation!`,
      );
    }

    if (current_user === 'db_migrator' || current_user === 'postgres') {
      throw new Error(
        `CRITICAL SECURITY VIOLATION: Database connection role "${current_user}" is a migration or admin owner. API must connect as non-owner runtime role "db_app"!`,
      );
    }

    server.log.info(
      { currentUser: current_user, rolsuper, rolbypassrls },
      'PostgreSQL RLS security guard verified: runtime role is non-superuser and bound by RLS',
    );
  } catch (err) {
    server.log.fatal({ err }, 'Security guard failure during boot');
    throw err;
  }
};

export const securityGuardPlugin = fp(securityGuardPluginAsync, {
  name: 'security-guard-plugin',
});
