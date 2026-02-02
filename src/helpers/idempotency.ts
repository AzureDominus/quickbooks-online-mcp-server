/**
 * Idempotency Service for QuickBooks MCP Server
 *
 * Prevents duplicate transactions by tracking idempotency keys.
 * Uses file-based storage for single-user mode.
 *
 * Features:
 * - Key-based duplicate detection
 * - Configurable TTL (time-to-live)
 * - Automatic cleanup of expired entries
 * - Thread-safe file operations
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from './logger.js';
import { loadQuickbooksConfig } from './config.js';

interface IdempotencyEntry {
  /** The entity ID that was created */
  entityId: string;
  /** Entity type (e.g., 'Purchase', 'Invoice') */
  entityType: string;
  /** Timestamp when the entry was created */
  createdAt: number;
  /** Timestamp when the entry expires */
  expiresAt: number;
}

interface IdempotencyStore {
  entries: Record<string, IdempotencyEntry>;
  lastCleanup: number;
}

/**
 * Idempotency service configuration
 */
interface IdempotencyConfig {
  /** Storage file path */
  storagePath: string;
  /** TTL for entries in milliseconds (default: 24 hours) */
  ttlMs: number;
  /** Cleanup interval in milliseconds (default: 1 hour) */
  cleanupIntervalMs: number;
}

function getDefaultConfig(): IdempotencyConfig {
  const resolvedConfig = loadQuickbooksConfig();
  return {
    storagePath:
      process.env.IDEMPOTENCY_STORAGE_PATH ||
      resolvedConfig.idempotencyStoragePath ||
      path.join(os.homedir(), '.config', 'quickbooks-mcp', 'idempotency.json'),
    ttlMs: parseInt(process.env.IDEMPOTENCY_TTL_MS || String(24 * 60 * 60 * 1000), 10), // 24 hours
    cleanupIntervalMs: parseInt(process.env.IDEMPOTENCY_CLEANUP_MS || String(60 * 60 * 1000), 10), // 1 hour
  };
}

/**
 * Load the idempotency store from disk
 */
function loadStore(config: IdempotencyConfig): IdempotencyStore {
  try {
    if (fs.existsSync(config.storagePath)) {
      const data = fs.readFileSync(config.storagePath, 'utf-8');
      return JSON.parse(data) as IdempotencyStore;
    }
  } catch (error) {
    logger.warn('Failed to load idempotency store, starting fresh', {
      path: config.storagePath,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    entries: {},
    lastCleanup: Date.now(),
  };
}

/**
 * Save the idempotency store to disk
 */
function saveStore(store: IdempotencyStore, config: IdempotencyConfig): void {
  try {
    const dir = path.dirname(config.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(config.storagePath, JSON.stringify(store, null, 2));
  } catch (error) {
    logger.error('Failed to save idempotency store', error, {
      path: config.storagePath,
    });
  }
}

/**
 * Clean up expired entries
 */
function cleanupExpired(store: IdempotencyStore, config: IdempotencyConfig): boolean {
  const now = Date.now();

  // Check if cleanup is needed
  if (now - store.lastCleanup < config.cleanupIntervalMs) {
    return false;
  }

  const before = Object.keys(store.entries).length;

  for (const [key, entry] of Object.entries(store.entries)) {
    if (entry.expiresAt < now) {
      delete store.entries[key];
    }
  }

  store.lastCleanup = now;

  const removed = before - Object.keys(store.entries).length;
  if (removed > 0) {
    logger.debug('Cleaned up expired idempotency entries', {
      removed,
      remaining: Object.keys(store.entries).length,
    });
  }

  return removed > 0;
}

/**
 * Idempotency Service
 *
 * Usage:
 * ```typescript
 * const idempotency = new IdempotencyService();
 *
 * // Check for existing entry
 * const existing = idempotency.check('my-unique-key');
 * if (existing) {
 *   return { id: existing.entityId, wasIdempotent: true };
 * }
 *
 * // Create the entity...
 * const result = await createPurchase(...);
 *
 * // Store the result
 * idempotency.set('my-unique-key', result.Id, 'Purchase');
 * ```
 */
export class IdempotencyService {
  private config: IdempotencyConfig;
  private _store: IdempotencyStore;

  constructor(config?: Partial<IdempotencyConfig>) {
    this.config = { ...getDefaultConfig(), ...config };
    this._store = loadStore(this.config);

    // Run cleanup on startup
    if (cleanupExpired(this._store, this.config)) {
      saveStore(this._store, this.config);
    }

    logger.debug('Idempotency service initialized', {
      storagePath: this.config.storagePath,
      ttlHours: Math.round(this.config.ttlMs / (60 * 60 * 1000)),
      entries: Object.keys(this._store.entries).length,
    });
  }

  /**
   * Check if an idempotency key exists
   *
   * @param key The idempotency key to check
   * @returns The existing entry if found, or null if not found
   */
  check(key: string): IdempotencyEntry | null {
    // Run cleanup if needed
    if (cleanupExpired(this._store, this.config)) {
      saveStore(this._store, this.config);
    }

    const entry = this._store.entries[key];

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      delete this._store.entries[key];
      saveStore(this._store, this.config);
      return null;
    }

    logger.info('Idempotency key found - returning cached result', {
      key: this.maskKey(key),
      entityId: entry.entityId,
      entityType: entry.entityType,
    });

    return entry;
  }

  /**
   * Store an idempotency entry
   *
   * @param key The idempotency key
   * @param entityId The ID of the created entity
   * @param entityType The type of entity (e.g., 'Purchase')
   */
  set(key: string, entityId: string, entityType: string): void {
    const now = Date.now();

    this._store.entries[key] = {
      entityId,
      entityType,
      createdAt: now,
      expiresAt: now + this.config.ttlMs,
    };

    saveStore(this._store, this.config);

    logger.debug('Stored idempotency entry', {
      key: this.maskKey(key),
      entityId,
      entityType,
    });
  }

  /**
   * Remove an idempotency entry (e.g., if creation fails)
   *
   * @param key The idempotency key to remove
   */
  remove(key: string): void {
    if (this._store.entries[key]) {
      delete this._store.entries[key];
      saveStore(this._store, this.config);

      logger.debug('Removed idempotency entry', {
        key: this.maskKey(key),
      });
    }
  }

  /**
   * Generate an idempotency key from transaction data
   *
   * Creates a deterministic key based on the transaction details,
   * so the same input will always generate the same key.
   *
   * @param data Transaction data to hash
   * @returns A deterministic idempotency key
   */
  static generateKey(data: {
    txnDate: string;
    paymentType: string;
    paymentAccountId: string;
    totalAmount: number;
    vendorId?: string;
    memo?: string;
  }): string {
    const parts = [
      data.txnDate,
      data.paymentType,
      data.paymentAccountId,
      data.totalAmount.toFixed(2),
      data.vendorId || '',
      data.memo || '',
    ];

    // Simple hash function
    const str = parts.join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return `auto_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Mask key for logging (hide most of the key for privacy)
   */
  private maskKey(key: string): string {
    if (key.length <= 8) {
      return key.substring(0, 2) + '***';
    }
    return key.substring(0, 4) + '***' + key.substring(key.length - 4);
  }

  /**
   * Get statistics about the store
   */
  getStats(): { totalEntries: number; oldestEntry: Date | null; newestEntry: Date | null } {
    const entries = Object.values(this._store.entries);

    if (entries.length === 0) {
      return { totalEntries: 0, oldestEntry: null, newestEntry: null };
    }

    const timestamps = entries.map((e) => e.createdAt);

    return {
      totalEntries: entries.length,
      oldestEntry: new Date(Math.min(...timestamps)),
      newestEntry: new Date(Math.max(...timestamps)),
    };
  }

  /**
   * Clear all entries (useful for testing)
   */
  clear(): void {
    this._store.entries = {};
    this._store.lastCleanup = Date.now();
    saveStore(this._store, this.config);

    logger.info('Cleared all idempotency entries');
  }
}

// Singleton instance
let instance: IdempotencyService | null = null;

/**
 * Get the shared idempotency service instance
 */
export function getIdempotencyService(): IdempotencyService {
  if (!instance) {
    instance = new IdempotencyService();
  }
  return instance;
}

/**
 * Check idempotency for a transaction
 *
 * Convenience function that checks if a key exists and returns the entity ID if found.
 *
 * @param key Idempotency key (optional - if not provided, returns null)
 * @returns Entity ID if key was found, null otherwise
 */
export function checkIdempotency(key?: string): string | null {
  if (!key) return null;

  const service = getIdempotencyService();
  const entry = service.check(key);

  return entry?.entityId ?? null;
}

/**
 * Store idempotency result
 *
 * @param key Idempotency key (optional - if not provided, does nothing)
 * @param entityId Entity ID that was created
 * @param entityType Type of entity
 */
export function storeIdempotency(
  key: string | undefined,
  entityId: string,
  entityType: string
): void {
  if (!key) return;

  const service = getIdempotencyService();
  service.set(key, entityId, entityType);
}

export default IdempotencyService;
