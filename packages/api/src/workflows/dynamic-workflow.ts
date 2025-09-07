// Dynamic Workflow Implementation
// Executes JSON-based workflow definitions using Temporal

import { 
  proxyActivities, 
  defineSignal, 
  defineQuery, 
  setHandler, 
  condition, 
  sleep 
} from '@temporalio/workflow';
import type * as activities from './activities';

// Create activity proxies
const {
  updateRecord,
  createRecord,
  queryRecords,
  sendEmail,
  createNotification,
  logError,
  evaluateCondition,
  callWebhook,
  waitForUserTask,
} = proxyActivities({
  startToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '1s',
    maximumInterval: '10s',
    maximumAttempts: 3,
  },
});

// Workflow signals
export const completeUserTaskSignal = defineSignal<[string, any]>('completeUserTask');
export const cancelWorkflowSignal = defineSignal<[string]>('cancelWorkflow');

// Workflow queries
export const getWorkflowStateQuery = defineQuery<any>('getWorkflowState');
export const getCurrentStepQuery = defineQuery<string>('getCurrentStep');

export interface WorkflowDefinition {
  name: string;
  version: string;
  steps: WorkflowStep[];
  variables?: Record<string, any>;
  settings?: {
    timeout?: string;
    retryPolicy?: {
      maximumAttempts?: number;
      initialInterval?: string;
      maximumInterval?: string;
    };
  };
}

export interface WorkflowStep {
  id: string;
  type: 'activity' | 'condition' | 'parallel' | 'userTask' | 'delay';
  name?: string;
  activity?: string;
  parameters?: Record<string, any>;
  input?: Record<string, any>; // Alternative to parameters for activity inputs
  condition?: string;
  onSuccess?: string; // Next step ID
  onFailure?: string; // Next step ID
  onTimeout?: string; // Next step ID
  timeout?: string;
  retryPolicy?: {
    maximumAttempts?: number;
    initialInterval?: string;
    maximumInterval?: string;
  };
  parallel?: {
    branches: WorkflowStep[][];
    waitFor: 'all' | 'any' | number;
  };
  userTask?: {
    assignee?: string;
    candidates?: string[];
    formDefinition?: any;
    timeout?: string;
  };
  delay?: {
    duration: string;
  };
}

export interface WorkflowContext {
  companyId: string;
  userId?: string;
  sessionId?: string;
  triggerData?: any;
}

/**
 * Main dynamic workflow implementation
 */
export async function dynamicWorkflow(
  workflowDefinition: WorkflowDefinition,
  context: WorkflowContext
): Promise<any> {
  console.log('Starting dynamic workflow:', workflowDefinition.name);
  
  // Workflow state
  let currentStep = workflowDefinition.steps[0]?.id || '';
  let workflowState: Record<string, any> = {
    ...workflowDefinition.variables,
    trigger: context.triggerData || {},
    _context: context,
    _startTime: new Date().toISOString(),
  };
  let completed = false;
  let cancelled = false;
  let result: any = null;
  
  // Set up signal handlers
  setHandler(completeUserTaskSignal, (taskId: string, taskResult: any) => {
    console.log(`User task ${taskId} completed with result:`, taskResult);
    workflowState[`task_${taskId}_result`] = taskResult;
    workflowState[`task_${taskId}_completed`] = true;
  });
  
  setHandler(cancelWorkflowSignal, (reason: string) => {
    console.log('Workflow cancelled:', reason);
    cancelled = true;
  });
  
  // Set up query handlers
  setHandler(getWorkflowStateQuery, () => workflowState);
  setHandler(getCurrentStepQuery, () => currentStep);
  
  try {
    // Execute workflow steps
    while (!completed && !cancelled && currentStep) {
      const step = workflowDefinition.steps.find(s => s.id === currentStep);
      if (!step) {
        throw new Error(`Step not found: ${currentStep}`);
      }
      
      console.log(`Executing step: ${step.id} (${step.type})`);
      
      try {
        const stepResult = await executeStep(step, workflowState, context);
        workflowState[`step_${step.id}_result`] = stepResult;
        workflowState[`step_${step.id}_completed`] = true;
        
        // Determine next step
        const nextStep = step.onSuccess || getNextStepId(workflowDefinition.steps, step.id);
        currentStep = nextStep || '';
        
        if (!currentStep) {
          completed = true;
          result = stepResult;
        }
        
      } catch (error) {
        console.log(`Error in step ${step.id}:`, error);
        workflowState[`step_${step.id}_error`] = error instanceof Error ? error.message : 'Unknown error';
        
        // Handle failure
        if (step.onFailure) {
          currentStep = step.onFailure;
        } else {
          throw error; // Re-throw if no failure handler
        }
      }
    }
    
    if (cancelled) {
      result = { status: 'cancelled', reason: 'Workflow was cancelled' };
    } else if (completed) {
      result = { status: 'completed', data: result, finalState: workflowState };
    }
    
    workflowState._endTime = new Date().toISOString();
    workflowState._result = result;
    
    console.log('Workflow completed:', result);
    return result;
    
  } catch (error) {
    console.log('Workflow failed:', error);
    
    // // Log error
    // await logError(context, error instanceof Error ? error.message : 'Unknown error', {
    //   step: currentStep,
    //   state: workflowState,
    // });
    
    throw error;
  }
}

/**
 * Execute a single workflow step
 */
async function executeStep(
  step: WorkflowStep, 
  state: Record<string, any>, 
  context: WorkflowContext
): Promise<any> {
  
  // Interpolate parameters (support both 'parameters' and 'input' for backward compatibility)
  const stepInput = step.parameters || step.input || {};
  console.log('Step input before interpolation:', stepInput);
  console.log('Workflow state for interpolation:', state);
  const parameters = interpolateParameters(stepInput, state);
  console.log('Executing step:', step.type, 'with parameters:', parameters);
  switch (step.type) {
    case 'activity':
      return await executeActivity(step.activity!, parameters, context);
      
    case 'condition':
      const conditionResult = await evaluateCondition(
        context,
        step.condition!,
        state
      );
      return { conditionMet: conditionResult };
      
    case 'userTask':
      return await executeUserTask(step, parameters, context);
      
    case 'delay':
      const duration = step.delay?.duration || '1s';
      await sleep(duration as any); // Duration type conversion
      return { delayed: duration };
      
    case 'parallel':
      return await executeParallel(step, state, context);
      
    default:
      throw new Error(`Unknown step type: ${step.type}`);
  }
}

/**
 * Execute an activity step
 */
async function executeActivity(
  activityName: string,
  parameters: Record<string, any>,
  context: WorkflowContext
): Promise<any> {
  
  switch (activityName) {
    case 'updateRecord':
      return await updateRecord(
        context,
        parameters.tableName || parameters.table_name,
        parameters.recordId || parameters.record_id,
        parameters.data
      );
      
    case 'createRecord':
      return await createRecord(
        context,
        parameters.tableName || parameters.table_name,
        parameters.data
      );
      
    case 'queryRecords':
      return await queryRecords(
        context,
        parameters.tableName || parameters.table_name,
        parameters.conditions,
        parameters.limit
      );
      
    case 'sendEmail':
      return await sendEmail(
        context,
        parameters.to,
        parameters.subject,
        parameters.body,
        parameters.template
      );
      
    case 'createNotification':
      return await createNotification(
        context,
        parameters.userId,
        parameters.title,
        parameters.message,
        parameters.type
      );
      
    case 'callWebhook':
      return await callWebhook(
        context,
        parameters.url,
        parameters.method,
        parameters.data,
        parameters.headers
      );
      
    default:
      throw new Error(`Unknown activity: ${activityName}`);
  }
}

/**
 * Execute a user task step
 */
async function executeUserTask(
  step: WorkflowStep,
  parameters: Record<string, any>,
  context: WorkflowContext
): Promise<any> {
  
  const taskId = `${step.id}_${Date.now()}`;
  const timeout = step.userTask?.timeout || '24h';
  
  // TODO: Create user task in database
  console.log(`Creating user task ${taskId}`, {
    assignee: step.userTask?.assignee,
    candidates: step.userTask?.candidates,
    formDefinition: step.userTask?.formDefinition,
    parameters,
  });
  
  // Wait for task completion or timeout
  const timeoutMs = parseTimeout(timeout);
  const taskCompleted = `task_${taskId}_completed`;
  
  const completed = await condition(() => !!parameters[taskCompleted], timeoutMs);
  
  if (completed) {
    return parameters[`task_${taskId}_result`];
  } else {
    throw new Error(`User task ${taskId} timed out after ${timeout}`);
  }
}

/**
 * Execute parallel branches
 */
async function executeParallel(
  step: WorkflowStep,
  state: Record<string, any>,
  context: WorkflowContext
): Promise<any> {
  
  if (!step.parallel) {
    throw new Error('Parallel step missing parallel configuration');
  }
  
  const branches = step.parallel.branches;
  const waitFor = step.parallel.waitFor;
  
  // Execute all branches in parallel
  const branchPromises = branches.map(async (branchSteps, index) => {
    const branchResult: any[] = [];
    
    for (const branchStep of branchSteps) {
      const stepResult = await executeStep(branchStep, state, context);
      branchResult.push(stepResult);
    }
    
    return { branchIndex: index, results: branchResult };
  });
  
  // Wait based on waitFor strategy
  if (waitFor === 'all') {
    const results = await Promise.all(branchPromises);
    return { parallelResults: results };
  } else if (waitFor === 'any') {
    const result = await Promise.race(branchPromises);
    return { parallelResults: [result] };
  } else if (typeof waitFor === 'number') {
    // Wait for N branches to complete
    const results: any[] = [];
    let completed = 0;
    
    await Promise.all(
      branchPromises.map(async (promise) => {
        try {
          const result = await promise;
          if (completed < waitFor) {
            results.push(result);
            completed++;
          }
        } catch (error) {
          // Ignore errors for partial completion
        }
      })
    );
    
    return { parallelResults: results };
  }
  
  throw new Error(`Invalid waitFor strategy: ${waitFor}`);
}

/**
 * Interpolate parameters with state variables
 */
function interpolateParameters(
  parameters: Record<string, any>,
  state: Record<string, any>
): Record<string, any> {
  
  const interpolated: Record<string, any> = {};
  console.log('Interpolating parameters:', parameters, 'with state:', state);
  for (const [key, value] of Object.entries(parameters)) {
    if (typeof value === 'string') {
      // Replace {{variable}} patterns
      interpolated[key] = value.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
        // Support nested properties like trigger.record_id
        const keys = varName.split('.');
        let result = state;
        for (const k of keys) {
          result = result?.[k];
          if (result === undefined) break;
        }
        return result !== undefined ? String(result) : match;
      });
    } else if (typeof value === 'object' && value !== null) {
      // Recursively interpolate objects
      interpolated[key] = interpolateParameters(value, state);
    } else {
      interpolated[key] = value;
    }
  }
  
  return interpolated;
}

/**
 * Get the next step ID in sequence
 */
function getNextStepId(steps: WorkflowStep[], currentStepId: string): string | null {
  const currentIndex = steps.findIndex(s => s.id === currentStepId);
  if (currentIndex >= 0 && currentIndex < steps.length - 1) {
    return steps[currentIndex + 1].id;
  }
  return null;
}

/**
 * Parse timeout string to milliseconds
 */
function parseTimeout(timeout: string): number {
  const match = timeout.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 60000; // Default 1 minute
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 60000;
  }
}
