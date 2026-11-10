import { Prisma } from '@construction/db';

/**
 * System → team notifications via the real inbox (inbox_messages).
 * Written inside the same tenant transaction as the business event so a
 * notification can never exist without the event that caused it.
 *
 * `senderId` is the acting user (or the portal link creator for external
 * actions); `senderName` labels the message — 'Site Safi' for system events.
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
  await tx.inboxMessage.create({
    data: {
      tenant_id: opts.tenantId,
      project_id: opts.projectId ?? null,
      sender_id: opts.senderId,
      sender_name: opts.senderName ?? 'Site Safi',
      body: opts.body,
      audience: opts.audience ?? 'PROJECT_TEAM',
      target_roles: opts.targetRoles ?? [],
    },
  });
}
