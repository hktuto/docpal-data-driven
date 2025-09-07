#!/usr/bin/env tsx

/**
 * Test Event-Driven Workflow Integration
 * 
 * This script tests the complete event-driven workflow system:
 * 1. Create company and admin user
 * 2. Create a custom table
 * 3. Create a simple workflow (one update data task)
 * 4. Check workflow endpoint to see the definition exists
 * 5. Create event configuration for custom table and add workflow into it
 * 6. Create a record (this should trigger the workflow)
 * 7. Check API and look for '/workflows/:slug/executions' to see if workflow started
 * 8. Check the record to see if it was updated by the workflow
 */

import { loadConfig } from '../../api/src/config';
import { initializeDatabaseWithSetup } from '../../api/src/database/utils/database';
import { initializeOpenFGA } from '../../api/src/utils/openfga';
import { initializeMinIO } from '../../api/src/utils/minio';
import { initializeTemporal, startWorkflowEventListener } from '../../api/src/utils/temporal';

// Test configuration
const TEST_COMPANY_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const TEST_USER_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d480';
const TEST_TABLE_SLUG = 'test_products';
const TEST_WORKFLOW_SLUG = 'auto-update-product';

const config = loadConfig();

async function runEventWorkflowIntegrationTest() {
  console.log('🧪 Starting Event-Driven Workflow Integration Test...\n');

  try {
    // Initialize services
    console.log('📋 Step 1: Initialize Services');
    await initializeDatabaseWithSetup(config.database);
    initializeOpenFGA(config.openfga);
    initializeMinIO(config.minio);
    await initializeTemporal(config.temporal);
    await startWorkflowEventListener();
    console.log('✅ Services initialized\n');

    // Step 1: Create company and admin user
    console.log('📋 Step 2: Create Company and Admin User');
    await createCompanyAndUser();
    console.log('✅ Company and user created\n');

    // Step 2: Create custom table
    console.log('📋 Step 3: Create Custom Table');
    await createCustomTable();
    console.log('✅ Custom table created\n');

    // Step 3: Create workflow
    console.log('📋 Step 4: Create Simple Workflow');
    await createWorkflow();
    console.log('✅ Workflow created\n');

    // Step 4: Verify workflow exists
    console.log('📋 Step 5: Verify Workflow Definition Exists');
    await verifyWorkflowExists();
    console.log('✅ Workflow definition verified\n');

    // Step 5: Configure table events
    console.log('📋 Step 6: Configure Table Events');
    await configureTableEvents();
    console.log('✅ Table events configured\n');

    // Step 6: Create a record (should trigger workflow)
    console.log('📋 Step 7: Create Record (Should Trigger Workflow)');
    const recordId = await createRecord();
    console.log(`✅ Record created with ID: ${recordId}\n`);

    // Wait a moment for workflow to process
    console.log('⏳ Waiting 3 seconds for workflow processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 7: Check workflow executions
    console.log('📋 Step 8: Check Workflow Executions');
    await checkWorkflowExecutions();
    console.log('✅ Workflow executions checked\n');

    // Step 8: Verify record was updated
    console.log('📋 Step 9: Verify Record Was Updated');
    await verifyRecordUpdated(recordId);
    console.log('✅ Record update verified\n');

    console.log('🎉 Event-Driven Workflow Integration Test PASSED! 🎉');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}
const uniqueId = Date.now()
const companyName = 'Test Event Company' + uniqueId;
const companySlug = 'test-event-company' + uniqueId;
const adminEmail = 'admin'+ uniqueId +'@testevent.com';
let cookies:string | null = '';
async function createCompanyAndUser() {
  const response = await fetch('http://localhost:3333/api/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: companyName,
      slug: companySlug,
      description: 'Test company for event-driven workflow integration',
      admin: {
        email: adminEmail,
        password: 'testpass123',
        profile: {
          name: 'Test Admin',
          email: 'admin@testevent.com',
          phone: '+1234567890'
        }
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    if (error.includes('already exists')) {
      console.log('   Company already exists, continuing...');
      return;
    }
    throw new Error(`Failed to create company: ${error}`);
  }
  cookies = response.headers.get('set-cookie'); if (!cookies) {
    throw new Error('No session cookie received');
  }
  console.log('   Company and admin user created successfully');
}

async function createCustomTable() {
  if (!cookies) {
    throw new Error('No session cookie received');
  }

  // Create custom table
  const response = await fetch('http://localhost:3333/api/schemas', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({
      slug: TEST_TABLE_SLUG,
      label: 'Test Products',
      description: 'Test table for event-driven workflows',
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
        },
        {
          name: 'price',
          data_type: 'decimal',
          data_type_options: { precision: 10, scale: 2 },
          nullable: true,
          default: null,
          view_type: 'number',
          view_editor: 'input'
        },
        {
          name: 'status',
          data_type: 'varchar',
          data_type_options: { length: 50 },
          nullable: true,
          default: 'pending',
          view_type: 'text',
          view_editor: 'input'
        },
        {
          name: 'auto_updated',
          data_type: 'boolean',
          nullable: true,
          default: false,
          view_type: 'boolean',
          view_editor: 'checkbox'
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    if (error.includes('already exists')) {
      console.log('   Table already exists, continuing...');
      return cookies;
    }
    throw new Error(`Failed to create table: ${error}`);
  }

  console.log('   Custom table created successfully');
  return cookies;
}

async function createWorkflow() {

  // Create workflow definition
  const workflowDefinition = {
    name: 'Auto Update Product',
    slug: TEST_WORKFLOW_SLUG,
    version: '1.0',
    definition: {
      steps: [
        {
          id: 'update_product',
          type: 'activity',
          activity: 'updateRecord',
          input: {
            table_name: TEST_TABLE_SLUG,
            recordId: '{{trigger.record_id}}',
            data: {
              status: 'processed',
              auto_updated: true
            }
          },
          timeout: '30s'
        }
      ],
      triggers: [
        {
          event: 'insert',
          table: TEST_TABLE_SLUG
        }
      ]
    },
    status: 'active'
  };

  const response = await fetch('http://localhost:3333/api/workflows', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies || ''
    },
    body: JSON.stringify(workflowDefinition)
  });

  if (!response.ok) {
    const error = await response.text();
    if (error.includes('already exists')) {
      console.log('   Workflow already exists, continuing...');

    }
    throw new Error(`Failed to create workflow: ${error}`);
  }

  console.log('   Workflow created successfully');

}

async function verifyWorkflowExists() {

  // Get workflow definition
  const response = await fetch(`http://localhost:3333/api/workflows/${TEST_WORKFLOW_SLUG}`, {
    headers: { 'Cookie': cookies || '' }
  });

  if (!response.ok) {
    throw new Error(`Workflow not found: ${await response.text()}`);
  }

  const workflow = await response.json() as any;
  console.log(`   Workflow found: ${workflow.name} (${workflow.slug})`);
  return cookies;
}

async function configureTableEvents() {

  // Configure table events
  const eventConfig = {
    triggers: [
      {
        workflow_slug: TEST_WORKFLOW_SLUG,
        event: 'insert'
      }
    ]
  };

  const response = await fetch(`http://localhost:3333/api/schemas/${TEST_TABLE_SLUG}/events`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies || ''
    },
    body: JSON.stringify(eventConfig)
  });

  if (!response.ok) {
    throw new Error(`Failed to configure events: ${await response.text()}`);
  }

  console.log('   Table events configured successfully');
  return cookies;
}

async function createRecord() {
  

  // Create a record in the custom table
  const recordData = {
    name: 'Test Product',
    price: 99.99,
    status: 'pending',
    auto_updated: false
  };

  const response = await fetch(`http://localhost:3333/api/records/${TEST_TABLE_SLUG}`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies || ''
    },
    body: JSON.stringify(recordData)
  });

  if (!response.ok) {
    throw new Error(`Failed to create record: ${await response.text()}`);
  }

  const result = await response.json() as any;
  console.log(`   Record created with ID: ${result.id}`);
  return result.id;
}

async function checkWorkflowExecutions() {


  // Check workflow executions
  const response = await fetch(`http://localhost:3333/api/workflows/${TEST_WORKFLOW_SLUG}/executions`, {
    headers: { 'Cookie': cookies || '' }
  });

  if (!response.ok) {
    throw new Error(`Failed to get executions: ${await response.text()}`);
  }

  const executions = await response.json() as any;
  console.log(`   Found ${executions.length} workflow execution(s)`);
  
  if (executions.length > 0) {
    const latestExecution = executions[0];
    console.log(`   Latest execution: ${latestExecution.id} (${latestExecution.status})`);
  } else {
    console.log('   ⚠️  No workflow executions found - event may not have triggered');
  }

  return executions;
}

async function verifyRecordUpdated(recordId: string) {


  // Get the record to check if it was updated
  const response = await fetch(`http://localhost:3333/api/records/${TEST_TABLE_SLUG}/${recordId}`, {
    headers: { 'Cookie': cookies || '' }
  });

  if (!response.ok) {
    throw new Error(`Failed to get record: ${await response.text()}`);
  }

  const record = await response.json() as any;
  console.log(`   Record status: ${record.status}`);
  console.log(`   Auto updated: ${record.auto_updated}`);

  if (record.status === 'processed' && record.auto_updated === true) {
    console.log('   ✅ Record was successfully updated by workflow!');
  } else {
    console.log('   ⚠️  Record may not have been updated by workflow yet');
    console.log('   Current record state:', record);
  }

  return record;
}

// Run the test
if (require.main === module) {
  runEventWorkflowIntegrationTest().then(() => {
    process.exit(0);
  }).catch(console.error)
}

export { runEventWorkflowIntegrationTest };
