#!/usr/bin/env tsx

/**
 * Test the audit trigger directly in the database
 * This bypasses the API server to test just the PostgreSQL trigger functionality
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'docpal_dev',
  user: 'docpal_user',
  password: 'docpal_password_dev_123',
};

async function testDirectDbTrigger() {
  console.log('🧪 Testing Direct Database Trigger...\n');

  const pool = new Pool(dbConfig);
  
  try {
    // Step 1: Create a company directly in the database
    console.log('📋 Step 1: Create Company Directly in Database');
    const companyId = uuidv4();
    const userId = uuidv4();
    const uniqueId = Date.now();
    
    await pool.query(`
      INSERT INTO company (id, name, slug, description, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
    `, [companyId, `Test Direct Company ${uniqueId}`, `test-direct-company-${uniqueId}`, 'Test company for direct DB testing']);
    
    await pool.query(`
      INSERT INTO "user" (id, email, password, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
    `, [userId, `admin${uniqueId}@testdirect.com`, 'dummy_hash']);
    
    await pool.query(`
      INSERT INTO company_user (company_id, user_id, role, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
    `, [companyId, userId, 'admin']);
    
    console.log(`   Company created with ID: ${companyId}`);
    
    // Step 2: Create tenant schema
    console.log('📋 Step 2: Create Tenant Schema');
    await pool.query('SELECT create_tenant_schema($1)', [companyId]);
    console.log('   Tenant schema created');
    
    // Step 3: Create a test table in the tenant schema
    console.log('📋 Step 3: Create Test Table');
    const schemaName = `company_${companyId.replace(/-/g, '_')}`;
    
    await pool.query(`
      SET search_path TO ${schemaName};
      CREATE TABLE test_direct_table (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('   Test table created');
    
    // Step 4: Add audit trigger manually
    console.log('📋 Step 4: Add Audit Trigger');
    await pool.query(`
      SET search_path TO ${schemaName};
      CREATE TRIGGER audit_trigger_test_direct_table
        AFTER INSERT OR UPDATE OR DELETE ON test_direct_table
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
    `);
    console.log('   Audit trigger added');
    
    // Step 5: Insert a record to trigger the audit function
    console.log('📋 Step 5: Insert Record to Trigger Audit');
    const recordId = uuidv4();
    
    await pool.query(`
      SET search_path TO ${schemaName};
      INSERT INTO test_direct_table (id, name) VALUES ($1, $2);
    `, [recordId, 'Test Direct Record']);
    
    console.log(`   Record inserted with ID: ${recordId}`);
    console.log('   Check PostgreSQL logs for RAISE NOTICE messages!');
    
    // Step 6: Check if audit log was created
    console.log('📋 Step 6: Check Audit Log');
    const auditResult = await pool.query(`
      SET search_path TO ${schemaName};
      SELECT * FROM audit_log WHERE table_name = 'test_direct_table' AND record_id = $1;
    `, [recordId]);
    
    if (auditResult.rows.length > 0) {
      console.log('✅ Audit log entry created successfully!');
      console.log('   Audit entry:', auditResult.rows[0]);
    } else {
      console.log('❌ No audit log entry found');
    }
    
    console.log('\n🎉 Direct Database Trigger Test COMPLETED!');
    console.log('👀 Check PostgreSQL logs for workflow notification messages:');
    console.log('   - "Sending workflow event for INSERT on table"');
    console.log('   - "Workflow notification sent for INSERT"');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the test
if (require.main === module) {
  testDirectDbTrigger().then(() => {
    process.exit(0);
  }).catch(console.error);
}

export { testDirectDbTrigger };
