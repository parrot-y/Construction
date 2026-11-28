import { useEffect } from 'react';
import { useToast } from '../components/feedback/Toast';

/**
 * P5.5 — live inbox notifications over SSE (/api/v1/events).
 *
 * The stream only carries hints ({tenantId, messageId, senderId}); on each
 * event we broadcast a window event so mounted views (Inbox) can refetch
 * through the normal filtered endpoints, and toast only for messages from
 * OTHER users — your own sends shouldn't notify you.
 *
 * EventSource reconnects automatically; the API heartbeats every 25s.
 */
export const INBOX_EVENT = 'sitesafi:inbox';

export function useInboxEvents(currentUserId?: string): void {
  const toast = useToast();

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource('/api/v1/events');

    es.addEventListener('inbox', (ev) => {
      let sid: string | null = null;
      try {
        sid = JSON.parse((ev as MessageEvent).data)?.sid ?? null;
      } catch {
        // Malformed hint — still refresh views; just skip the toast.
      }
      window.dispatchEvent(new CustomEvent(INBOX_EVENT));
      if (sid && sid !== currentUserId) {
        toast.info('New message in your Inbox');
      }
    });

    return () => es.close();
  }, [toast, currentUserId]);
}
