import { Client } from 'pg';
import type { Prisma } from '@construction/db';

/**
 * P5.5 — live inbox notifications.
 *
 * Writers call `publishInboxEvent` inside the same tenant transaction that
 * creates the InboxMessage. `pg_notify` delivers on COMMIT, so a rolled-back
 * message can never produce a phantom notification, and every API instance
 * (or a future pg-boss worker) sees the same stream.
 *
 * Payload is deliberately minimal — { tenantId, messageId }. The SSE endpoint
 * re-checks the tenant before forwarding, and clients refetch the inbox feed
 * (which applies audience/role filtering) rather than trusting event content.
 */
export const INBOX_CHANNEL = 'sitesafi_inbox';

export async function publishInboxEvent(
  tx: Prisma.TransactionClient,
  opts: { tenantId: string; messageId: string; senderId?: string },
): Promise<void> {
  const payload = JSON.stringify({ t: opts.tenantId, id: opts.messageId, sid: opts.senderId ?? null });
  await tx.$executeRaw`SELECT pg_notify(${INBOX_CHANNEL}, ${payload})`;
}

/**
 * One shared LISTEN connection per process. SSE routes subscribe through
 * `watchInbox`; the client reconnects transparently on drop.
 */
let listenClient: Client | null = null;
let listenReady: Promise<Client> | null = null;
const listeners = new Set<(payload: { t: string; id: string }) => void>();

function parsePayload(raw: string): { t: string; id: string; sid?: string | null } | null {
  try {
    const p = JSON.parse(raw);
    return typeof p?.t === 'string' && typeof p?.id === 'string' ? p : null;
  } catch {
    return null;
  }
}

async function ensureListener(): Promise<Client> {
  if (listenClient) return listenClient;
  if (!listenReady) {
    listenReady = (async () => {
      try {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      client.on('notification', (msg) => {
        if (msg.channel !== INBOX_CHANNEL || !msg.payload) return;
        const payload = parsePayload(msg.payload);
        if (!payload) return;
        for (const fn of listeners) {
          try { fn(payload); } catch { /* listener errors must not kill the bus */ }
        }
      });
      client.on('error', () => { /* reconnect handled on 'end' */ });
      client.on('end', () => {
        listenClient = null;
        listenReady = null;
        // Reconnect while anyone is still listening — events are only hints,
        // but a silent dead bus would look like "notifications stopped".
        if (listeners.size > 0) {
          setTimeout(() => { void ensureListener().catch(() => {}); }, 2000);
        }
      });
      await client.connect();
      await client.query(`LISTEN ${INBOX_CHANNEL}`);
      listenClient = client;
      return client;
      } catch (err) {
        listenReady = null;
        throw err;
      }
    })();
  }
  return listenReady;
}

/** Subscribe to inbox events; returns an unsubscribe function. */
export async function watchInbox(
  fn: (payload: { t: string; id: string; sid?: string | null }) => void,
): Promise<() => void> {
  listeners.add(fn);
  try {
    await ensureListener();
  } catch {
    listeners.delete(fn);
    throw new Error('event bus unavailable');
  }
  return () => listeners.delete(fn);
}
