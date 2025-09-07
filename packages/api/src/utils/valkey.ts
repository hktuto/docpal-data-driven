// Valkey (Redis-compatible) utility functions for DocPal API

import Redis from 'ioredis';

// Valkey configuration interface
interface ValkeyConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

// Global Valkey client
let valkeyClient: Redis | null = null;

/**
 * Initialize Valkey client
 */
export const initializeValkey = (config: ValkeyConfig): Redis => {
  valkeyClient = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db || 0,
    keyPrefix: config.keyPrefix || 'docpal:',
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
  });

  // Handle connection events
  valkeyClient.on('connect', () => {
    console.log('✅ Valkey connected');
  });

  valkeyClient.on('error', (err) => {
    console.error('❌ Valkey connection error:', err);
  });

  return valkeyClient;
};

/**
 * Get Valkey client instance
 */
export const getValkeyClient = (): Redis => {
  if (!valkeyClient) {
    throw new Error('Valkey client not initialized. Call initializeValkey first.');
  }
  return valkeyClient;
};

/**
 * Session management functions
 */

/**
 * Store session data
 */
export const setSession = async (
  sessionId: string,
  sessionData: Record<string, any>,
  ttl: number = 3600 // 1 hour default
): Promise<void> => {
  const client = getValkeyClient();
  const key = `session:${sessionId}`;
  
  await client.setex(key, ttl, JSON.stringify(sessionData));
};

/**
 * Get session data
 */
export const getSession = async (
  sessionId: string
): Promise<Record<string, any> | null> => {
  const client = getValkeyClient();
  const key = `session:${sessionId}`;
  
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
};

/**
 * Delete session
 */
export const deleteSession = async (sessionId: string): Promise<void> => {
  const client = getValkeyClient();
  const key = `session:${sessionId}`;
  
  await client.del(key);
};

/**
 * Extend session TTL
 */
export const extendSession = async (
  sessionId: string,
  ttl: number = 3600
): Promise<boolean> => {
  const client = getValkeyClient();
  const key = `session:${sessionId}`;
  
  const result = await client.expire(key, ttl);
  return result === 1;
};

/**
 * Cache management functions
 */

/**
 * Set cache value
 */
export const setCache = async (
  key: string,
  value: any,
  ttl?: number
): Promise<void> => {
  const client = getValkeyClient();
  const cacheKey = `cache:${key}`;
  const serializedValue = JSON.stringify(value);
  
  if (ttl) {
    await client.setex(cacheKey, ttl, serializedValue);
  } else {
    await client.set(cacheKey, serializedValue);
  }
};

/**
 * Get cache value
 */
export const getCache = async <T = any>(key: string): Promise<T | null> => {
  const client = getValkeyClient();
  const cacheKey = `cache:${key}`;
  
  const data = await client.get(cacheKey);
  return data ? JSON.parse(data) : null;
};

/**
 * Delete cache value
 */
export const deleteCache = async (key: string): Promise<void> => {
  const client = getValkeyClient();
  const cacheKey = `cache:${key}`;
  
  await client.del(cacheKey);
};

/**
 * Check if cache key exists
 */
export const cacheExists = async (key: string): Promise<boolean> => {
  const client = getValkeyClient();
  const cacheKey = `cache:${key}`;
  
  const result = await client.exists(cacheKey);
  return result === 1;
};

/**
 * Company-specific cache functions
 */

/**
 * Set company-specific cache
 */
export const setCompanyCache = async (
  companyId: string,
  key: string,
  value: any,
  ttl?: number
): Promise<void> => {
  const companyKey = `company:${companyId}:${key}`;
  await setCache(companyKey, value, ttl);
};

/**
 * Get company-specific cache
 */
export const getCompanyCache = async <T = any>(
  companyId: string,
  key: string
): Promise<T | null> => {
  const companyKey = `company:${companyId}:${key}`;
  return await getCache<T>(companyKey);
};

/**
 * Delete company-specific cache
 */
export const deleteCompanyCache = async (
  companyId: string,
  key: string
): Promise<void> => {
  const companyKey = `company:${companyId}:${key}`;
  await deleteCache(companyKey);
};

/**
 * Clear all cache for a company
 */
export const clearCompanyCache = async (companyId: string): Promise<void> => {
  const client = getValkeyClient();
  const pattern = `${client.options.keyPrefix}cache:company:${companyId}:*`;
  
  const keys = await client.keys(pattern);
  if (keys.length > 0) {
    // Remove prefix from keys before deletion
    const keysWithoutPrefix = keys.map(key => 
      key.replace(client.options.keyPrefix || '', '')
    );
    await client.del(...keysWithoutPrefix);
  }
};

/**
 * Test Valkey connection
 */
export const testValkeyConnection = async (): Promise<boolean> => {
  try {
    const client = getValkeyClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Valkey connection test failed:', error);
    return false;
  }
};

/**
 * Close Valkey connection (for graceful shutdown)
 */
export const closeValkey = async (): Promise<void> => {
  if (valkeyClient) {
    await valkeyClient.quit();
    valkeyClient = null;
  }
};
