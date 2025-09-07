// Workflow Execution Service
// Handles starting, monitoring, and managing workflow executions with Temporal

import { getTemporalClient, startWorkflow, getWorkflowStatus, cancelWorkflow, signalWorkflow } from '../../utils/temporal';
import { 
  createWorkflowExecution, 
  updateWorkflowExecution, 
  getWorkflowDefinition,
  createUserTask,
  WorkflowExecution 
} from './workflow-service';
import { ensureWorkflowTables } from '../../database/utils/workflow-migration';

export interface TriggerWorkflowRequest {
  workflowSlug: string;
  triggerData?: any;
  userId?: string;
}

export interface WorkflowExecutionResult {
  executionId: string;
  temporalWorkflowId: string;
  temporalRunId: string;
  status: 'started' | 'running' | 'completed' | 'failed';
  message: string;
}

/**
 * Trigger a workflow execution
 */
export const triggerWorkflowExecution = async (
  companyId: string,
  userId: string,
  request: TriggerWorkflowRequest
): Promise<WorkflowExecutionResult> => {
  try {
    // Ensure workflow tables exist for this tenant
    await ensureWorkflowTables(companyId);
    
    // Get workflow definition
    const workflowDef = await getWorkflowDefinition(companyId, request.workflowSlug, userId);
    if (!workflowDef) {
      throw new Error(`Workflow '${request.workflowSlug}' not found`);
    }

    if (workflowDef.status !== 'active') {
      throw new Error(`Workflow '${request.workflowSlug}' is not active`);
    }

    // Generate unique workflow ID
    const temporalWorkflowId = `${companyId}_${request.workflowSlug}_${Date.now()}`;
    
    // Prepare workflow context
    const workflowContext = {
      companyId,
      userId: request.userId || userId,
      triggerData: request.triggerData,
    };

    try {
      // Start workflow in Temporal
      const { workflowId, runId } = await startWorkflow(
        'dynamicWorkflow',
        temporalWorkflowId,
        [workflowDef.definition, workflowContext],
        {
          taskQueue: 'docpal-workflows',
          workflowExecutionTimeout: '1h',
          workflowRunTimeout: '30m',
        }
      );
      console.log('Workflow execution started successfully', { workflowId, runId });
      // Create execution record in database
      const execution = await createWorkflowExecution(companyId, {
        workflow_definition_id: workflowDef.id,
        definition: workflowDef.definition,
        temporal_workflow_id: workflowId,
        temporal_run_id: runId,
        trigger_data: request.triggerData,
      });

      return {
        executionId: execution.id,
        temporalWorkflowId: workflowId,
        temporalRunId: runId,
        status: 'started',
        message: 'Workflow execution started successfully',
      };

    } catch (temporalError) {
      console.warn('Temporal not available, creating execution record only:', temporalError);
      
      // If Temporal is not available, create a mock execution
      const execution = await createWorkflowExecution(companyId, {
        workflow_definition_id: workflowDef.id,
        definition: workflowDef.definition,
        temporal_workflow_id: temporalWorkflowId,
        temporal_run_id: `run_${Date.now()}`,
        trigger_data: request.triggerData,
      });

      // Update status to indicate Temporal unavailability
      await updateWorkflowExecution(
        companyId,
        execution.id,
        'failed',
        null,
        'Temporal server not available'
      );

      return {
        executionId: execution.id,
        temporalWorkflowId: temporalWorkflowId,
        temporalRunId: `run_${Date.now()}`,
        status: 'failed',
        message: 'Workflow execution created but Temporal server not available',
      };
    }

  } catch (error) {
    console.error('Error triggering workflow:', error);
    throw error;
  }
};

/**
 * Get workflow execution status from Temporal and update database
 */
export const syncWorkflowExecutionStatus = async (
  companyId: string,
  executionId: string
): Promise<WorkflowExecution> => {
  try {
    // Get execution from database
    const execution = await getWorkflowExecution(companyId, executionId);
    if (!execution) {
      throw new Error('Workflow execution not found');
    }

    try {
      // Get status from Temporal
      const temporalStatus = await getWorkflowStatus(execution.temporal_workflow_id);
      
      // Map Temporal status to our status
      let dbStatus: WorkflowExecution['status'];
      switch (temporalStatus.status) {
        case 'RUNNING':
          dbStatus = 'running';
          break;
        case 'COMPLETED':
          dbStatus = 'completed';
          break;
        case 'FAILED':
          dbStatus = 'failed';
          break;
        case 'CANCELED':
          dbStatus = 'cancelled';
          break;
        case 'TERMINATED':
          dbStatus = 'terminated';
          break;
        default:
          dbStatus = 'running';
      }

      // Update database if status changed
      if (execution.status !== dbStatus) {
        return await updateWorkflowExecution(
          companyId,
          executionId,
          dbStatus,
          temporalStatus.result,
          temporalStatus.error
        );
      }

      return execution;

    } catch (temporalError) {
      console.warn('Could not sync with Temporal:', temporalError);
      return execution; // Return current database state
    }

  } catch (error) {
    console.error('Error syncing workflow execution status:', error);
    throw error;
  }
};

/**
 * Cancel a workflow execution
 */
export const cancelWorkflowExecution = async (
  companyId: string,
  executionId: string,
  reason?: string
): Promise<WorkflowExecution> => {
  try {
    // Get execution from database
    const execution = await getWorkflowExecution(companyId, executionId);
    if (!execution) {
      throw new Error('Workflow execution not found');
    }

    if (execution.status !== 'running') {
      throw new Error(`Cannot cancel workflow in status: ${execution.status}`);
    }

    try {
      // Cancel in Temporal
      await cancelWorkflow(execution.temporal_workflow_id, reason);
    } catch (temporalError) {
      console.warn('Could not cancel in Temporal:', temporalError);
    }

    // Update database status
    return await updateWorkflowExecution(
      companyId,
      executionId,
      'cancelled',
      null,
      reason || 'Cancelled by user'
    );

  } catch (error) {
    console.error('Error cancelling workflow execution:', error);
    throw error;
  }
};

/**
 * Complete a user task and signal the workflow
 */
export const completeWorkflowUserTask = async (
  companyId: string,
  taskId: string,
  userId: string,
  result: any
): Promise<{ success: boolean; message: string }> => {
  try {
    // Complete the user task in database
    const task = await completeUserTask(companyId, taskId, userId, result);
    
    // Get the workflow execution
    const execution = await getWorkflowExecution(companyId, task.workflow_execution_id);
    if (!execution) {
      throw new Error('Workflow execution not found');
    }

    try {
      // Signal the workflow in Temporal
      await signalWorkflow(
        execution.temporal_workflow_id,
        'completeUserTask',
        [taskId, result]
      );

      return {
        success: true,
        message: 'User task completed and workflow signaled successfully',
      };

    } catch (temporalError) {
      console.warn('Could not signal Temporal workflow:', temporalError);
      
      return {
        success: true,
        message: 'User task completed in database (Temporal signal failed)',
      };
    }

  } catch (error) {
    console.error('Error completing user task:', error);
    throw error;
  }
};

/**
 * Create a user task for a workflow step
 */
export const createWorkflowUserTask = async (
  companyId: string,
  executionId: string,
  stepId: string,
  taskConfig: {
    assigneeId?: string;
    candidates?: any;
    taskType: string;
    formDefinition?: any;
    contextData?: any;
    timeoutHours?: number;
  }
): Promise<any> => {
  try {
    const timeoutAt = taskConfig.timeoutHours 
      ? new Date(Date.now() + taskConfig.timeoutHours * 60 * 60 * 1000).toISOString()
      : undefined;

    return await createUserTask(companyId, {
      workflow_execution_id: executionId,
      step_id: stepId,
      assignee_id: taskConfig.assigneeId,
      candidate: taskConfig.candidates,
      task_type: taskConfig.taskType,
      form_definition: taskConfig.formDefinition,
      context_data: taskConfig.contextData,
      timeout_at: timeoutAt,
    });

  } catch (error) {
    console.error('Error creating workflow user task:', error);
    throw error;
  }
};

// Import the missing functions
import { getWorkflowExecution, completeUserTask } from './workflow-service';
