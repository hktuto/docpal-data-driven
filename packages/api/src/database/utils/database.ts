// Database utility functions for DocPal API

import { Pool, PoolClient } from 'pg';
import { setupDatabaseSchema, verifyDatabaseSetup } from './migrations';

// Database configuration interface
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number; // max connections in pool
}

// Global database pool
let pool: Pool | null = null;

/**
 * Initialize database connection pool
 */
export const initializeDatabase = (config: DatabaseConfig): Pool => {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl,
    max: config.max || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  return pool;
};

/**
 * Initialize database with automatic setup and migrations
 */
export const initializeDatabaseWithSetup = async (config: DatabaseConfig): Promise<Pool> => {
  if (pool) {
    return pool;
  }

  // Initialize the pool first
  const dbPool = initializeDatabase(config);

  try {
    console.log('🔍 Verifying database setup...');
    
    // Check if database is properly set up
    const isSetup = await verifyDatabaseSetup(dbPool);
    
    if (!isSetup) {
      console.log('🔧 Database setup required, running setup and migrations...');
      await setupDatabaseSchema(dbPool);
    } else {
      console.log('✅ Database setup verified');
    }
    
    return dbPool;
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

/**
 * Get database pool instance
 */
export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase first.');
  }
  return pool;
};

/**
 * Execute a query with automatic connection handling
 */
export const query = async (text: string, params?: any[]): Promise<any> => {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

/**
 * Execute multiple queries in a transaction
 */
export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getPool().connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Generate tenant schema name from company ID
 */
export const getTenantSchemaName = (companyId: string): string => {
  return `company_${companyId.replace(/-/g, '_')}`;
};

/**
 * Create a new tenant schema with default tables
 */
export const createTenantSchema = async (companyId: string): Promise<void> => {
  await query('SELECT create_tenant_schema($1)', [companyId]);
};

/**
 * Check if tenant schema exists
 */
export const tenantSchemaExists = async (companyId: string): Promise<boolean> => {
  const schemaName = getTenantSchemaName(companyId);
  const result = await query(
    'SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1',
    [schemaName]
  );
  return result.rows.length > 0;
};

/**
 * Execute query in tenant schema context
 * Note: For audit context, use queryInTenantSchemaWithAudit or set context manually
 */
export const queryInTenantSchema = async (
  companyId: string,
  text: string,
  params?: any[]
): Promise<any> => {
  const schemaName = getTenantSchemaName(companyId);
  const client = await getPool().connect();
  
  try {
    // Set search path to tenant schema
    await client.query(`SET search_path TO "${schemaName}", public`);
    const result = await client.query(text, params);
    return result;
  } finally {
    // Reset search path
    await client.query('SET search_path TO public');
    client.release();
  }
};

/**
 * Execute transaction in tenant schema context
 * Note: For audit context, use withTenantTransactionAndAudit or set context manually
 */
export const withTenantTransaction = async <T>(
  companyId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const schemaName = getTenantSchemaName(companyId);
  const client = await getPool().connect();
  
  try {
    await client.query('BEGIN');
    await client.query(`SET search_path TO "${schemaName}", public`);
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.query('SET search_path TO public');
    client.release();
  }
};

/**
 * Set audit context for database operations
 * This sets session variables that will be used by audit triggers
 * 
 * Usage in services:
 * ```typescript
 * const result = await withTenantTransaction(companyId, async (client) => {
 *   // Set audit context from request (set by auth middleware)
 *   if (request.setAuditContext) {
 *     await request.setAuditContext(client);
 *   }
 *   
 *   // Now all database operations will be audited with user context
 *   await client.query('INSERT INTO ...');
 *   return result;
 * });
 * ```
 */
export const setUserAuditContext = async (
  client: PoolClient,
  context: {
    userId?: string;
    userEmail?: string;
    sessionId?: string;
    operationSource?: 'user' | 'system' | 'public' | 'workflow';
    systemContext?: any;
  }
): Promise<void> => {
  const queries: string[] = [];
  
  if (context.userId) {
    queries.push(`SET app.current_user_id = '${context.userId}'`);
  }
  
  if (context.userEmail) {
    queries.push(`SET app.current_user_email = '${context.userEmail}'`);
  }
  
  if (context.sessionId) {
    queries.push(`SET app.current_session_id = '${context.sessionId}'`);
  }
  
  if (context.operationSource) {
    queries.push(`SET app.operation_source = '${context.operationSource}'`);
  }
  
  if (context.systemContext) {
    queries.push(`SET app.system_context = '${JSON.stringify(context.systemContext)}'`);
  }
  
  // Execute all context setting queries
  for (const query of queries) {
    await client.query(query);
  }
};


/**
 * Close database pool (for graceful shutdown)
 */
export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};
