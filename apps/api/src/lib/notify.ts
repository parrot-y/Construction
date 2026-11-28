import { Prisma } from '@construction/db';
import { PRODUCT_NAME } from './product';
import { publishInboxEvent } from './inboxEvents';

/**
 * System → team notifications via the real inbox (inbox_messages).
 * Written inside the same tenant transaction as the business event so a
 * notification can never exist without the event that caused it.
 *
 * `senderId` is the acting user (or the portal link creator for external
 * actions); `senderName` labels the message — PRODUCT_NAME for system events.
 */
export async function notifyTeam(
  tx: Prisma.TransactionClient,
  opts: {
    tenantId: string;
    projectId?: string | null;
    senderId: string;
    senderName?: string;
    body: string;
    audience?: 'ALL_MEMBERS' | 'PROJECT_TEAM' | 'ROLE';
    targetRoles?: string[];
  },
) {
  const msg = await tx.inboxMessage.create({
    data: {
      tenant_id: opts.tenantId,
      project_id: opts.projectId ?? null,
      sender_id: opts.senderId,
      sender_name: opts.senderName ?? PRODUCT_NAME,
      body: opts.body,
      audience: opts.audience ?? 'PROJECT_TEAM',
      target_roles: opts.targetRoles ?? [],
    },
  });
  // P5.5: pg_notify inside the tx — delivered on commit, seen by every API
  // instance's SSE listeners. Payload carries ids only; clients refetch.
  await publishInboxEvent(tx, { tenantId: opts.tenantId, messageId: msg.id, senderId: opts.senderId });
}
