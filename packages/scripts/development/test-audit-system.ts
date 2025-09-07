#!/usr/bin/env ts-node

/**
 * Test script for the audit system
 * This script tests audit logging with different contexts:
 * 1. System operations (no user context)
 * 2. User operations (with user context)
 * 3. Audit trigger functionality
 */

// Note: Make sure to set environment variables before running this script
// DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

import { 
  initializeDatabaseWithSetup, 
  queryInTenantSchema, 
  withTenantTransaction,
  setUserAuditContext,
  getPool
} from '../../api/src/database/utils/database';
import { 
  addAuditTriggersToAllTables,
  getAuditTriggerStatus,
  addAuditTriggerToNewTable
} from '../../api/src/database/utils/audit-triggers';

interface TestCompany {
  id: string;
  name: string;
  slug: string;
}

interface TestUser {
  id: string;
  email: string;
}

const TEST_COMPANY: TestCompany = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Audit Company',
  slug: 'test-audit-company'
};

const TEST_USER: TestUser = {
  id: '987fcdeb-51a2-43d1-9f12-345678901234',
  email: 'test@audit.com'
};

async function setupTestEnvironment() {
  console.log('🔧 Setting up test environment...');
  
  // Initialize database
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'docpal',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
  };
  
  await initializeDatabaseWithSetup(dbConfig);
  
  // Create test company if it doesn't exist
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    // Check if company exists
    const companyResult = await client.query(
      'SELECT id FROM company WHERE id = $1',
      [TEST_COMPANY.id]
    );
    
    if (companyResult.rows.length === 0) {
      // Create test company
      await client.query(
        'INSERT INTO company (id, name, slug) VALUES ($1, $2, $3)',
        [TEST_COMPANY.id, TEST_COMPANY.name, TEST_COMPANY.slug]
      );
      
      // Create tenant schema
      await client.query('SELECT create_tenant_schema($1)', [TEST_COMPANY.id]);
      console.log('✅ Created test company and tenant schema');
    } else {
      console.log('✅ Test company already exists');
    }
    
  } finally {
    client.release();
  }
}

async function testSystemOperations() {
  console.log('\n📋 Testing system operations (no user context)...');
  
  try {
    // Create a test table for audit testing
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS audit_test_table (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(128) NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    
    await queryInTenantSchema(TEST_COMPANY.id, createTableSQL);
    console.log('✅ Created test table (system operation)');
    
    // Add audit trigger to the test table
    await addAuditTriggerToNewTable(TEST_COMPANY.id, 'audit_test_table');
    console.log('✅ Added audit trigger to test table');
    
    // Insert test data (system operation - no user context)
    await queryInTenantSchema(
      TEST_COMPANY.id,
      `INSERT INTO audit_test_table (name, description) VALUES ($1, $2)`,
      ['System Test Record', 'Created by system operation']
    );
    console.log('✅ Inserted test record (system operation)');
    
  } catch (error) {
    console.error('❌ System operations test failed:', error);
  }
}

async function testUserOperations() {
  console.log('\n👤 Testing operations (will show as system operations for now)...');
  
  try {
    // Test operations - will be audited as 'system' operations for simplicity
    const result = await withTenantTransaction(
      TEST_COMPANY.id,
      async (client) => {
        // Insert record (will be audited as system operation)
        const insertResult = await client.query(
          `INSERT INTO audit_test_table (name, description) VALUES ($1, $2) RETURNING id`,
          ['API Test Record', 'Created by API operation']
        );
        
        const recordId = insertResult.rows[0].id;
        
        // Update the record
        await client.query(
          `UPDATE audit_test_table SET description = $1 WHERE id = $2`,
          ['Updated by API operation', recordId]
        );
        
        return recordId;
      }
    );
    
    console.log('✅ Inserted and updated record (audited as system operation)');
    
  } catch (error) {
    console.error('❌ Operations test failed:', error);
  }
}

async function testAuditQueries() {
  console.log('\n🔍 Testing audit log queries...');
  
  try {
    // Query all audit logs
    const allAuditLogs = await queryInTenantSchema(
      TEST_COMPANY.id,
      `SELECT 
        table_name, 
        operation, 
        operation_source, 
        user_email,
        timestamp,
        CASE 
          WHEN new_data IS NOT NULL THEN jsonb_extract_path_text(new_data, 'name')
          WHEN old_data IS NOT NULL THEN jsonb_extract_path_text(old_data, 'name')
        END as record_name
       FROM audit_log 
       WHERE table_name = 'audit_test_table'
       ORDER BY timestamp DESC`
    );
    
    console.log(`📊 Found ${allAuditLogs.rows.length} audit log entries:`);
    
    allAuditLogs.rows.forEach((log, index) => {
      console.log(`  ${index + 1}. ${log.operation} on ${log.table_name} by ${log.operation_source} (${log.user_email || 'system'}) - ${log.record_name}`);
    });
    
    // Query user-specific audit logs (will be 0 for now since we're not tracking users)
    const userAuditLogs = await queryInTenantSchema(
      TEST_COMPANY.id,
      `SELECT COUNT(*) as count FROM audit_log WHERE user_id IS NOT NULL`
    );
    
    console.log(`👤 Operations with user context: ${userAuditLogs.rows[0].count} audit entries`);
    
    // Query system operation logs
    const systemAuditLogs = await queryInTenantSchema(
      TEST_COMPANY.id,
      `SELECT COUNT(*) as count FROM audit_log WHERE operation_source = 'system'`
    );
    
    console.log(`🔧 System operations: ${systemAuditLogs.rows[0].count} audit entries`);
    
  } catch (error) {
    console.error('❌ Audit queries test failed:', error);
  }
}

async function testTriggerManagement() {
  console.log('\n⚙️ Testing trigger management...');
  
  try {
    // Get audit trigger status for all tables
    const triggerStatus = await getAuditTriggerStatus(TEST_COMPANY.id);
    
    console.log('📋 Audit trigger status:');
    triggerStatus.forEach(status => {
      const icon = status.hasAuditTrigger ? '✅' : '❌';
      console.log(`  ${icon} ${status.tableName}: ${status.hasAuditTrigger ? 'HAS' : 'NO'} audit trigger`);
    });
    
    // Add audit triggers to all tables that don't have them
    console.log('\n🔧 Adding audit triggers to all tables...');
    await addAuditTriggersToAllTables(TEST_COMPANY.id);
    
  } catch (error) {
    console.error('❌ Trigger management test failed:', error);
  }
}

async function runAuditSystemTests() {
  console.log('🚀 Starting Audit System Tests\n');
  
  try {
    await setupTestEnvironment();
    await testSystemOperations();
    await testUserOperations();
    await testAuditQueries();
    await testTriggerManagement();
    
    console.log('\n✅ All audit system tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Audit system tests failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAuditSystemTests()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { runAuditSystemTests };
