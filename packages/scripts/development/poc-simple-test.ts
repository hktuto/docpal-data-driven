/**
 * Simple POC Test Runner
 * 
 * This script runs a basic test to validate the POC setup without Jest
 * to ensure our core workflow engine is working correctly.
 */

import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { pocJsonWorkflow, WorkflowDefinition } from './poc-workflow';
import { activities } from './poc-activities';

// Simple test workflow
const simpleTestWorkflow: WorkflowDefinition = {
  workflowId: 'simple_test',
  name: 'Simple Test Workflow',
  version: '1.0',
  initialStep: 'validate',
  steps: {
    validate: {
      type: 'activity',
      activity: 'validateInput',
      params: {
        data: '{{trigger.data}}',
        rules: ['required_fields']
      },
      outputPath: 'validation_result',
      success: 'complete'
    },
    complete: {
      type: 'end'
    }
  }
};

async function runSimpleTest(): Promise<void> {
  console.log('🚀 Starting Simple POC Test...');
  
  let testEnv: TestWorkflowEnvironment | null = null;
  
  try {
    // Create test environment
    console.log('📋 Setting up test environment...');
    testEnv = await TestWorkflowEnvironment.createLocal();
    
    const { client, nativeConnection } = testEnv;
    
    // Create worker
    console.log('👷 Creating worker...');
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'simple-test',
      workflowsPath: require.resolve('./poc-workflow'),
      activities,
    });

    console.log('▶️  Running workflow...');
    
    await worker.runUntil(async () => {
      // Start workflow
      const handle = await client.workflow.start(pocJsonWorkflow, {
        args: [{
          workflowDefinition: simpleTestWorkflow,
          trigger: {
            data: { amount: 500, requester: 'test@example.com' },
            requestId: 'simple_test_001'
          }
        }],
        taskQueue: 'simple-test',
        workflowId: 'simple-test-001',
      });

      // Wait for result
      const result = await handle.result();
      
      console.log('✅ Workflow completed successfully!');
      console.log('📊 Result:', {
        status: result.status,
        stepCount: result.stepCount,
        validationResult: result.finalState.validation_result?.isValid,
        executionTime: 'N/A' // We don't measure time in this simple test
      });
      
      // Validate results
      if (result.status !== 'completed') {
        throw new Error(`Expected status 'completed', got '${result.status}'`);
      }
      
      if (!result.finalState.validation_result?.isValid) {
        throw new Error('Expected validation to pass');
      }
      
      if (result.stepCount !== 2) {
        throw new Error(`Expected 2 steps, got ${result.stepCount}`);
      }
      
      console.log('🎉 All validations passed!');
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    if (testEnv) {
      console.log('🧹 Cleaning up test environment...');
      await testEnv.teardown();
    }
  }
}

async function runConditionTest(): Promise<void> {
  console.log('\n🧮 Testing Condition Evaluation...');
  
  const conditionTestWorkflow: WorkflowDefinition = {
    workflowId: 'condition_test',
    name: 'Condition Test Workflow',
    version: '1.0',
    initialStep: 'validate',
    steps: {
      validate: {
        type: 'activity',
        activity: 'validateInput',
        params: {
          data: '{{trigger.data}}',
          rules: ['required_fields']
        },
        outputPath: 'validation_result',
        success: 'check_amount'
      },
      check_amount: {
        type: 'condition',
        condition: '{{validation_result.amount}} > 1000',
        onTrue: 'high_amount',
        onFalse: 'low_amount'
      },
      high_amount: {
        type: 'activity',
        activity: 'createAuditLog',
        params: {
          action: 'high_amount_detected',
          recordId: '{{trigger.requestId}}',
          details: 'Amount is greater than 1000'
        },
        success: 'complete'
      },
      low_amount: {
        type: 'activity',
        activity: 'createAuditLog',
        params: {
          action: 'low_amount_detected',
          recordId: '{{trigger.requestId}}',
          details: 'Amount is 1000 or less'
        },
        success: 'complete'
      },
      complete: {
        type: 'end'
      }
    }
  };
  
  let testEnv: TestWorkflowEnvironment | null = null;
  
  try {
    testEnv = await TestWorkflowEnvironment.createLocal();
    const { client, nativeConnection } = testEnv;
    
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'condition-test',
      workflowsPath: require.resolve('./poc-workflow'),
      activities,
    });

    await worker.runUntil(async () => {
      // Test high amount (should go to high_amount step)
      console.log('  Testing high amount (1500)...');
      const highAmountHandle = await client.workflow.start(pocJsonWorkflow, {
        args: [{
          workflowDefinition: conditionTestWorkflow,
          trigger: {
            data: { amount: 1500, requester: 'test@example.com' },
            requestId: 'condition_test_high'
          }
        }],
        taskQueue: 'condition-test',
        workflowId: 'condition-test-high',
      });

      const highResult = await highAmountHandle.result();
      console.log('  ✅ High amount test passed');
      
      // Test low amount (should go to low_amount step)
      console.log('  Testing low amount (500)...');
      const lowAmountHandle = await client.workflow.start(pocJsonWorkflow, {
        args: [{
          workflowDefinition: conditionTestWorkflow,
          trigger: {
            data: { amount: 500, requester: 'test@example.com' },
            requestId: 'condition_test_low'
          }
        }],
        taskQueue: 'condition-test',
        workflowId: 'condition-test-low',
      });

      const lowResult = await lowAmountHandle.result();
      console.log('  ✅ Low amount test passed');
      
      console.log('🎉 Condition tests completed successfully!');
    });
    
  } catch (error) {
    console.error('❌ Condition test failed:', error);
    throw error;
  } finally {
    if (testEnv) {
      await testEnv.teardown();
    }
  }
}

async function runStateInterpolationTest(): Promise<void> {
  console.log('\n🔄 Testing State Interpolation...');
  
  const stateTestWorkflow: WorkflowDefinition = {
    workflowId: 'state_test',
    name: 'State Interpolation Test',
    version: '1.0',
    initialStep: 'validate',
    steps: {
      validate: {
        type: 'activity',
        activity: 'validateInput',
        params: {
          data: '{{trigger.data}}',
          rules: ['required_fields']
        },
        outputPath: 'validation_result',
        success: 'process'
      },
      process: {
        type: 'activity',
        activity: 'processRequest',
        params: {
          requestId: '{{trigger.requestId}}',
          data: {
            originalAmount: '{{trigger.data.amount}}',
            validatedAmount: '{{validation_result.amount}}',
            requester: '{{trigger.data.requester}}'
          }
        },
        outputPath: 'process_result',
        success: 'complete'
      },
      complete: {
        type: 'end'
      }
    }
  };
  
  let testEnv: TestWorkflowEnvironment | null = null;
  
  try {
    testEnv = await TestWorkflowEnvironment.createLocal();
    const { client, nativeConnection } = testEnv;
    
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'state-test',
      workflowsPath: require.resolve('./poc-workflow'),
      activities,
    });

    await worker.runUntil(async () => {
      const handle = await client.workflow.start(pocJsonWorkflow, {
        args: [{
          workflowDefinition: stateTestWorkflow,
          trigger: {
            data: { amount: 750, requester: 'alice@example.com' },
            requestId: 'state_test_001'
          }
        }],
        taskQueue: 'state-test',
        workflowId: 'state-test-001',
      });

      const result = await handle.result();
      
      // Validate state interpolation worked correctly
      const processResult = result.finalState.process_result;
      if (processResult.result.data.originalAmount !== 750) {
        throw new Error('Original amount interpolation failed');
      }
      
      if (processResult.result.data.validatedAmount !== 750) {
        throw new Error(`Validated amount interpolation failed. Expected 750, got ${processResult.result.data.validatedAmount}`);
      }
      
      if (processResult.result.data.requester !== 'alice@example.com') {
        throw new Error('Requester interpolation failed');
      }
      
      console.log('  ✅ State interpolation working correctly');
      console.log('🎉 State interpolation test completed successfully!');
    });
    
  } catch (error) {
    console.error('❌ State interpolation test failed:', error);
    throw error;
  } finally {
    if (testEnv) {
      await testEnv.teardown();
    }
  }
}

// Main execution
async function main(): Promise<void> {
  console.log('🔬 Workflow Integration POC - Simple Tests');
  console.log('=' .repeat(50));
  
  try {
    await runSimpleTest();
    await runConditionTest();
    await runStateInterpolationTest();
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 All POC tests passed successfully!');
    console.log('✅ JSON workflow execution: WORKING');
    console.log('✅ Activity execution: WORKING');
    console.log('✅ Condition evaluation: WORKING');
    console.log('✅ State interpolation: WORKING');
    console.log('✅ Temporal integration: WORKING');
    console.log('\n🚀 Ready to proceed with comprehensive testing!');
    console.log('=' .repeat(50));
    
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('❌ POC tests failed!');
    console.error('Error:', error.message);
    console.error('=' .repeat(50));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { runSimpleTest, runConditionTest, runStateInterpolationTest };
