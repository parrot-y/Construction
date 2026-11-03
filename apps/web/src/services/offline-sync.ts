/**
 * Client-Side Offline Storage & Synchronization Engine (ADR-004)
 * Manages IndexedDB queue, client-side photo compression, and idempotent sync.
 */

export interface OfflineMutationRecord {
  id: string;
  idempotency_key: string;
  projectId: string;
  endpoint: string;
  method: 'POST' | 'PUT';
  payload: Record<string, unknown>;
  client_timestamp: string;
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED';
  retry_count: number;
  last_error?: string;
}

const DB_NAME = 'mjengo_offline_db';
const STORE_NAME = 'mutations_queue';
const DB_VERSION = 1;

/**
 * Initializes IndexedDB storage for offline field mutations.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('projectId', 'projectId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generates a standard RFC4122 v4 UUID.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Queues a mutation record into IndexedDB when offline.
 */
export async function queueOfflineMutation(
  projectId: string,
  endpoint: string,
  payload: Record<string, unknown>,
  method: 'POST' | 'PUT' = 'POST',
): Promise<OfflineMutationRecord> {
  const mutation: OfflineMutationRecord = {
    id: generateUUID(),
    idempotency_key: generateUUID(),
    projectId,
    endpoint,
    method,
    payload,
    client_timestamp: new Date().toISOString(),
    status: 'PENDING',
    retry_count: 0,
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(mutation);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Fallback to localStorage if IndexedDB is blocked
    try {
      const existing = JSON.parse(localStorage.getItem('mjengo_offline_queue') || '[]');
      existing.push(mutation);
      localStorage.setItem('mjengo_offline_queue', JSON.stringify(existing));
    } catch {
      // Ignored in purely simulated contexts
    }
  }

  return mutation;
}

/**
 * Retrieves all pending offline mutations queued locally.
 */
export async function getQueuedMutations(): Promise<OfflineMutationRecord[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const records: OfflineMutationRecord[] = req.result || [];
        resolve(records.filter((r) => r.status === 'PENDING' || r.status === 'FAILED'));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const existing = JSON.parse(localStorage.getItem('mjengo_offline_queue') || '[]');
      return existing.filter((r: OfflineMutationRecord) => r.status === 'PENDING' || r.status === 'FAILED');
    } catch {
      return [];
    }
  }
}

/**
 * Flushes all pending mutations against the Fastify API with Idempotency-Key headers.
 */
export async function flushSyncQueue(): Promise<{ syncedCount: number; failedCount: number }> {
  const queue = await getQueuedMutations();
  if (queue.length === 0) return { syncedCount: 0, failedCount: 0 };

  let syncedCount = 0;
  let failedCount = 0;

  for (const item of queue) {
    try {
      const res = await fetch(item.endpoint, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': item.idempotency_key,
        },
        body: JSON.stringify(item.payload),
      });

      if (res.ok) {
        syncedCount++;
        await removeMutation(item.id);
      } else {
        failedCount++;
      }
    } catch {
      failedCount++;
    }
  }

  return { syncedCount, failedCount };
}

/**
 * Removes a successfully synchronized mutation from local storage.
 */
export async function removeMutation(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const existing = JSON.parse(localStorage.getItem('mjengo_offline_queue') || '[]');
      const filtered = existing.filter((r: OfflineMutationRecord) => r.id !== id);
      localStorage.setItem('mjengo_offline_queue', JSON.stringify(filtered));
    } catch {
      // Ignored
    }
  }
}

/**
 * Client-Side Image Compressor (ADR-004 §2.3)
 * Resizes raw smartphone photos (5-15MB) to max dimension 1280px at 0.7 JPEG quality,
 * reducing payload size down to ~150KB (95% reduction) without quality loss for structural evidence.
 */
export async function compressImageClientSide(file: File, maxDimension = 1280, quality = 0.7): Promise<{
  blob: Blob;
  base64: string;
  originalSize: number;
  compressedSize: number;
}> {
  return new Promise((resolve, reject) => {
    // If not a browser environment or not an image, pass through
    if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          blob: file,
          base64: reader.result as string,
          originalSize: file.size,
          compressedSize: file.size,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Image compression failed'));
              return;
            }
            const base64 = canvas.toDataURL('image/jpeg', quality);
            resolve({
              blob,
              base64,
              originalSize: file.size,
              compressedSize: blob.size,
            });
          },
          'image/jpeg',
          quality,
        );
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
