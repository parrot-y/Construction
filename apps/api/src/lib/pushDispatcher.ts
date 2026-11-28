import { prisma, withTenantTx } from '@construction/db';
import { PRODUCT_NAME } from './product';
import { watchInbox } from './inboxEvents';
import { dispatchTenantPush, pushConfig } from './webPush';

/**
 * P6 — push dispatcher.
 *
 * One process-level subscriber on the inbox event bus. SSE hints fire on
 * COMMIT (pg_notify), so push sends only ever follow a persisted message —
 * same guarantee as the SSE stream, extended to closed/backgrounded apps.
 *
 * Disabled entirely when VAPID_* env is unset: `startPushDispatcher`
 * returns without subscribing, so non-push deployments pay nothing.
 */

let unsubscribe: (() => void) | null = null;
let started = false;

export async function startPushDispatcher(log?: { error: (o: unknown, m?: string) => void }): Promise<void> {
  if (started) return;
  if (!pushConfig().enabled) return;
  started = true;

  unsubscribe = await watchInbox(async (payload) => {
    try {
      const msg = await withTenantTx(prisma, payload.t, (tx) =>
        tx.inboxMessage.findFirst({
          where: { id: payload.id, tenant_id: payload.t },
          select: { body: true, sender_id: true, sender_name: true },
        }),
      );
      if (!msg) return;
      const sender = msg.sender_name && msg.sender_name !== PRODUCT_NAME ? msg.sender_name : null;
      await dispatchTenantPush({
        tenantId: payload.t,
        excludeUserId: payload.sid ?? msg.sender_id,
        title: sender ? `Message from ${sender}` : PRODUCT_NAME,
        body: msg.body,
        url: '/app/inbox',
        tag: `inbox-${payload.id}`,
      });
    } catch (err) {
      log?.error({ err, messageId: payload.id }, '[push] dispatch failed');
    }
  });
}

export async function stopPushDispatcher(): Promise<void> {
  unsubscribe?.();
  unsubscribe = null;
  started = false;
}
