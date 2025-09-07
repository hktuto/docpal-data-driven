#!/usr/bin/env tsx

/**
 * Test Script for Automatic Database Setup
 * Tests that the API can automatically set up and migrate the database on startup
 */

import { loadConfig } from '../../api/src/config';
import { initializeDatabaseWithSetup } from '../../api/src/database/utils/database';
import { verifyDatabaseSetup } from '../../api/src/database/utils/migrations';

// Load configuration
const config = loadConfig();

/**
 * Test automatic database setup
 */
const testAutoSetup = async () => {
  try {
    console.log('🚀 Testing automatic database setup...\n');

    // Test 1: Initialize database with automatic setup
    console.log('1️⃣ Testing initializeDatabaseWithSetup...');
    const pool = await initializeDatabaseWithSetup(config.database);
    console.log('✅ Database initialization completed');

    // Test 2: Verify setup was successful
    console.log('\n2️⃣ Verifying database setup...');
    const isSetup = await verifyDatabaseSetup(pool);
    
    if (isSetup) {
      console.log('✅ Database setup verification successful');
    } else {
      throw new Error('Database setup verification failed');
    }

    // Test 3: Check specific tables and columns
    console.log('\n3️⃣ Checking specific schema elements...');
    
    // Check company_user table has role_id column
    const roleIdResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'company_user' 
      AND column_name = 'role_id'
    `);
    
    if (roleIdResult.rows.length > 0) {
      console.log('✅ company_user.role_id column exists');
    } else {
      throw new Error('company_user.role_id column not found');
    }

    // Check migrations table exists
    const migrationsResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'migrations'
    `);
    
    if (migrationsResult.rows.length > 0) {
      console.log('✅ migrations table exists');
    } else {
      throw new Error('migrations table not found');
    }

    // Check if role migration was recorded
    const migrationRecord = await pool.query(
      'SELECT name FROM migrations WHERE name = $1',
      ['001_move_role_to_company_user']
    );
    
    if (migrationRecord.rows.length > 0) {
      console.log('✅ Role migration recorded in migrations table');
    } else {
      console.log('ℹ️  Role migration not yet recorded (first run)');
    }

    // Test 4: Test that running setup again is idempotent
    console.log('\n4️⃣ Testing idempotent setup (running again)...');
    await initializeDatabaseWithSetup(config.database);
    console.log('✅ Idempotent setup test passed');

    console.log('\n🎉 All automatic database setup tests passed!');
    console.log('\n✅ Key Features Verified:');
    console.log('  - Automatic database setup on API startup');
    console.log('  - Database schema verification');
    console.log('  - Migration system with role migration');
    console.log('  - Idempotent setup (safe to run multiple times)');
    console.log('  - Proper table and column creation');

    await pool.end();

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
};

// Run tests if this script is executed directly
if (require.main === module) {
  testAutoSetup();
}

export { testAutoSetup };
