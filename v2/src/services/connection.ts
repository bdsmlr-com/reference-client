/**
 * Connection State Service
 *
 * Detects and tracks online/offline state using navigator.onLine and
 * online/offline events. Provides reactive state management for components.
 */

// Connection state type
export type ConnectionState = 'online' | 'offline';

// Listener callback type
type ConnectionListener = (state: ConnectionState) => void;

// Singleton state
let currentState: ConnectionState = 'online';
const listeners = new Set<ConnectionListener>();
let isInitialized = false;

/**
 * Get the current connection state
 */
export function getConnectionState(): ConnectionState {
  // Initialize on first access if not already done
  if (!isInitialized) {
    initConnectionState();
  }
  return currentState;
}

/**
 * Check if the browser is currently online
 */
export function isOnline(): boolean {
  return getConnectionState() === 'online';
}

/**
 * Check if the browser is currently offline
 */
export function isOffline(): boolean {
  return getConnectionState() === 'offline';
}

/**
 * Subscribe to connection state changes
 * @param listener Callback function called when state changes
 * @returns Unsubscribe function
 */
export function subscribeToConnectionState(listener: ConnectionListener): () => void {
  // Initialize if needed
  if (!isInitialized) {
    initConnectionState();
  }

  listeners.add(listener);

  // Immediately notify of current state
  listener(currentState);

  // Return unsubscribe function
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Notify all listeners of state change
 */
function notifyListeners(state: ConnectionState): void {
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (error) {
      console.error('Error in connection state listener:', error);
    }
  }
}

/**
 * Handle online event
 */
function handleOnline(): void {
  if (currentState !== 'online') {
    currentState = 'online';
    console.log('[Connection] Browser is now online');
    notifyListeners(currentState);
  }
}

/**
 * Handle offline event
 */
function handleOffline(): void {
  if (currentState !== 'offline') {
    currentState = 'offline';
    console.log('[Connection] Browser is now offline');
    notifyListeners(currentState);
  }
}

/**
 * Initialize connection state tracking
 * Sets up event listeners and initial state
 */
export function initConnectionState(): void {
  if (isInitialized) {
    return;
  }

  // Set initial state from navigator.onLine
  currentState = navigator.onLine ? 'online' : 'offline';
  console.log(`[Connection] Initial state: ${currentState}`);

  // Add event listeners for state changes
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  isInitialized = true;
}

/**
 * Cleanup connection state tracking
 * Call this when the app is being destroyed (rarely needed)
 */
export function cleanupConnectionState(): void {
  if (!isInitialized) {
    return;
  }

  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  listeners.clear();
  isInitialized = false;
}

/**
 * Create a promise that resolves when the connection is restored
 * Useful for waiting until online before retrying an operation
 * @param timeoutMs Optional timeout in milliseconds (default: no timeout)
 * @returns Promise that resolves when online, or rejects on timeout
 */
export function waitForOnline(timeoutMs?: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // If already online, resolve immediately
    if (isOnline()) {
      resolve();
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Set up timeout if specified
    if (timeoutMs !== undefined && timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        if (unsubscribe) {
          unsubscribe();
        }
        reject(new Error('Timeout waiting for connection'));
      }, timeoutMs);
    }

    // Subscribe to state changes
    unsubscribe = subscribeToConnectionState((state) => {
      if (state === 'online') {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (unsubscribe) {
          unsubscribe();
        }
        resolve();
      }
    });
  });
}

// ============================================
// Connection Recovery Queue (CONN-003, CONN-004)
// ============================================
// Queues failed requests for automatic retry when connection is restored.

/**
 * A queued request that failed due to connection issues
 */
export interface QueuedRequest<T = unknown> {
  /** Unique ID for this request */
  id: string;
  /** Function that performs the actual request */
  execute: () => Promise<T>;
  /** Called when request succeeds after retry */
  onSuccess?: (result: T) => void;
  /** Called when request fails again after retry */
  onFailure?: (error: Error) => void;
  /** Description for debugging/logging */
  description?: string;
  /** Timestamp when request was queued */
  queuedAt: number;
  /** Number of retry attempts (starts at 0) */
  retryCount: number;
}

// Queue storage
const retryQueue: QueuedRequest[] = [];
const MAX_QUEUE_SIZE = 50;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// Unique ID generator
let requestIdCounter = 0;
function generateRequestId(): string {
  return `req-${Date.now()}-${++requestIdCounter}`;
}

// Recovery processing state
let isProcessingQueue = false;
let recoveryListenerRegistered = false;

/**
 * Add a failed request to the retry queue.
 * When the connection is restored, this request will be automatically retried.
 *
 * @param request - The queued request configuration
 * @returns The request ID (can be used to remove from queue)
 */
export function queueForRetry<T>(request: {
  execute: () => Promise<T>;
  onSuccess?: (result: T) => void;
  onFailure?: (error: Error) => void;
  description?: string;
}): string {
  // Initialize recovery listener if not already registered
  ensureRecoveryListenerRegistered();

  // Generate unique ID
  const id = generateRequestId();

  // Add to queue (with size limit)
  if (retryQueue.length >= MAX_QUEUE_SIZE) {
    // Remove oldest request to make room
    const removed = retryQueue.shift();
    if (removed) {
      console.log(`[RetryQueue] Evicted oldest request: ${removed.description || removed.id}`);
      removed.onFailure?.(new Error('Request evicted from retry queue due to size limit'));
    }
  }

  const queuedRequest: QueuedRequest = {
    id,
    execute: request.execute,
    onSuccess: request.onSuccess as ((result: unknown) => void) | undefined,
    onFailure: request.onFailure,
    description: request.description,
    queuedAt: Date.now(),
    retryCount: 0,
  };

  retryQueue.push(queuedRequest);
  console.log(`[RetryQueue] Queued request: ${request.description || id} (queue size: ${retryQueue.length})`);

  return id;
}

/**
 * Remove a request from the retry queue.
 * Use this if the request is no longer needed (e.g., user navigated away).
 *
 * @param requestId - The request ID returned from queueForRetry
 * @returns True if the request was found and removed
 */
export function removeFromQueue(requestId: string): boolean {
  const index = retryQueue.findIndex((r) => r.id === requestId);
  if (index !== -1) {
    const removed = retryQueue.splice(index, 1)[0];
    console.log(`[RetryQueue] Removed request: ${removed.description || requestId}`);
    return true;
  }
  return false;
}

/**
 * Clear all requests from the retry queue.
 * Call this when the user logs out or navigates away from the app.
 */
export function clearRetryQueue(): void {
  const count = retryQueue.length;
  retryQueue.length = 0;
  if (count > 0) {
    console.log(`[RetryQueue] Cleared ${count} pending requests`);
  }
}

/**
 * Get the current size of the retry queue.
 */
export function getRetryQueueSize(): number {
  return retryQueue.length;
}

/**
 * Get a snapshot of the current retry queue (for debugging).
 */
export function getRetryQueueSnapshot(): Array<{
  id: string;
  description?: string;
  queuedAt: number;
  retryCount: number;
}> {
  return retryQueue.map((r) => ({
    id: r.id,
    description: r.description,
    queuedAt: r.queuedAt,
    retryCount: r.retryCount,
  }));
}

/**
 * Process the retry queue - attempts to execute all queued requests.
 * Called automatically when connection is restored.
 */
async function processRetryQueue(): Promise<void> {
  if (isProcessingQueue) {
    console.log('[RetryQueue] Already processing queue, skipping');
    return;
  }

  if (retryQueue.length === 0) {
    console.log('[RetryQueue] Queue is empty, nothing to process');
    return;
  }

  if (!isOnline()) {
    console.log('[RetryQueue] Still offline, deferring queue processing');
    return;
  }

  isProcessingQueue = true;
  console.log(`[RetryQueue] Processing ${retryQueue.length} queued requests...`);

  // Process queue in order (FIFO)
  const requestsToProcess = [...retryQueue];
  retryQueue.length = 0; // Clear queue, we'll re-add failures

  for (const request of requestsToProcess) {
    // Check if we're still online before each request
    if (!isOnline()) {
      console.log('[RetryQueue] Connection lost during processing, re-queuing remaining requests');
      retryQueue.push(request);
      continue;
    }

    try {
      console.log(`[RetryQueue] Retrying: ${request.description || request.id} (attempt ${request.retryCount + 1})`);
      const result = await request.execute();
      console.log(`[RetryQueue] Success: ${request.description || request.id}`);
      request.onSuccess?.(result);
    } catch (error) {
      request.retryCount++;

      if (request.retryCount < MAX_RETRY_ATTEMPTS) {
        // Re-queue for another attempt
        retryQueue.push(request);
        console.log(
          `[RetryQueue] Failed: ${request.description || request.id}, will retry (${request.retryCount}/${MAX_RETRY_ATTEMPTS})`
        );
      } else {
        // Max retries exceeded, notify failure
        console.log(`[RetryQueue] Giving up: ${request.description || request.id} after ${MAX_RETRY_ATTEMPTS} attempts`);
        request.onFailure?.(error instanceof Error ? error : new Error(String(error)));
      }
    }

    // Small delay between retries to avoid overwhelming the server
    if (requestsToProcess.indexOf(request) < requestsToProcess.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  isProcessingQueue = false;
  console.log(`[RetryQueue] Processing complete, ${retryQueue.length} requests remaining in queue`);
}

/**
 * Ensure the connection recovery listener is registered.
 * This listener automatically triggers queue processing when connection is restored.
 */
function ensureRecoveryListenerRegistered(): void {
  if (recoveryListenerRegistered) {
    return;
  }

  // Subscribe to connection state changes
  subscribeToConnectionState((state) => {
    if (state === 'online') {
      console.log('[RetryQueue] Connection restored, processing retry queue...');
      // Small delay to let the network stabilize
      setTimeout(() => {
        processRetryQueue();
      }, 500);
    }
  });

  recoveryListenerRegistered = true;
  console.log('[RetryQueue] Recovery listener registered');
}

/**
 * Dispatch a custom event when connection recovery completes.
 * Components can listen for this to update their UI.
 */
export function dispatchRecoveryEvent(success: boolean, retriedCount: number, failedCount: number): void {
  const event = new CustomEvent('connection-recovery', {
    detail: {
      success,
      retriedCount,
      failedCount,
      timestamp: Date.now(),
    },
  });
  window.dispatchEvent(event);
}

/**
 * Type guard for recovery event detail
 */
export interface ConnectionRecoveryDetail {
  success: boolean;
  retriedCount: number;
  failedCount: number;
  timestamp: number;
}

export function isConnectionRecoveryEvent(
  event: Event
): event is CustomEvent<ConnectionRecoveryDetail> {
  return event.type === 'connection-recovery' && 'detail' in event;
}
