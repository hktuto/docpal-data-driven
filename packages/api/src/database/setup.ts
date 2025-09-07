// Database setup script for DocPal

import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { setupDatabaseSchema, verifyDatabaseSetup } from './utils/migrations';

// Database configuration from Docker Compose
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'docpal_dev',
  user: process.env.DB_USER || 'docpal_user',
  password: process.env.DB_PASSWORD || 'docpal_password_dev_123',
};

/**
 * Setup database with global schema and tenant schema function
 */
const setupDatabase = async (): Promise<void> => {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔗 Connecting to database...');
    
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    client.release();
    
    // Use the new migration system
    await setupDatabaseSchema(pool);
    
    console.log('🎉 Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};


/**
 * Reset database - Drop all schemas and recreate from scratch
 * WARNING: This will delete ALL data! Only use in development/POC phase.
 */
const resetDatabase = async (): Promise<void> => {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('⚠️  WARNING: This will delete ALL data in the database!');
    console.log('🗑️  Dropping all company schemas and data...');
    
    // Get all company schemas
    const schemaResult = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'company_%'
    `);
    
    // Drop all company schemas
    for (const row of schemaResult.rows) {
      console.log(`   Dropping schema: ${row.schema_name}`);
      await pool.query(`DROP SCHEMA IF EXISTS ${row.schema_name} CASCADE`);
    }
    
    // Drop global tables
    console.log('🗑️  Dropping global tables...');
    await pool.query('DROP TABLE IF EXISTS company_users CASCADE');
    await pool.query('DROP TABLE IF EXISTS company CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    
    // Drop functions
    console.log('🗑️  Dropping functions...');
    await pool.query('DROP FUNCTION IF EXISTS create_tenant_schema(UUID) CASCADE');
    
    console.log('✅ Database reset completed');
    
    // Now setup fresh
    console.log('🔄 Setting up fresh database...');
    await setupDatabaseSchema(pool);
    
    console.log('🎉 Database reset and setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

/**
 * Test database connection
 */
const testConnection = async (): Promise<void> => {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔍 Testing database connection...');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Connection test successful:', result.rows[0].current_time);
    client.release();
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

/**
 * Verify database setup
 */
const verifySetup = async (): Promise<void> => {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔍 Verifying database setup...');
    
    const isSetup = await verifyDatabaseSetup(pool);
    
    if (isSetup) {
      console.log('✅ Database setup verification successful');
    } else {
      console.log('❌ Database setup verification failed - setup required');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Main execution
const main = async (): Promise<void> => {
  const command = process.argv[2];
  
  switch (command) {
    case 'test':
      await testConnection();
      break;
    case 'verify':
      await verifySetup();
      break;
    case 'setup':
      await setupDatabase();
      break;
    case 'reset':
      await resetDatabase();
      break;
    default:
      console.error('❌ Invalid command:', command);
      process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { setupDatabase, testConnection, verifySetup };
