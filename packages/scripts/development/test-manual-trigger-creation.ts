#!/usr/bin/env tsx

/**
 * Test manual trigger creation and notification
 * This script manually creates a table and adds an audit trigger to test the notification
 */

import { Pool } from 'pg';

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'docpal_dev',
  user: 'docpal_user',
  password: 'docpal_password_dev_123',
};

const uniqueId = Date.now();
const adminEmail = 'admin' + uniqueId + '@testevent.com';
let cookies: string | null = '';
let companyId: string = '';

async function testManualTriggerCreation() {
  console.log('🧪 Testing Manual Trigger Creation and Notification...\n');

  try {
    // Step 1: Create company and user
    console.log('📋 Step 1: Create Company and Admin User');
    await createCompanyAndUser();
    console.log('✅ Company and user created\n');

    // Step 2: Create custom table
    console.log('📋 Step 2: Create Custom Table');
    await createCustomTable();
    console.log('✅ Custom table created\n');

    // Step 3: Manually add audit trigger
    console.log('📋 Step 3: Manually Add Audit Trigger');
    await manuallyAddAuditTrigger();
    console.log('✅ Audit trigger added manually\n');

    // Step 4: Insert record and check notifications
    console.log('📋 Step 4: Insert Record and Check for Notifications');
    await insertRecordAndCheck();
    console.log('✅ Record inserted and checked\n');

    console.log('🎉 Manual Trigger Creation Test COMPLETED!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

async function createCompanyAndUser() {
  const response = await fetch('http://localhost:3333/api/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Manual Trigger Company' + uniqueId,
      slug: 'test-manual-trigger-company' + uniqueId,
      description: 'Test company for manual trigger testing',
      admin: {
        email: adminEmail,
        password: 'testpass123',
        profile: {
          name: 'Test Admin',
          email: adminEmail,
          phone: '+1234567890'
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create company: ${await response.text()}`);
  }

  const result = await response.json() as any;
  companyId = result.company.id;
  cookies = response.headers.get('set-cookie');
  
  if (!cookies) {
    throw new Error('No session cookie received');
  }
  
  console.log(`   Company created with ID: ${companyId}`);
}

async function createCustomTable() {
  const response = await fetch('http://localhost:3333/api/schemas', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies || ''
    },
    body: JSON.stringify({
      slug: 'manual_test_table',
      label: 'Manual Test Table',
      description: 'Manual table for trigger testing',
      is_system: false,
      is_relation: false,
      columns: [
        {
          name: 'name',
          data_type: 'varchar',
          data_type_options: { length: 255 },
          nullable: false,
          default: null,
          view_type: 'text',
          view_editor: 'input'
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create table: ${await response.text()}`);
  }

  console.log('   Custom table created successfully');
}

async function manuallyAddAuditTrigger() {
  const pool = new Pool(dbConfig);
  
  try {
    const schemaName = `company_${companyId.replace(/-/g, '_')}`;
    
    // Add audit trigger manually
    const triggerSQL = `
      SET search_path TO ${schemaName};
      CREATE TRIGGER audit_trigger_manual_test_table
        AFTER INSERT OR UPDATE OR DELETE ON manual_test_table
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
    `;
    
    await pool.query(triggerSQL);
    console.log(`   Audit trigger added to ${schemaName}.manual_test_table`);
    
  } finally {
    await pool.end();
  }
}

async function insertRecordAndCheck() {
  // Insert a record
  const recordData = {
    name: 'Test Manual Record'
  };

  const response = await fetch('http://localhost:3333/api/records/manual_test_table', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies || ''
    },
    body: JSON.stringify(recordData)
  });

  if (!response.ok) {
    throw new Error(`Failed to insert record: ${await response.text()}`);
  }

  const result = await response.json() as any;
  console.log(`   Record inserted with ID: ${result.id}`);
  
  // Wait for notifications
  console.log('⏳ Waiting 3 seconds for notifications...');
  console.log('👀 Check the API server console for:');
  console.log('   🔔 "---Received workflow event" message');
  console.log('   🧪 "TEST MODE: Event listener is working!" message');
  console.log('   📊 PostgreSQL logs should show workflow notification messages');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
}

// Run the test
if (require.main === module) {
  testManualTriggerCreation().then(() => {
    process.exit(0);
  }).catch(console.error);
}

export { testManualTriggerCreation };
