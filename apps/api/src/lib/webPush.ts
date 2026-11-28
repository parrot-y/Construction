import webpush from 'web-push';
import { prisma, withTenantTx } from '@construction/db';
import { PRODUCT_NAME } from './product';

/**
 * P6 — web push delivery.
 *
 * SSE (/api/v1/events) covers tabs that are open; push covers closed or
 * backgrounded apps. Dispatch is post-commit: the inbox-event bus
 * (pg_notify → COMMIT) triggers `dispatchTenantPush`, so a rolled-back
 * message can never push a phantom notification.
 *
 * Configuration is env-only: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY /
 * VAPID_SUBJECT (mailto: or https:). Unset ⇒ push is disabled and every
 * entry point is a clean no-op.
 */

export interface PushConfig {
  enabled: boolean;
  publicKey: string | null;
}

export function pushConfig(): PushConfig {
  const publicKey = process.env.VAPID_PUBLIC_KEY || null;
  const privateKey = process.env.VAPID_PRIVATE_KEY || null;
  const subject = process.env.VAPID_SUBJECT || 'mailto:ops@sitesafi.app';
  const enabled = Boolean(publicKey && privateKey);
  if (enabled) {
    webpush.setVapidDetails(subject, publicKey!, privateKey!);
  }
  return { enabled, publicKey: enabled ? publicKey : null };
}

export interface TenantPushPayload {
  tenantId: string;
  /** The acting user never gets a push for their own action. */
  excludeUserId?: string | null;
  title?: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send a push to every subscription in the tenant except the actor's.
 * Endpoints answering 404/410 are pruned — the browser subscription is
 * dead and retrying it forever would just burn quota.
 */
export async function dispatchTenantPush(payload: TenantPushPayload): Promise<{ sent: number; pruned: number }> {
  const cfg = pushConfig();
  if (!cfg.enabled) return { sent: 0, pruned: 0 };

  const subs = await withTenantTx(prisma, payload.tenantId, (tx) =>
    tx.pushSubscription.findMany({
      where: {
        tenant_id: payload.tenantId,
        ...(payload.excludeUserId ? { user_id: { not: payload.excludeUserId } } : {}),
      },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    }),
  );
  if (subs.length === 0) return { sent: 0, pruned: 0 };

  const body = JSON.stringify({
    title: payload.title ?? PRODUCT_NAME,
    body: payload.body.slice(0, 240),
    url: payload.url ?? '/app',
    tag: payload.tag ?? 'sitesafi',
  });

  let sent = 0;
  let pruned = 0;
  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
        { TTL: 3600 },
      ),
    ),
  );

  const deadIds: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      sent += 1;
      return;
    }
    const statusCode = (r.reason as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) deadIds.push(subs[i]!.id);
  });
  if (deadIds.length > 0) {
    await withTenantTx(prisma, payload.tenantId, (tx) =>
      tx.pushSubscription.deleteMany({ where: { id: { in: deadIds } } }),
    );
    pruned = deadIds.length;
  }
  return { sent, pruned };
}
