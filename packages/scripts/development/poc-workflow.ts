/**
 * Workflow Integration POC - Core Workflow Engine
 * 
 * This file implements the JSON-based dynamic workflow engine using Temporal.
 * It validates the core concept of executing user-defined workflows from JSON definitions.
 */

import { 
  proxyActivities, 
  condition, 
  sleep
} from '@temporalio/workflow';

// Types for workflow definitions
export interface WorkflowDefinition {
  workflowId: string;
  name: string;
  version: string;
  initialStep: string;
  steps: Record<string, WorkflowStep>;
}

export interface WorkflowStep {
  type: 'activity' | 'condition' | 'parallel' | 'user_task' | 'delay' | 'end';
  name?: string;
  
  // Activity fields
  activity?: string;
  params?: Record<string, any>;
  
  // Condition fields
  condition?: string;
  onTrue?: string;
  onFalse?: string;
  
  // Parallel fields
  branches?: Record<string, ParallelBranch>;
  waitFor?: 'all' | 'any';
  
  // User task fields
  taskType?: string;
  assignee?: string;
  timeout?: string;
  form?: UserTaskForm;
  
  // Common routing
  success?: string;
  error?: string;
  timeout_action?: string;
  
  // Output configuration
  outputPath?: string;
  
  // Retry configuration
  retryPolicy?: RetryPolicy;
}

export interface ParallelBranch {
  initialStep: string;
  steps: Record<string, WorkflowStep>;
}

export interface UserTaskForm {
  title: string;
  fields: FormField[];
}

export interface FormField {
  name: string;
  type: string;
  required?: boolean;
}

export interface RetryPolicy {
  maxAttempts: number;
  initialInterval?: string;
  backoffMultiplier?: number;
  maxInterval?: string;
}

export interface WorkflowInput {
  workflowDefinition: WorkflowDefinition;
  trigger: {
    data: Record<string, any>;
    requestId: string;
    requester?: string;
  };
  initialState?: Record<string, any>;
}

export interface StepResult {
  status: 'success' | 'error' | 'timeout';
  data?: any;
  error?: string;
}

// Proxy activities with timeout and retry configuration
const activities = proxyActivities({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
    maximumAttempts: 3,
  },
});

/**
 * Main JSON workflow executor
 * 
 * This workflow takes a JSON workflow definition and executes it step by step,
 * managing state, routing, and error handling according to the definition.
 */
export async function pocJsonWorkflow(input: WorkflowInput) {
  const { workflowDefinition, trigger, initialState = {} } = input;
  
  // Initialize workflow state with trigger data
  let state = { 
    ...initialState, 
    trigger,
    _metadata: {
      workflowId: workflowDefinition.workflowId,
      startedAt: new Date().toISOString(),
      currentStep: workflowDefinition.initialStep
    }
  };
  
  let currentStepId = workflowDefinition.initialStep;
  let stepCount = 0;
  const maxSteps = 100; // Prevent infinite loops
  
  console.log(`Starting workflow: ${workflowDefinition.workflowId}, initial step: ${currentStepId}`);
  
  // Main workflow execution loop
  while (currentStepId && currentStepId !== 'workflow_complete' && stepCount < maxSteps) {
    stepCount++;
    const step = workflowDefinition.steps[currentStepId];
    
    if (!step) {
      throw new Error(`Step not found: ${currentStepId}`);
    }
    
    console.log(`Executing step ${stepCount}: ${currentStepId} (type: ${step.type})`);
    state._metadata.currentStep = currentStepId;
    
    try {
      const result = await executeStep(step, state, currentStepId);
      
      // Update state with step result if outputPath is specified
      if (step.outputPath && result.data !== undefined) {
        state[step.outputPath] = result.data;
        console.log(`Stored result in state.${step.outputPath}:`, result.data);
      }
      
      // Determine next step based on result status
      currentStepId = getNextStep(step, result.status, result);
      console.log(`Next step: ${currentStepId} (based on ${result.status})`);
      
    } catch (error) {
      console.error(`Step ${currentStepId} failed:`, error);
      
      // Handle step failure
      if (step.error) {
        currentStepId = step.error;
        console.log(`Routing to error step: ${currentStepId}`);
      } else {
        // No error handler defined, fail the workflow
        return {
          status: 'failed',
          error: `Step ${currentStepId} failed: ${error.message}`,
          finalState: state,
          completedAt: new Date().toISOString(),
          stepCount
        };
      }
    }
  }
  
  // Check for infinite loop protection
  if (stepCount >= maxSteps) {
    throw new Error(`Workflow exceeded maximum steps (${maxSteps}). Possible infinite loop.`);
  }
  
  return {
    status: currentStepId === 'workflow_complete' ? 'completed' : 'terminated',
    finalState: state,
    completedAt: new Date().toISOString(),
    stepCount
  };
}

/**
 * Execute a single workflow step based on its type
 */
async function executeStep(step: WorkflowStep, state: any, stepId: string): Promise<StepResult> {
  switch (step.type) {
    case 'activity':
      return await executeActivity(step, state);
    
    case 'condition':
      return await executeCondition(step, state);
    
    case 'parallel':
      return await executeParallel(step, state);
    
    case 'user_task':
      return await executeUserTask(step, state);
    
    case 'delay':
      return await executeDelay(step, state);
    
    case 'end':
      return { status: 'success', data: { message: 'Workflow completed successfully' } };
    
    default:
      throw new Error(`Unknown step type: ${step.type}`);
  }
}

/**
 * Execute an activity step
 */
async function executeActivity(step: WorkflowStep, state: any): Promise<StepResult> {
  if (!step.activity) {
    throw new Error('Activity step missing activity name');
  }
  
  // Interpolate parameters with current state
  const params = interpolateParams(step.params || {}, state);
  
  console.log(`Calling activity: ${step.activity} with params:`, params);
  
  try {
    const result = await activities[step.activity](params);
    console.log(`Activity ${step.activity} completed:`, result);
    
    return {
      status: 'success',
      data: result
    };
  } catch (error) {
    console.error(`Activity ${step.activity} failed:`, error);
    throw error;
  }
}

/**
 * Execute a condition step
 */
async function executeCondition(step: WorkflowStep, state: any): Promise<StepResult> {
  if (!step.condition) {
    throw new Error('Condition step missing condition expression');
  }
  
  // Interpolate condition with current state
  const interpolatedCondition = interpolateString(step.condition, state);
  console.log(`Evaluating condition: ${step.condition} -> ${interpolatedCondition}`);
  
  try {
    // Use evaluateCondition activity for safe evaluation
    const result = await activities.evaluateCondition({
      condition: interpolatedCondition,
      data: state
    });
    
    console.log(`Condition result: ${result}`);
    
    // Determine next step based on condition result
    const nextStep = result ? step.onTrue : step.onFalse;
    
    return {
      status: 'success',
      data: { conditionResult: result, evaluatedCondition: interpolatedCondition, nextStep }
    };
  } catch (error) {
    console.error(`Condition evaluation failed:`, error);
    throw error;
  }
}

/**
 * Execute a user task step
 */
async function executeUserTask(step: WorkflowStep, state: any): Promise<StepResult> {
  if (!step.assignee || !step.taskType) {
    throw new Error('User task step missing required fields (assignee, taskType)');
  }
  
  // Interpolate assignee and other fields
  const assignee = interpolateString(step.assignee, state);
  const taskParams = {
    assignee,
    taskType: step.taskType,
    form: step.form,
    data: state,
    timeout: step.timeout || '7 days'
  };
  
  console.log(`Creating user task for: ${assignee}, type: ${step.taskType}`);
  
  // Create the user task
  const taskId = await activities.createUserTask(taskParams);
  console.log(`User task created with ID: ${taskId}`);
  
  // Parse timeout
  const timeoutMs = parseTimeout(step.timeout || '7 days');
  console.log(`Waiting for task completion with timeout: ${timeoutMs}ms`);
  
  try {
    // Wait for task completion with timeout
    const result = await condition(
      async () => {
        const taskResult = await activities.isTaskCompleted(taskId);
        return taskResult !== false ? taskResult : undefined;
      },
      timeoutMs
    );
    
    console.log(`User task completed:`, result);
    
    return {
      status: 'success',
      data: result
    };
  } catch (error) {
    if (error.name === 'TimeoutError') {
      console.log(`User task timed out after ${timeoutMs}ms`);
      return {
        status: 'timeout',
        data: { taskId, error: 'Task timed out' }
      };
    }
    throw error;
  }
}

/**
 * Execute a parallel step
 */
async function executeParallel(step: WorkflowStep, state: any): Promise<StepResult> {
  if (!step.branches) {
    throw new Error('Parallel step missing branches');
  }
  
  console.log(`Starting parallel execution with ${Object.keys(step.branches).length} branches`);
  
  // Create promises for each branch
  const branchPromises = Object.entries(step.branches).map(([branchId, branch]) =>
    executeBranch(branchId, branch, state)
  );
  
  let results: any;
  
  try {
    if (step.waitFor === 'any') {
      console.log('Waiting for any branch to complete');
      results = await Promise.race(branchPromises);
    } else {
      // Default to 'all'
      console.log('Waiting for all branches to complete');
      results = await Promise.all(branchPromises);
    }
    
    console.log('Parallel execution completed:', results);
    
    return {
      status: 'success',
      data: results
    };
  } catch (error) {
    console.error('Parallel execution failed:', error);
    throw error;
  }
}

/**
 * Execute a single branch in parallel execution
 */
async function executeBranch(branchId: string, branch: ParallelBranch, state: any): Promise<any> {
  console.log(`Executing branch: ${branchId}`);
  
  // Create a mini-workflow for this branch
  const branchWorkflow: WorkflowDefinition = {
    workflowId: `${state._metadata.workflowId}_branch_${branchId}`,
    name: `Branch ${branchId}`,
    version: '1.0',
    initialStep: branch.initialStep,
    steps: branch.steps
  };
  
  // Execute the branch as a sub-workflow
  let currentStepId = branch.initialStep;
  let branchState = { ...state }; // Copy state for branch isolation
  let stepCount = 0;
  const maxSteps = 50; // Prevent infinite loops in branches
  
  while (currentStepId && currentStepId !== 'workflow_complete' && stepCount < maxSteps) {
    stepCount++;
    const step = branch.steps[currentStepId];
    
    if (!step) {
      throw new Error(`Branch ${branchId}: Step not found: ${currentStepId}`);
    }
    
    const result = await executeStep(step, branchState, currentStepId);
    
    if (step.outputPath && result.data !== undefined) {
      branchState[step.outputPath] = result.data;
    }
    
    currentStepId = getNextStep(step, result.status);
  }
  
  return {
    branchId,
    finalState: branchState,
    stepCount
  };
}

/**
 * Execute a delay step
 */
async function executeDelay(step: WorkflowStep, state: any): Promise<StepResult> {
  const duration = step.params?.duration || '30s';
  const delayMs = parseTimeout(duration);
  
  console.log(`Delaying for ${duration} (${delayMs}ms)`);
  
  await sleep(delayMs);
  
  return {
    status: 'success',
    data: { delayed: duration, delayMs }
  };
}

/**
 * Determine the next step based on the current step and result status
 */
function getNextStep(step: WorkflowStep, status: 'success' | 'error' | 'timeout', result?: any): string | null {
  switch (status) {
    case 'success':
      if (step.type === 'condition') {
        // For conditions, use the condition result to determine next step
        if (result && result.data && typeof result.data.conditionResult === 'boolean') {
          return result.data.conditionResult ? step.onTrue : step.onFalse;
        }
        // Fallback to onFalse if we can't determine the result
        return step.onFalse || 'workflow_complete';
      }
      return step.success || 'workflow_complete';
    
    case 'error':
      return step.error || null;
    
    case 'timeout':
      return step.timeout_action || step.error || null;
    
    default:
      return null;
  }
}

/**
 * Interpolate parameters with state values using {{}} syntax
 */
function interpolateParams(params: Record<string, any>, state: any): Record<string, any> {
  const result = {};
  
  for (const [key, value] of Object.entries(params)) {
    result[key] = interpolateValue(value, state);
  }
  
  return result;
}

/**
 * Recursively interpolate a value (string, object, array, etc.)
 */
function interpolateValue(value: any, state: any): any {
  if (typeof value === 'string') {
    return interpolateString(value, state);
  } else if (Array.isArray(value)) {
    return value.map(item => interpolateValue(item, state));
  } else if (value && typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = interpolateValue(v, state);
    }
    return result;
  } else {
    return value;
  }
}

/**
 * Interpolate string with {{}} placeholders
 */
function interpolateString(str: string, state: any): any {
  // Check if the entire string is a single interpolation
  const singleInterpolationMatch = str.match(/^\{\{([^}]+)\}\}$/);
  if (singleInterpolationMatch) {
    // Return the actual value, not a string representation
    const path = singleInterpolationMatch[1].trim();
    const value = getNestedValue(state, path);
    return value !== undefined ? value : str;
  }
  
  // Handle multiple interpolations in a string
  return str.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getNestedValue(state, path.trim());
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Parse timeout string to milliseconds
 */
function parseTimeout(timeout: string): number {
  const match = timeout.match(/^(\d+)\s*(s|m|h|d)?$/);
  if (!match) {
    throw new Error(`Invalid timeout format: ${timeout}`);
  }
  
  const value = parseInt(match[1]);
  const unit = match[2] || 's';
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return value * 1000;
  }
}
