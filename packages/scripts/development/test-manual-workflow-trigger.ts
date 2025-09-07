#!/usr/bin/env tsx

/**
 * Test manual workflow triggering
 * This script tests if we can manually trigger a workflow via the API
 */

const TEST_WORKFLOW_SLUG = 'auto-update-product';
const uniqueId = Date.now();
const adminEmail = 'admin' + uniqueId + '@testevent.com';
let cookies: string | null = '';

async function testManualWorkflowTrigger() {
  console.log('🧪 Testing Manual Workflow Triggering...\n');

  try {
    // Step 1: Create company and user (reuse from previous test)
    console.log('📋 Step 1: Create Company and Admin User');
    await createCompanyAndUser();
    console.log('✅ Company and user created\n');

    // Step 2: Create workflow
    console.log('📋 Step 2: Create Simple Workflow');
    await createWorkflow();
    console.log('✅ Workflow created\n');

    // Step 3: Manually trigger the workflow
    console.log('📋 Step 3: Manually Trigger Workflow');
    await manuallyTriggerWorkflow();
    console.log('✅ Workflow triggered manually\n');

    // Step 4: Check workflow executions
    console.log('📋 Step 4: Check Workflow Executions');
    await checkWorkflowExecutions();
    console.log('✅ Workflow executions checked\n');

    console.log('🎉 Manual Workflow Trigger Test COMPLETED! 🎉');
    process.exit(1);
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
      name: 'Test Manual Company' + uniqueId,
      slug: 'test-manual-company' + uniqueId,
      description: 'Test company for manual workflow triggering',
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
    const error = await response.text();
    if (error.includes('already exists')) {
      console.log('   Company already exists, continuing...');
      return;
    }
    throw new Error(`Failed to create company: ${error}`);
  }

  cookies = response.headers.get('set-cookie');
  if (!cookies) {
    throw new Error('No session cookie received');
  }
  console.log('   Company and admin user created successfully');
}

async function createWorkflow() {
  // Create workflow definition
  const workflowDefinition = {
    name: 'Manual Test Workflow',
    slug: TEST_WORKFLOW_SLUG,
    version: '1.0',
    definition: {
      steps: [
        {
          id: 'log_trigger',
          type: 'activity',
          activity: 'logMessage',
          input: {
            message: 'Manual workflow triggered successfully!',
            level: 'info'
          },
          timeout: '30s'
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
      return;
    }
    throw new Error(`Failed to create workflow: ${error}`);
  }

  console.log('   Workflow created successfully');
}

async function manuallyTriggerWorkflow() {
  const triggerData = {
    manual_trigger: true,
    test_data: 'This is a manual test',
    timestamp: new Date().toISOString()
  };

  const response = await fetch(`http://localhost:3333/api/workflows/${TEST_WORKFLOW_SLUG}/trigger`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies || ''
    },
    body: JSON.stringify(triggerData)
  });

  if (!response.ok) {
    throw new Error(`Failed to trigger workflow: ${await response.text()}`);
  }

  const result = await response.json() as any;
  console.log(`   Workflow triggered successfully: ${result.executionId}`);
  return result;
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
    console.log('   ⚠️  No workflow executions found');
  }

  return executions;
}

// Run the test
if (require.main === module) {
  testManualWorkflowTrigger().catch(console.error);
}

export { testManualWorkflowTrigger };
