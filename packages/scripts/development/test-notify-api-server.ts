#!/usr/bin/env tsx

/**
 * Test if the API server's event listener receives PostgreSQL notifications
 * This script sends a manual notification and checks if workflows are triggered
 */

import { Pool } from 'pg';

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'docpal_dev',
  user: 'docpal_user',
  password: 'docpal_password_dev_123',
};

const TEST_WORKFLOW_SLUG = 'auto-update-product';
const uniqueId = Date.now();
const adminEmail = 'admin' + uniqueId + '@testevent.com';
let cookies: string | null = '';

async function testNotifyApiServer() {
  console.log('🧪 Testing API Server Event Listener...\n');

  try {
    // Step 1: Setup test environment
    console.log('📋 Step 1: Setup Test Environment');
    await setupTestEnvironment();
    console.log('✅ Test environment ready\n');

    // Step 2: Send manual notification
    console.log('📋 Step 2: Send Manual PostgreSQL Notification');
    await sendManualNotification();
    console.log('✅ Manual notification sent\n');

    // Step 3: Wait and check for workflow execution
    console.log('⏳ Waiting 5 seconds for event processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('📋 Step 3: Check if Workflow was Triggered');
    await checkWorkflowExecutions();
    console.log('✅ Workflow execution check completed\n');

    console.log('🎉 API Server Event Listener Test COMPLETED! 🎉');
    process.exit(1);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

async function setupTestEnvironment() {
  // Create company and user
  const response = await fetch('http://localhost:3333/api/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Notify Company' + uniqueId,
      slug: 'test-notify-company' + uniqueId,
      description: 'Test company for notification testing',
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

  cookies = response.headers.get('set-cookie');
  if (!cookies) {
    throw new Error('No session cookie received');
  }

  // Create workflow
  const workflowDefinition = {
    name: 'Notification Test Workflow',
    slug: TEST_WORKFLOW_SLUG,
    version: '1.0',
    definition: {
      steps: [
        {
          id: 'log_notification',
          type: 'activity',
          activity: 'logMessage',
          input: {
            message: 'Workflow triggered by PostgreSQL notification!',
            level: 'info'
          },
          timeout: '30s'
        }
      ]
    },
    status: 'active'
  };

  const workflowResponse = await fetch('http://localhost:3333/api/workflows', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies || ''
    },
    body: JSON.stringify(workflowDefinition)
  });

  if (!workflowResponse.ok) {
    const error = await workflowResponse.text();
    if (!error.includes('already exists')) {
      throw new Error(`Failed to create workflow: ${error}`);
    }
  }

  console.log('   Company, user, and workflow created successfully');
}

async function sendManualNotification() {
  const pool = new Pool(dbConfig);
  
  try {
    // Get the company ID from the database
    const companyResult = await pool.query(`
      SELECT id FROM company 
      WHERE slug = $1
    `, [`test-notify-company${uniqueId}`]);
    
    if (companyResult.rows.length === 0) {
      throw new Error('Company not found in database');
    }
    
    const companyId = companyResult.rows[0].id;
    console.log(`   Company ID: ${companyId}`);

    // Create a realistic notification payload that mimics what the audit trigger would send
    const notificationPayload = {
      event_type: 'INSERT',
      table_name: 'test_products',
      company_id: companyId,
      record_id: '12345678-1234-1234-1234-123456789012',
      new_data: {
        id: '12345678-1234-1234-1234-123456789012',
        name: 'Test Product',
        price: 99.99,
        status: 'pending',
        auto_updated: false
      },
      schema_events: {
        triggers: [
          {
            workflow_slug: TEST_WORKFLOW_SLUG,
            event: 'insert'
          }
        ]
      },
      user_id: null,
      session_id: null,
      timestamp: new Date().toISOString()
    };

    // Send the notification
    await pool.query('SELECT pg_notify($1, $2)', [
      'workflow_events', 
      JSON.stringify(notificationPayload)
    ]);

    console.log('   PostgreSQL notification sent with payload:');
    console.log('   ', JSON.stringify(notificationPayload, null, 2));

  } finally {
    await pool.end();
  }
}

async function checkWorkflowExecutions() {
  const response = await fetch(`http://localhost:3333/api/workflows/${TEST_WORKFLOW_SLUG}/executions`, {
    headers: { 'Cookie': cookies || '' }
  });

  if (!response.ok) {
    throw new Error(`Failed to get executions: ${await response.text()}`);
  }

  const executions = await response.json() as any;
  console.log(`   Found ${executions.length} workflow execution(s)`);
  
  if (executions.length > 0) {
    console.log('   📊 Executions:');
    executions.forEach((exec: any, index: number) => {
      console.log(`     ${index + 1}. ${exec.id} (${exec.status}) - Started: ${exec.started_at}`);
    });
    
    if (executions.length > 1) {
      console.log('   ✅ NEW execution found - Event listener is working!');
    } else {
      console.log('   ⚠️  Only 1 execution found - May be from previous test');
    }
  } else {
    console.log('   ❌ No workflow executions found - Event listener may not be working');
  }

  return executions;
}

// Run the test
if (require.main === module) {
  testNotifyApiServer().catch(console.error);
}

export { testNotifyApiServer };
