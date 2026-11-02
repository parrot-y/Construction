import { Prisma } from '@prisma/client';

export interface AuditLogEntry {
  tenantId: string;
  projectId?: string | null;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Appends an audit record to the append-only audit ledger within an active transaction.
 * Always executed within `withTenantTx` alongside financial and entity mutations.
 */
export async function recordAuditLog(
  tx: Prisma.TransactionClient,
  entry: AuditLogEntry,
) {
  return tx.auditLog.create({
    data: {
      tenant_id: entry.tenantId,
      project_id: entry.projectId,
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      changes: entry.changes ? (entry.changes as Prisma.InputJsonValue) : Prisma.JsonNull,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
    },
  });
}
