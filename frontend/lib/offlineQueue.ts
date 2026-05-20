/**
 * Offline Mutation Queue
 * 
 * Queues failed POST/PATCH/PUT/DELETE requests in IndexedDB when the user is offline.
 * Automatically replays them when connectivity is restored.
 */
import { get, set, del, keys } from 'idb-keyval';

export interface QueuedMutation {
  id: string;
  endpoint: string;
  method: string;
  body?: string;
  timestamp: number;
}

type LegacyQueuedMutation = QueuedMutation & { token?: string };

const QUEUE_PREFIX = 'eduverse-mutation-queue:';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Enqueue a failed mutation for later replay */
export async function enqueueMutation(mutation: Omit<QueuedMutation, 'id' | 'timestamp'>): Promise<void> {
  const entry: QueuedMutation = {
    ...mutation,
    id: generateId(),
    timestamp: Date.now(),
  };
  await set(`${QUEUE_PREFIX}${entry.id}`, entry);
  console.info(`[OfflineQueue] Queued ${mutation.method} ${mutation.endpoint}`);
}

/** Get all queued mutations sorted by timestamp */
export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  const allKeys = await keys();
  const queueKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(QUEUE_PREFIX));
  
  const entries: QueuedMutation[] = [];
  for (const key of queueKeys) {
    const entry = await get<LegacyQueuedMutation>(key as string);
    if (entry) {
      if ('token' in entry) {
        const sanitizedEntry: QueuedMutation = {
          id: entry.id,
          endpoint: entry.endpoint,
          method: entry.method,
          body: entry.body,
          timestamp: entry.timestamp,
        };
        await set(key as string, sanitizedEntry);
        entries.push(sanitizedEntry);
      } else {
        entries.push(entry);
      }
    }
  }
  
  return entries.sort((a, b) => a.timestamp - b.timestamp);
}

/** Remove a mutation from the queue after successful replay */
export async function dequeueMutation(id: string): Promise<void> {
  await del(`${QUEUE_PREFIX}${id}`);
}

/** Replay all queued mutations. Called when connectivity is restored. */
export async function replayMutations(apiBaseUrl: string): Promise<void> {
  const mutations = await getQueuedMutations();
  if (!mutations.length) return;

  console.info(`[OfflineQueue] Replaying ${mutations.length} queued mutation(s)...`);

  for (const mutation of mutations) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const response = await fetch(`${apiBaseUrl}${mutation.endpoint}`, {
        method: mutation.method,
        credentials: 'include',
        headers,
        body: mutation.body || undefined,
      });

      if (response.ok || response.status === 204) {
        await dequeueMutation(mutation.id);
        console.info(`[OfflineQueue] ✓ Replayed ${mutation.method} ${mutation.endpoint}`);
      } else if (response.status === 401) {
        // Token expired — discard this mutation
        await dequeueMutation(mutation.id);
        console.warn(`[OfflineQueue] ✗ Token expired for ${mutation.endpoint}, discarding`);
      } else {
        console.warn(`[OfflineQueue] ✗ Replay failed (${response.status}) for ${mutation.endpoint}, keeping in queue`);
      }
    } catch (err) {
      // Still offline or network error — stop replaying, will retry later
      console.warn(`[OfflineQueue] Network error during replay, stopping. Will retry later.`);
      break;
    }
  }
}

/** Initialize the online listener to auto-replay queued mutations */
export function initOfflineQueue(apiBaseUrl: string): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    console.info('[OfflineQueue] Connectivity restored, replaying queued mutations...');
    replayMutations(apiBaseUrl).catch(err =>
      console.error('[OfflineQueue] Replay error:', err)
    );
  });

  // Also try replaying on init in case we came online while the page was loading
  if (navigator.onLine) {
    replayMutations(apiBaseUrl).catch(() => {});
  }
}
