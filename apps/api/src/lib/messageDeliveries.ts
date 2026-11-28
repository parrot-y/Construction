import { prisma, withTenantTx } from '@construction/db';
import { maskRecipient, type NotifyChannel, type SendResult } from '../integrations/messaging';

/**
 * P5.7 — durable delivery log for outbound messaging.
 *
 * `recordMessageDelivery` is deliberately best-effort: a logging failure must
 * never break the send path it observes. Recipients are stored masked only —
 * the raw address/number never touches the table.
 */

export type MessageDeliveryStatus = 'SIMULATED' | 'DELIVERED' | 'FAILED';

export interface DeliveryRecord {
  channel: NotifyChannel;
  to: string;
  subject?: string;
  body: string;
  source: string;
}

export function deliveryStatusOf(result: SendResult): MessageDeliveryStatus {
  if (result.simulated) return 'SIMULATED';
  return result.ok ? 'DELIVERED' : 'FAILED';
}

export async function recordMessageDelivery(
  tenantId: string,
  record: DeliveryRecord,
  result: SendResult,
): Promise<void> {
  try {
    await withTenantTx(prisma, tenantId, (tx) =>
      tx.messageDelivery.create({
        data: {
          tenant_id: tenantId,
          channel: record.channel,
          provider: result.provider || 'none',
          recipient_masked: maskRecipient(record.to),
          subject: record.subject?.slice(0, 255) ?? null,
          body_excerpt: record.body.slice(0, 500),
          status: deliveryStatusOf(result),
          provider_reference: result.reference ?? null,
          error_message: result.ok ? null : (result.error ?? 'send failed').slice(0, 500),
          source: record.source.slice(0, 60),
          sent_at: result.ok && !result.simulated ? new Date() : null,
        },
      }),
    );
  } catch (err) {
    // intentionally ignored: delivery logging is observability, never a send blocker
    console.warn('[message-deliveries] failed to record delivery', err);
  }
}
