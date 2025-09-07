// Database migration utilities for DocPal API

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Check if a column exists in a table
 */
export const columnExists = async (
  pool: Pool,
  schemaName: string,
  tableName: string,
  columnName: string
): Promise<boolean> => {
  const result = await pool.query(
    `SELECT column_name 
     FROM information_schema.columns 
     WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
    [schemaName, tableName, columnName]
  );
  return result.rows.length > 0;
};

/**
 * Check if a table exists in a schema
 */
export const tableExists = async (
  pool: Pool,
  schemaName: string,
  tableName: string
): Promise<boolean> => {
  const result = await pool.query(
    `SELECT table_name 
     FROM information_schema.tables 
     WHERE table_schema = $1 AND table_name = $2`,
    [schemaName, tableName]
  );
  return result.rows.length > 0;
};

/**
 * Run the role migration to move roles from user_profile to company_user
 */
export const runRoleMigration = async (pool: Pool): Promise<void> => {
  console.log('🔄 Running role migration...');
  
  try {
    // Check if role_id column exists in company_user table
    const roleIdExists = await columnExists(pool, 'public', 'company_user', 'role_id');
    
    if (!roleIdExists) {
      console.log('  Adding role_id column to company_user table...');
      await pool.query('ALTER TABLE company_user ADD COLUMN role_id UUID');
    }
    
    // Run the migration script
    const migrationSQL = readFileSync(
      join(__dirname, '../migrations/001_move_role_to_company_user.sql'),
      'utf-8'
    );
    
    await pool.query(migrationSQL);
    console.log('✅ Role migration completed successfully');
    
  } catch (error) {
    console.error('❌ Role migration failed:', error);
    throw error;
  }
};

/**
 * Run all pending migrations
 */
export const runMigrations = async (pool: Pool): Promise<void> => {
  console.log('🔄 Running database migrations...');
  
  try {
    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Check if role migration has been run
    const result = await pool.query(
      'SELECT name FROM migrations WHERE name = $1',
      ['001_move_role_to_company_user']
    );
    
    if (result.rows.length === 0) {
      await runRoleMigration(pool);
      
      // Mark migration as completed
      await pool.query(
        'INSERT INTO migrations (name) VALUES ($1)',
        ['001_move_role_to_company_user']
      );
    } else {
      console.log('✅ Role migration already completed');
    }
    
    console.log('✅ All migrations completed');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

/**
 * Setup database schema and run migrations
 */
export const setupDatabaseSchema = async (pool: Pool): Promise<void> => {
  console.log('🔄 Setting up database schema...');
  
  try {
    // Check if UUID extension exists
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    
    // Read and execute global schema setup
    const globalSchemaSQL = readFileSync(
      join(__dirname, '../setup.sql'),
      'utf-8'
    );
    await pool.query(globalSchemaSQL);
    console.log('✅ Global schema setup completed');
    
    // Read and execute tenant schema function
    const tenantSchemaSQL = readFileSync(
      join(__dirname, '../tenant-schema.sql'),
      'utf-8'
    );
    await pool.query(tenantSchemaSQL);
    console.log('✅ Tenant schema function setup completed');
    
    // Run migrations
    await runMigrations(pool);
    
    console.log('✅ Database schema setup completed successfully');
    
  } catch (error) {
    console.error('❌ Database schema setup failed:', error);
    throw error;
  }
};

/**
 * Verify database setup
 */
export const verifyDatabaseSetup = async (pool: Pool): Promise<boolean> => {
  try {
    // Check if essential tables exist
    const companyTableExists = await tableExists(pool, 'public', 'company');
    const userTableExists = await tableExists(pool, 'public', 'user');
    const companyUserTableExists = await tableExists(pool, 'public', 'company_user');
    
    if (!companyTableExists || !userTableExists || !companyUserTableExists) {
      return false;
    }
    
    // Check if role_id column exists in company_user
    const roleIdExists = await columnExists(pool, 'public', 'company_user', 'role_id');
    if (!roleIdExists) {
      return false;
    }
    
    // Check if tenant schema function exists
    const functionResult = await pool.query(
      `SELECT routine_name 
       FROM information_schema.routines 
       WHERE routine_schema = 'public' AND routine_name = 'create_tenant_schema'`
    );
    
    return functionResult.rows.length > 0;
    
  } catch (error) {
    console.error('❌ Database verification failed:', error);
    return false;
  }
};
