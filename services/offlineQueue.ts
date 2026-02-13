/**
 * Offline Queue Manager
 * Queues Supabase operations when offline and retries them when connection is restored
 */

interface QueuedOperation {
  id: string;
  timestamp: number;
  operation: 'save' | 'delete';
  collection: 'customers' | 'estimates' | 'inventory' | 'settings';
  data: any;
  retry_count: number;
}

const QUEUE_KEY = 'sf_pro_offline_queue';
const MAX_RETRIES = 3;

/**
 * Add an operation to the offline queue
 */
export const queueOperation = (
  operation: QueuedOperation['operation'],
  collection: QueuedOperation['collection'],
  data: any
): void => {
  try {
    const queue = getQueue();
    const newOp: QueuedOperation = {
      id: `${collection}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      operation,
      collection,
      data,
      retry_count: 0,
    };
    queue.push(newOp);
    saveQueue(queue);
    console.log('[OfflineQueue] Operation queued:', newOp.id);
  } catch (err) {
    console.error('[OfflineQueue] Failed to queue operation:', err);
  }
};

/**
 * Get all queued operations
 */
export const getQueue = (): QueuedOperation[] => {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.error('[OfflineQueue] Failed to read queue:', err);
    return [];
  }
};

/**
 * Save queue to localStorage
 */
const saveQueue = (queue: QueuedOperation[]): void => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[OfflineQueue] Failed to save queue:', err);
  }
};

/**
 * Remove an operation from the queue
 */
export const removeFromQueue = (operationId: string): void => {
  try {
    const queue = getQueue();
    const filtered = queue.filter(op => op.id !== operationId);
    saveQueue(filtered);
    console.log('[OfflineQueue] Operation removed:', operationId);
  } catch (err) {
    console.error('[OfflineQueue] Failed to remove operation:', err);
  }
};

/**
 * Clear the entire queue
 */
export const clearQueue = (): void => {
  try {
    localStorage.removeItem(QUEUE_KEY);
    console.log('[OfflineQueue] Queue cleared');
  } catch (err) {
    console.error('[OfflineQueue] Failed to clear queue:', err);
  }
};

/**
 * Process the queue - attempt to sync all queued operations
 * Returns the number of successfully synced operations
 */
export const processQueue = async (
  syncFunctions: {
    saveCustomer?: (data: any) => Promise<any>;
    saveEstimate?: (data: any) => Promise<any>;
    saveInventory?: (data: any[]) => Promise<any>;
    saveSettings?: (data: any) => Promise<any>;
    deleteCustomer?: (id: string) => Promise<void>;
    deleteEstimate?: (id: string) => Promise<void>;
  }
): Promise<{ success: number; failed: number }> => {
  const queue = getQueue();
  
  if (queue.length === 0) {
    return { success: 0, failed: 0 };
  }

  console.log(`[OfflineQueue] Processing ${queue.length} queued operations...`);
  
  let successCount = 0;
  let failedCount = 0;
  const updatedQueue: QueuedOperation[] = [];

  for (const op of queue) {
    try {
      // Select the appropriate sync function
      let syncFn: ((data: any) => Promise<any>) | undefined;
      
      if (op.operation === 'save') {
        switch (op.collection) {
          case 'customers':
            syncFn = syncFunctions.saveCustomer;
            break;
          case 'estimates':
            syncFn = syncFunctions.saveEstimate;
            break;
          case 'inventory':
            syncFn = syncFunctions.saveInventory;
            break;
          case 'settings':
            syncFn = syncFunctions.saveSettings;
            break;
        }
      } else if (op.operation === 'delete') {
        switch (op.collection) {
          case 'customers':
            syncFn = syncFunctions.deleteCustomer;
            break;
          case 'estimates':
            syncFn = syncFunctions.deleteEstimate;
            break;
        }
      }

      if (!syncFn) {
        console.warn(`[OfflineQueue] No sync function for ${op.collection} ${op.operation}`);
        failedCount++;
        continue;
      }

      // Attempt to sync
      await syncFn(op.data);
      console.log(`[OfflineQueue] Successfully synced: ${op.id}`);
      successCount++;
      
    } catch (err) {
      console.error(`[OfflineQueue] Failed to sync ${op.id}:`, err);
      
      // Increment retry count
      op.retry_count++;
      
      // If not exceeded max retries, keep in queue
      if (op.retry_count < MAX_RETRIES) {
        updatedQueue.push(op);
      } else {
        console.warn(`[OfflineQueue] Max retries exceeded for ${op.id}, discarding`);
      }
      
      failedCount++;
    }
  }

  // Save updated queue
  saveQueue(updatedQueue);
  
  console.log(`[OfflineQueue] Processing complete: ${successCount} success, ${failedCount} failed`);
  return { success: successCount, failed: failedCount };
};

/**
 * Get queue status
 */
export const getQueueStatus = (): { count: number; oldestTimestamp: number | null } => {
  const queue = getQueue();
  return {
    count: queue.length,
    oldestTimestamp: queue.length > 0 ? Math.min(...queue.map(op => op.timestamp)) : null,
  };
};
