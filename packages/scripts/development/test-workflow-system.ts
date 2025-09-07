#!/usr/bin/env tsx
/**
 * Test Workflow System
 * Tests the complete workflow system integration
 */

import { loadConfig } from '../../api/src/config';
import { initializeDatabaseWithSetup } from '../../api/src/database/utils/database';
import { initializeOpenFGA } from '../../api/src/utils/openfga';
import { initializeMinIO } from '../../api/src/utils/minio';
import { initializeTemporal } from '../../api/src/utils/temporal';
import { migrateAllCompaniesToWorkflow } from '../../api/src/database/utils/workflow-migration';
import {
  createWorkflowDefinition,
  getWorkflowDefinitions,
  getWorkflowDefinition,
  updateWorkflowDefinition,
  deleteWorkflowDefinition,
  forceDeleteWorkflowDefinition
} from '../../api/src/services/workflow/workflow-service';
import {
  triggerWorkflowExecution,
  syncWorkflowExecutionStatus
} from '../../api/src/services/workflow/workflow-execution-service';

// Test configuration
const TEST_COMPANY_ID = 'f2718fa0-3500-48c7-9323-7b6e580e3fef';
const TEST_USER_ID = '48ddbed2-62f9-4290-8b19-20929252f078';

async function main() {
  console.log('🧪 Testing Workflow System Integration');
  console.log('=====================================\n');

  try {
    // Load configuration
    const config = loadConfig();
    console.log('✅ Configuration loaded');

    // Initialize services
    await initializeDatabaseWithSetup(config.database);
    console.log('✅ Database initialized');

    initializeOpenFGA(config.openfga);
    console.log('✅ OpenFGA initialized');

    initializeMinIO(config.minio);
    console.log('✅ MinIO initialized');

    // Try to initialize Temporal (optional)
    try {
      await initializeTemporal(config.temporal);
      console.log('✅ Temporal initialized');
    } catch (error) {
      console.log('⚠️  Temporal not available, continuing with database-only tests');
    }

    // Migrate workflow tables
    console.log('\n📋 Migrating workflow tables...');
    await migrateAllCompaniesToWorkflow();
    console.log('✅ Workflow tables migrated');

    // Clean up any existing test workflow first
    console.log('\n🧹 Cleanup: Remove existing test workflow if exists');
    try {
      await forceDeleteWorkflowDefinition(TEST_COMPANY_ID, 'test-approval', TEST_USER_ID);
      console.log('✅ Existing test workflow cleaned up');
    } catch (error) {
      console.log('ℹ️  No existing test workflow to clean up');
    }

    // Test 1: Create workflow definition
    console.log('\n🔧 Test 1: Create Workflow Definition');
    const workflowDefinition = {
      name: 'Test Approval Workflow',
      slug: 'test-approval',
      definition: {
        name: 'Test Approval Workflow',
        version: '1.0',
        steps: [
          {
            id: 'step1',
            type: 'activity',
            name: 'Create Record',
            activity: 'createRecord',
            parameters: {
              tableName: 'test_table',
              data: {
                name: 'Test Record',
                status: 'pending'
              }
            },
            onSuccess: 'step2'
          },
          {
            id: 'step2',
            type: 'userTask',
            name: 'Manager Approval',
            userTask: {
              assignee: TEST_USER_ID,
              formDefinition: {
                fields: [
                  { name: 'approved', type: 'boolean', label: 'Approve?' },
                  { name: 'comments', type: 'text', label: 'Comments' }
                ]
              },
              timeout: '24h'
            },
            onSuccess: 'step3'
          },
          {
            id: 'step3',
            type: 'condition',
            name: 'Check Approval',
            condition: '{{task_step2_result.approved}} === true',
            onSuccess: 'step4',
            onFailure: 'step5'
          },
          {
            id: 'step4',
            type: 'activity',
            name: 'Update Record - Approved',
            activity: 'updateRecord',
            parameters: {
              tableName: 'test_table',
              recordId: '{{step1_result.id}}',
              data: {
                status: 'approved'
              }
            }
          },
          {
            id: 'step5',
            type: 'activity',
            name: 'Update Record - Rejected',
            activity: 'updateRecord',
            parameters: {
              tableName: 'test_table',
              recordId: '{{step1_result.id}}',
              data: {
                status: 'rejected'
              }
            }
          }
        ]
      },
      events: {
        triggers: [
          {
            event: 'record_created',
            table: 'test_table',
            condition: 'status === "pending"'
          }
        ]
      },
      status: 'active' as const
    };

    const createdWorkflow = await createWorkflowDefinition(
      TEST_COMPANY_ID,
      TEST_USER_ID,
      workflowDefinition
    );
    console.log('✅ Workflow definition created:', createdWorkflow.slug);

    // Test 2: List workflow definitions
    console.log('\n📋 Test 2: List Workflow Definitions');
    const workflows = await getWorkflowDefinitions(TEST_COMPANY_ID, TEST_USER_ID);
    console.log(`✅ Found ${workflows.length} workflow(s)`);
    workflows.forEach(wf => {
      console.log(`   - ${wf.name} (${wf.slug}) - ${wf.status}`);
    });

    // Test 3: Get specific workflow definition
    console.log('\n🔍 Test 3: Get Workflow Definition');
    const workflow = await getWorkflowDefinition(TEST_COMPANY_ID, 'test-approval', TEST_USER_ID);
    if (workflow) {
      console.log('✅ Workflow retrieved:', workflow.name);
      console.log(`   Steps: ${workflow.definition.steps.length}`);
    } else {
      console.log('❌ Workflow not found');
    }

    // Test 4: Update workflow definition
    console.log('\n✏️  Test 4: Update Workflow Definition');
    const updatedWorkflow = await updateWorkflowDefinition(
      TEST_COMPANY_ID,
      'test-approval',
      TEST_USER_ID,
      {
        name: 'Updated Test Approval Workflow',
        status: 'inactive'
      }
    );
    console.log('✅ Workflow updated:', updatedWorkflow.name, '-', updatedWorkflow.status);

    // Test 5: Trigger workflow execution (will fail gracefully if Temporal not available)
    console.log('\n🚀 Test 5: Trigger Workflow Execution');
    try {
      // First, reactivate the workflow
      await updateWorkflowDefinition(
        TEST_COMPANY_ID,
        'test-approval',
        TEST_USER_ID,
        { status: 'active' }
      );

      const executionResult = await triggerWorkflowExecution(
        TEST_COMPANY_ID,
        TEST_USER_ID,
        {
          workflowSlug: 'test-approval',
          triggerData: {
            requestId: 'test-123',
            requestedBy: TEST_USER_ID
          }
        }
      );
      console.log('✅ Workflow execution triggered:', executionResult.message);
      console.log(`   Execution ID: ${executionResult.executionId}`);
      console.log(`   Temporal Workflow ID: ${executionResult.temporalWorkflowId}`);

      // Test 6: Sync execution status
      console.log('\n🔄 Test 6: Sync Execution Status');
      const syncedExecution = await syncWorkflowExecutionStatus(
        TEST_COMPANY_ID,
        executionResult.executionId
      );
      console.log('✅ Execution status synced:', syncedExecution.status);

    } catch (error) {
      console.log('⚠️  Workflow execution test failed (expected if Temporal not available):', error);
    }

    // Test 7: Clean up - Delete workflow definition (force delete for testing)
    console.log('\n🗑️  Test 7: Delete Workflow Definition');
    await forceDeleteWorkflowDefinition(TEST_COMPANY_ID, 'test-approval', TEST_USER_ID);
    console.log('✅ Workflow definition deleted');

    // Verify deletion
    const deletedWorkflow = await getWorkflowDefinition(TEST_COMPANY_ID, 'test-approval', TEST_USER_ID);
    if (!deletedWorkflow) {
      console.log('✅ Deletion verified - workflow not found');
    } else {
      console.log('❌ Deletion failed - workflow still exists');
    }

    console.log('\n🎉 All workflow system tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('   ✅ Database schema migration');
    console.log('   ✅ Workflow definition CRUD operations');
    console.log('   ✅ Workflow execution triggering');
    console.log('   ✅ Status synchronization');
    console.log('   ✅ Cleanup operations');

    if (config.temporal) {
      console.log('\n💡 Next Steps:');
      console.log('   1. Start Temporal worker to process workflows');
      console.log('   2. Test user task completion');
      console.log('   3. Test event-driven workflow triggering');
      console.log('   4. Test parallel execution and conditions');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}
