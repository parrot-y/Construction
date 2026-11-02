import { hasPermission, Permission, Role } from '@construction/permissions';
import { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Creates a Fastify preHandler hook that enforces a specific fine-grained RBAC permission.
 * Must be executed after fastify.authenticate.
 */
export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || !user.role) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required for permission evaluation',
      });
    }

    const allowed = hasPermission(user.role as Role, permission);
    if (!allowed) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Access denied. Role "${user.role}" does not have required permission "${permission}"`,
      });
    }
  };
}
