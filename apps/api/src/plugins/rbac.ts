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

/**
 * PreHandler that passes when the caller holds ANY of the given permissions.
 * Used for multi-action endpoints where the required permission depends on
 * the request payload (the handler still enforces the precise action-level
 * permission after parsing).
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || !user.role) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required for permission evaluation',
      });
    }
    const allowed = permissions.some((p) => hasPermission(user.role as Role, p));
    if (!allowed) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Access denied. Role "${user.role}" lacks all of: ${permissions.join(', ')}`,
      });
    }
  };
}
