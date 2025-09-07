/**
 * Workflow Integration POC - Comprehensive Test Suite
 * 
 * This file contains comprehensive tests for the JSON-based dynamic workflow engine.
 * It validates all critical workflow patterns and performance requirements.
 */

import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { pocJsonWorkflow, WorkflowDefinition, WorkflowInput } from './poc-workflow';
import { activities, clearAllTasks, completeTask, getPendingTasks } from './poc-activities';

/**
 * Test Workflow Definitions
 */

// Main test workflow from POC specification
const testWorkflow: WorkflowDefinition = {
  workflowId: 'poc_test_workflow',
  name: 'POC Test Workflow',
  version: '1.0',
  initialStep: 'start_validation',
  steps: {
    start_validation: {
      type: 'activity',
      activity: 'validateInput',
      params: {
        data: '{{trigger.data}}',
        rules: ['required_fields', 'data_types']
      },
      outputPath: 'validation_result',
      success: 'check_approval_needed',
      error: 'validation_failed',
      retryPolicy: {
        maxAttempts: 3,
        initialInterval: '1s',
        backoffMultiplier: 2
      }
    },
    check_approval_needed: {
      type: 'condition',
      condition: '{{state.validation_result.amount}} > 1000',
      onTrue: 'manager_approval',
      onFalse: 'auto_approve'
    },
    manager_approval: {
      type: 'user_task',
      taskType: 'approval',
      assignee: 'manager@company.com',
      timeout: '2 minutes',
      form: {
        title: 'Approval Required',
        fields: [
          { name: 'approved', type: 'boolean', required: true },
          { name: 'comments', type: 'text', required: false }
        ]
      },
      outputPath: 'approval_decision',
      success: 'process_approval_decision',
      timeout_action: 'escalate_approval',
      error: 'approval_failed'
    },
    escalate_approval: {
      type: 'user_task',
      taskType: 'escalation',
      assignee: 'director@company.com',
      timeout: '5 minutes',
      form: {
        title: 'Escalated Approval',
        fields: [
          { name: 'approved', type: 'boolean', required: true },
          { name: 'escalation_reason', type: 'text', required: true }
        ]
      },
      outputPath: 'escalation_decision',
      success: 'process_approval_decision',
      timeout_action: 'auto_reject',
      error: 'approval_failed'
    },
    process_approval_decision: {
      type: 'condition',
      condition: '{{state.approval_decision.approved}} || {{state.escalation_decision.approved}}',
      onTrue: 'parallel_processing',
      onFalse: 'reject_request'
    },
    parallel_processing: {
      type: 'parallel',
      branches: {
        notification_branch: {
          initialStep: 'send_notification',
          steps: {
            send_notification: {
              type: 'activity',
              activity: 'sendNotification',
              params: {
                recipient: '{{trigger.requester}}',
                message: 'Your request has been approved',
                type: 'approval'
              },
              success: 'notification_complete'
            },
            notification_complete: {
              type: 'end'
            }
          }
        },
        processing_branch: {
          initialStep: 'process_request',
          steps: {
            process_request: {
              type: 'activity',
              activity: 'processRequest',
              params: {
                requestId: '{{trigger.requestId}}',
                data: '{{state.validation_result}}'
              },
              success: 'create_audit',
              error: 'processing_failed'
            },
            create_audit: {
              type: 'activity',
              activity: 'createAuditLog',
              params: {
                action: 'request_processed',
                recordId: '{{trigger.requestId}}',
                details: '{{state}}'
              },
              success: 'processing_complete'
            },
            processing_complete: {
              type: 'end'
            },
            processing_failed: {
              type: 'activity',
              activity: 'createAuditLog',
              params: {
                action: 'processing_failed',
                recordId: '{{trigger.requestId}}',
                details: '{{state}}'
              },
              success: 'workflow_failed'
            }
          }
        }
      },
      waitFor: 'all',
      success: 'workflow_complete',
      error: 'workflow_failed'
    },
    auto_approve: {
      type: 'activity',
      activity: 'processRequest',
      params: {
        requestId: '{{trigger.requestId}}',
        data: '{{state.validation_result}}'
      },
      outputPath: 'auto_process_result',
      success: 'workflow_complete',
      error: 'workflow_failed'
    },
    reject_request: {
      type: 'activity',
      activity: 'createAuditLog',
      params: {
        action: 'request_rejected',
        recordId: '{{trigger.requestId}}',
        details: '{{state}}'
      },
      success: 'workflow_complete'
    },
    validation_failed: {
      type: 'activity',
      activity: 'createAuditLog',
      params: {
        action: 'validation_failed',
        recordId: '{{trigger.requestId}}',
        details: '{{state}}'
      },
      success: 'workflow_failed'
    },
    approval_failed: {
      type: 'activity',
      activity: 'createAuditLog',
      params: {
        action: 'approval_failed',
        recordId: '{{trigger.requestId}}',
        details: '{{state}}'
      },
      success: 'workflow_failed'
    },
    workflow_complete: {
      type: 'end'
    },
    workflow_failed: {
      type: 'end'
    }
  }
};

// Simple workflow for basic testing
const simpleWorkflow: WorkflowDefinition = {
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
      outputPath: 'validation',
      success: 'complete'
    },
    complete: {
      type: 'end'
    }
  }
};

// Timeout test workflow
const timeoutWorkflow: WorkflowDefinition = {
  workflowId: 'timeout_test',
  name: 'Timeout Test Workflow',
  version: '1.0',
  initialStep: 'quick_task',
  steps: {
    quick_task: {
      type: 'user_task',
      taskType: 'approval',
      assignee: 'test@example.com',
      timeout: '1s', // Very short timeout
      form: {
        title: 'Quick Task',
        fields: [{ name: 'approved', type: 'boolean', required: true }]
      },
      outputPath: 'task_result',
      success: 'task_completed',
      timeout_action: 'task_timeout'
    },
    task_completed: {
      type: 'end'
    },
    task_timeout: {
      type: 'activity',
      activity: 'createAuditLog',
      params: {
        action: 'task_timeout',
        recordId: '{{trigger.requestId}}',
        details: 'Task timed out as expected'
      },
      success: 'complete'
    },
    complete: {
      type: 'end'
    }
  }
};

// Retry test workflow
const retryWorkflow: WorkflowDefinition = {
  workflowId: 'retry_test',
  name: 'Retry Test Workflow',
  version: '1.0',
  initialStep: 'failing_activity',
  steps: {
    failing_activity: {
      type: 'activity',
      activity: 'validateInput',
      params: {
        data: '{{trigger.data}}'
      },
      outputPath: 'result',
      success: 'complete',
      error: 'handle_error',
      retryPolicy: {
        maxAttempts: 2,
        initialInterval: '100ms',
        backoffMultiplier: 2
      }
    },
    handle_error: {
      type: 'activity',
      activity: 'createAuditLog',
      params: {
        action: 'activity_failed_after_retries',
        recordId: '{{trigger.requestId}}',
        details: 'Activity failed after all retries'
      },
      success: 'complete'
    },
    complete: {
      type: 'end'
    }
  }
};

/**
 * Test Suite
 */
describe('Workflow Integration POC', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  beforeEach(() => {
    // Clear tasks before each test
    clearAllTasks();
  });

  describe('Core Workflow Execution', () => {
    test('should execute simple workflow successfully', async () => {
      const { client, nativeConnection } = testEnv;
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('./poc-workflow'),
        activities,
      });

      const startTime = Date.now();

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(pocJsonWorkflow, {
          args: [{
            workflowDefinition: simpleWorkflow,
            trigger: {
              data: { amount: 500, requester: 'test@example.com' },
              requestId: 'req_simple_test'
            }
          }],
          taskQueue: 'test',
          workflowId: 'test-simple',
        });

        const result = await handle.result();
        const executionTime = Date.now() - startTime;

        expect(result.status).toBe('completed');
        expect(result.finalState.validation).toBeDefined();
        expect(result.finalState.validation.isValid).toBe(true);
        expect(executionTime).toBeLessThan(1000); // Should complete quickly
        expect(result.stepCount).toBe(2); // validate + complete
      });
    });

    test('should handle auto-approval path for small amounts', async () => {
      const { client, nativeConnection } = testEnv;
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('./poc-workflow'),
        activities,
      });

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(pocJsonWorkflow, {
          args: [{
            workflowDefinition: testWorkflow,
            trigger: {
              data: { amount: 500, requester: 'test@example.com' },
              requestId: 'req_auto_approve'
            }
          }],
          taskQueue: 'test',
          workflowId: 'test-auto-approve',
        });

        const result = await handle.result();

        expect(result.status).toBe('completed');
        expect(result.finalState.validation_result.amount).toBe(500);
        expect(result.finalState.auto_process_result).toBeDefined();
        expect(result.finalState.auto_process_result.processed).toBe(true);
      });
    });
  });

  describe('User Task Handling', () => {
    test('should await user task completion', async () => {
      const { client, nativeConnection } = testEnv;
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('./poc-workflow'),
        activities,
      });

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(pocJsonWorkflow, {
          args: [{
            workflowDefinition: testWorkflow,
            trigger: {
              data: { amount: 1500, requester: 'test@example.com' },
              requestId: 'req_user_task'
            }
          }],
          taskQueue: 'test',
          workflowId: 'test-user-task',
        });

        // Wait a bit for the user task to be created
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check that a task was created
        const pendingTasks = getPendingTasks();
        expect(pendingTasks.length).toBeGreaterThan(0);
        expect(pendingTasks[0].taskType).toBe('approval');
        expect(pendingTasks[0].assignee).toBe('manager@company.com');

        const result = await handle.result();

        expect(result.status).toBe('completed');
        expect(result.finalState.approval_decision).toBeDefined();
        expect(result.finalState.approval_decision.approved).toBeDefined();
      });
    });

    test('should handle user task timeout and escalation', async () => {
      const { client, nativeConnection } = testEnv;
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('./poc-workflow'),
        activities,
      });

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(pocJsonWorkflow, {
          args: [{
            workflowDefinition: timeoutWorkflow,
            trigger: {
              data: { amount: 1500, requester: 'test@example.com' },
              requestId: 'req_timeout_test'
            }
          }],
          taskQueue: 'test',
          workflowId: 'test-timeout',
        });

        const result = await handle.result();

        expect(result.status).toBe('completed');
        // Should have gone through timeout path
        expect(result.stepCount).toBeGreaterThan(2);
      });
    });

    test('should handle manual task completion', async () => {
      const { client, nativeConnection } = testEnv;
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('./poc-workflow'),
        activities,
      });

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(pocJsonWorkflow, {
          args: [{
            workflowDefinition: testWorkflow,
            trigger: {
              data: { amount: 2000, requester: 'test@example.com' },
              requestId: 'req_manual_complete'
            }
          }],
          taskQueue: 'test',
          workflowId: 'test-manual-complete',
        });

        // Wait for task creation
        await new Promise(resolve => setTimeout(resolve, 200));

        // Manually complete the task
        const pendingTasks = getPendingTasks();
        expect(pendingTasks.length).toBeGreaterThan(0);

        const taskId = pendingTasks[0].id;
        const completed = completeTask(taskId, {
          approved: true,
          comments: 'Manually approved for testing',
          approver: 'manager@company.com'
        });

        expect(completed).toBe(true);

        const result = await handle.result();

        expect(result.status).toBe('completed');
        expect(result.finalState.approval_decision.approved).toBe(true);
        expect(result.finalState.approval_decision.comments).toBe('Manually approved for testing');
      });
    });
  });

  describe('State Management', () => {
    test('should interpolate state values correctly', async () => {
      const { client, nativeConnection } = testEnv;
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('./poc-workflow'),
        activities,
      });

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(pocJsonWorkflow, {
          args: [{
            workflowDefinition: testWorkflow,
            trigger: {
              data: { amount: 750, requester: 'alice@example.com' },
              requestId: 'req_state_test'
            }
          }],
          taskQueue: 'test',
          workflowId: 'test-state',
        });

        const result = await handle.result();

        expect(result.status).toBe('completed');
        expect(result.finalState.trigger.data.amount).toBe(750);
        expect(result.finalState.trigger.requestId).toBe('req_state_test');
        expect(result.finalState.validation_result.amount).toBe(750);
        expect(result.finalState.auto_process_result.result.requestId).toBe('req_state_test');
      });
    });

    test('should maintain state across workflow steps', async () => {
      const { client, nativeConnection } = testEnv;
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('./poc-workflow'),
        activities,
      });

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(pocJsonWorkflow, {
          args: [{
            workflowDefinition: testWorkflow,
            trigger: {
              data: { amount: 1200, requester: 'bob@example.com' },
              requestId: 'req_state_persistence'
            },
            initialState: {
              customData: 'test_value',
              timestamp: new Date().toISOString()
            }
          }],
          taskQueue: 'test',
          workflowId: 'test-state-persistence',
        });

        const result = await handle.result();

        expect(result.status).toBe('completed');
        expect(result.finalState.customData).toBe('test_value');
        expect(result.finalState.timestamp).toBeDefined();
        expect(result.finalState._metadata).toBeDefined();
        expect(result.finalState._metadata.workflowId).toBe('poc_test_workflow');
      });
    });
  });

  describe('Condition Evaluation', () => {
    test('should evaluate conditions correctly', async () => {
      const { client, nativeConnection } = testEnv;
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('./poc-workflow'),
        activities,
      });

      // Test condition that should be true
      await worker.runUntil(async () => {
        const handle = await client.workflow.start(pocJsonWorkflow, {
          args: [{
            workflowDefinition: testWorkflow,
            trigger: {
              data: { amount: 1500, requester: 'test@example.com' },
              requestId: 'req_condition_true'
            }
          }],
          taskQueue: 'test',
          workflowId: 'test-condition-true',
        });

        const result = await handle.result();

        expect(result.status).toBe('completed');
        // Should have gone through approval path (amount > 1000)
        expect(result.finalState.approval_decision).toBeDefined();
      });

      // Test condition that should be false
      await worker.runUntil(async () => {
        const handle = await client.workflow.start(pocJsonWorkflow, {
          args: [{
            workflowDefinition: testWorkflow,
            trigger: {
              data: { amount: 800, requester: 'test@example.com' },
              requestId: 'req_condition_false'
            }
          }],
          taskQueue: 'test',
          workflowId: 'test-condition-false',
        });

        const result = await handle.result();

        expect(result.status).toBe('completed');
        // Should have gone through auto-approval path (amount <= 1000)
        expect(result.finalState.auto_process_result).toBeDefined();
      });
    });
  });

  describe('Parallel Execution', () => {
    test('should execute parallel branches correctly', async () => {
      const { client, nativeConnection } = testEnv;
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('./poc-workflow'),
        activities,
      });

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(pocJsonWorkflow, {
          args: [{
            workflowDefinition: testWorkflow,
            trigger: {
              data: { amount: 1500, requester: 'test@example.com' },
              requestId: 'req_parallel_test'
            }
          }],
          taskQueue: 'test',
          workflowId: 'test-parallel',
        });

        const result = await handle.result();

        expect(result.status).toBe('completed');
        expect(result.finalState.approval_decision).toBeDefined();
        
        // Should have parallel execution results
        // The parallel step should have executed both branches
        expect(result.stepCount).toBeGreaterThan(5);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle activity failures with retries', async () => {
      // Create a workflow that will fail validation
      const failingWorkflow = {
        ...retryWorkflow,
        steps: {
          ...retryWorkflow.steps,
          failing_activity: {
            ...retryWorkflow.steps.failing_activity,
            params: {
              data: null // This will cause validation to fail
            }
          }
        }
      };

      const { client, nativeConnection } = testEnv;
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('./poc-workflow'),
        activities: {
          ...activities,
          validateInput: async (params: any) => {
            if (!params.data) {
              throw new Error('Data is required');
            }
            return activities.validateInput(params);
          }
        },
      });

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(pocJsonWorkflow, {
          args: [{
            workflowDefinition: failingWorkflow,
            trigger: {
              data: null,
              requestId: 'req_retry_test'
            }
          }],
          taskQueue: 'test',
          workflowId: 'test-retry',
        });

        const result = await handle.result();

        expect(result.status).toBe('completed');
        // Should have gone through error handling path
        expect(result.stepCount).toBeGreaterThan(1);
      });
    });

    test('should handle validation errors gracefully', async () => {
      const { client, nativeConnection } = testEnv;
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('./poc-workflow'),
        activities,
      });

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(pocJsonWorkflow, {
          args: [{
            workflowDefinition: testWorkflow,
            trigger: {
              data: { requester: 'test@example.com' }, // Missing amount
              requestId: 'req_validation_error'
            }
          }],
          taskQueue: 'test',
          workflowId: 'test-validation-error',
        });

        const result = await handle.result();

        expect(result.status).toBe('completed');
        expect(result.finalState.validation_result.isValid).toBe(false);
        expect(result.finalState.validation_result.errors).toContain('Amount is required');
      });
    });
  });

  describe('Performance Tests', () => {
    test('should execute workflow steps within performance limits', async () => {
      const { client, nativeConnection } = testEnv;
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('./poc-workflow'),
        activities,
      });

      const startTime = Date.now();

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(pocJsonWorkflow, {
          args: [{
            workflowDefinition: simpleWorkflow,
            trigger: {
              data: { amount: 500, requester: 'test@example.com' },
              requestId: 'req_performance_test'
            }
          }],
          taskQueue: 'test',
          workflowId: 'test-performance',
        });

        const result = await handle.result();
        const totalTime = Date.now() - startTime;

        expect(result.status).toBe('completed');
        expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
        
        // Calculate average time per step
        const avgTimePerStep = totalTime / result.stepCount;
        expect(avgTimePerStep).toBeLessThan(100); // Less than 100ms per step
      });
    });

    test('should handle multiple concurrent workflows', async () => {
      const { client, nativeConnection } = testEnv;
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('./poc-workflow'),
        activities,
      });

      const startTime = Date.now();
      const concurrentCount = 5;

      await worker.runUntil(async () => {
        const promises = [];

        for (let i = 0; i < concurrentCount; i++) {
          const promise = client.workflow.start(pocJsonWorkflow, {
            args: [{
              workflowDefinition: simpleWorkflow,
              trigger: {
                data: { amount: 500 + i * 100, requester: `test${i}@example.com` },
                requestId: `req_concurrent_${i}`
              }
            }],
            taskQueue: 'test',
            workflowId: `test-concurrent-${i}`,
          }).then(handle => handle.result());

          promises.push(promise);
        }

        const results = await Promise.all(promises);
        const totalTime = Date.now() - startTime;

        expect(results.length).toBe(concurrentCount);
        results.forEach(result => {
          expect(result.status).toBe('completed');
        });

        // Should handle concurrent workflows efficiently
        expect(totalTime).toBeLessThan(3000); // Less than 3 seconds for 5 workflows
      });
    });
  });

  describe('Reliability Tests', () => {
    test('should maintain consistent behavior across multiple runs', async () => {
      const { client, nativeConnection } = testEnv;
      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('./poc-workflow'),
        activities,
      });

      const runCount = 10;
      const results = [];

      await worker.runUntil(async () => {
        for (let i = 0; i < runCount; i++) {
          const handle = await client.workflow.start(pocJsonWorkflow, {
            args: [{
              workflowDefinition: simpleWorkflow,
              trigger: {
                data: { amount: 500, requester: 'test@example.com' },
                requestId: `req_reliability_${i}`
              }
            }],
            taskQueue: 'test',
            workflowId: `test-reliability-${i}`,
          });

          const result = await handle.result();
          results.push(result);
        }

        // All runs should succeed
        expect(results.length).toBe(runCount);
        results.forEach((result, index) => {
          expect(result.status).toBe('completed');
          expect(result.finalState.validation_result.isValid).toBe(true);
          expect(result.stepCount).toBe(2); // Consistent step count
        });

        // Check for consistent execution patterns
        const stepCounts = results.map(r => r.stepCount);
        const uniqueStepCounts = [...new Set(stepCounts)];
        expect(uniqueStepCounts.length).toBe(1); // All should have same step count
      });
    });
  });
});

/**
 * Performance Measurement Utilities
 */
export const measureWorkflowPerformance = async (
  workflowDefinition: WorkflowDefinition,
  triggerData: any,
  iterations: number = 10
): Promise<{
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  successRate: number;
  avgStepsPerWorkflow: number;
}> => {
  const testEnv = await TestWorkflowEnvironment.createLocal();
  const { client, nativeConnection } = testEnv;
  
  const worker = await Worker.create({
    connection: nativeConnection,
    taskQueue: 'perf-test',
    workflowsPath: require.resolve('./poc-workflow'),
    activities,
  });

  const results = [];
  let successCount = 0;

  await worker.runUntil(async () => {
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        const handle = await client.workflow.start(pocJsonWorkflow, {
          args: [{
            workflowDefinition,
            trigger: {
              ...triggerData,
              requestId: `perf_test_${i}`
            }
          }],
          taskQueue: 'perf-test',
          workflowId: `perf-test-${i}`,
        });

        const result = await handle.result();
        const executionTime = Date.now() - startTime;

        results.push({
          executionTime,
          stepCount: result.stepCount,
          success: result.status === 'completed'
        });

        if (result.status === 'completed') {
          successCount++;
        }
      } catch (error) {
        const executionTime = Date.now() - startTime;
        results.push({
          executionTime,
          stepCount: 0,
          success: false
        });
      }
    }
  });

  await testEnv.teardown();

  const executionTimes = results.map(r => r.executionTime);
  const stepCounts = results.filter(r => r.success).map(r => r.stepCount);

  return {
    avgExecutionTime: executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length,
    minExecutionTime: Math.min(...executionTimes),
    maxExecutionTime: Math.max(...executionTimes),
    successRate: (successCount / iterations) * 100,
    avgStepsPerWorkflow: stepCounts.length > 0 ? stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length : 0
  };
};

/**
 * Run POC validation suite
 */
export const runPOCValidation = async (): Promise<{
  coreFeatures: Record<string, boolean>;
  performance: Record<string, boolean>;
  reliability: Record<string, boolean>;
  overallSuccess: boolean;
}> => {
  console.log('🚀 Running POC Validation Suite...');

  const results = {
    coreFeatures: {
      jsonWorkflowExecution: false,
      userTaskAwait: false,
      timeoutHandling: false,
      stateManagement: false,
      retryPolicies: false,
      successFailureRouting: false,
      parallelExecution: false,
      conditionEvaluation: false
    },
    performance: {
      stepExecutionTime: false,
      stateInterpolationTime: false,
      userTaskCreationTime: false,
      memoryStability: false
    },
    reliability: {
      consistentBehavior: false,
      errorHandling: false,
      temporalStateManagement: false,
      noMemoryLeaks: false
    },
    overallSuccess: false
  };

  try {
    // Run performance tests
    const perfResults = await measureWorkflowPerformance(
      simpleWorkflow,
      { data: { amount: 500, requester: 'test@example.com' } },
      5
    );

    // Evaluate results
    results.coreFeatures.jsonWorkflowExecution = perfResults.successRate === 100;
    results.performance.stepExecutionTime = perfResults.avgExecutionTime / perfResults.avgStepsPerWorkflow < 100;
    results.reliability.consistentBehavior = perfResults.successRate === 100;

    // Calculate overall success
    const allFeatures = [
      ...Object.values(results.coreFeatures),
      ...Object.values(results.performance),
      ...Object.values(results.reliability)
    ];

    results.overallSuccess = allFeatures.every(feature => feature === true);

    console.log('✅ POC Validation Complete');
    console.log('📊 Results:', results);

    return results;
  } catch (error) {
    console.error('❌ POC Validation Failed:', error);
    return results;
  }
};
