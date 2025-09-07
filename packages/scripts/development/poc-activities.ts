/**
 * Workflow Integration POC - Mock Activities
 * 
 * This file implements mock activities for testing the JSON workflow engine.
 * These activities simulate real-world operations without external dependencies.
 */

// Types for activity parameters and results
export interface ValidationParams {
  data: Record<string, any>;
  rules?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  amount?: number;
  processedData?: Record<string, any>;
}

export interface UserTaskParams {
  assignee: string;
  taskType: string;
  form?: {
    title: string;
    fields: Array<{
      name: string;
      type: string;
      required?: boolean;
    }>;
  };
  data: Record<string, any>;
  timeout?: string;
}

export interface NotificationParams {
  recipient: string;
  message: string;
  type?: string;
}

export interface ConditionParams {
  condition: string;
  data: Record<string, any>;
}

// In-memory storage for user tasks (simulates database)
const userTasks = new Map<string, {
  id: string;
  assignee: string;
  taskType: string;
  status: 'pending' | 'completed' | 'cancelled';
  result?: any;
  createdAt: Date;
  completedAt?: Date;
}>();

// Counter for generating unique task IDs
let taskIdCounter = 1;

/**
 * Mock Activities Implementation
 */

/**
 * Validates input data according to specified rules
 */
export const validateInput = async (params: ValidationParams): Promise<ValidationResult> => {
  console.log('🔍 Validating input:', params);
  
  // Simulate validation delay
  await sleep(50);
  
  const { data, rules = [] } = params;
  const errors: string[] = [];
  
  // Simulate validation rules
  if (rules.includes('required_fields')) {
    if (!data.amount) errors.push('Amount is required');
    if (!data.requester) errors.push('Requester is required');
  }
  
  if (rules.includes('data_types')) {
    if (data.amount && typeof data.amount !== 'number') {
      errors.push('Amount must be a number');
    }
  }
  
  // Extract amount for workflow logic
  const amount = typeof data.amount === 'number' ? data.amount : 0;
  
  const result: ValidationResult = {
    isValid: errors.length === 0,
    errors,
    amount,
    processedData: {
      ...data,
      validatedAt: new Date().toISOString(),
      validationRules: rules
    }
  };
  
  console.log('✅ Validation result:', result);
  return result;
};

/**
 * Creates a user task and returns the task ID
 */
export const createUserTask = async (params: UserTaskParams): Promise<string> => {
  console.log('📋 Creating user task:', params);
  
  // Simulate task creation delay
  await sleep(30);
  
  const taskId = `task_${taskIdCounter++}`;
  
  const task = {
    id: taskId,
    assignee: params.assignee,
    taskType: params.taskType,
    status: 'pending' as const,
    createdAt: new Date()
  };
  
  userTasks.set(taskId, task);
  
  console.log(`✅ User task created: ${taskId} for ${params.assignee}`);
  
  // Simulate automatic completion for testing (with delay)
  setTimeout(() => {
    completeUserTaskAutomatically(taskId, params.taskType);
  }, getAutoCompleteDelay(params.taskType));
  
  return taskId;
};

/**
 * Checks if a user task is completed and returns the result
 */
export const isTaskCompleted = async (taskId: string): Promise<any> => {
  const task = userTasks.get(taskId);
  
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  
  if (task.status === 'completed') {
    console.log(`✅ Task ${taskId} completed:`, task.result);
    return task.result;
  } else if (task.status === 'cancelled') {
    throw new Error(`Task ${taskId} was cancelled`);
  }
  
  // Still pending
  return false;
};

/**
 * Sends a notification (mock implementation)
 */
export const sendNotification = async (params: NotificationParams): Promise<{ sent: boolean; messageId: string }> => {
  console.log('📧 Sending notification:', params);
  
  // Simulate sending delay
  await sleep(100);
  
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`✅ Notification sent to ${params.recipient}: ${messageId}`);
  
  return {
    sent: true,
    messageId
  };
};

/**
 * Processes a request (mock implementation)
 */
export const processRequest = async (params: { requestId: string; data?: any }): Promise<{ processed: boolean; result: any }> => {
  console.log('⚙️ Processing request:', params);
  
  // Simulate processing delay
  await sleep(200);
  
  const result = {
    processed: true,
    result: {
      requestId: params.requestId,
      processedAt: new Date().toISOString(),
      status: 'completed',
      data: params.data
    }
  };
  
  console.log('✅ Request processed:', result);
  return result;
};

/**
 * Evaluates a condition expression safely
 */
export const evaluateCondition = async (params: ConditionParams): Promise<boolean> => {
  console.log('🧮 Evaluating condition:', params.condition);
  
  // Simulate evaluation delay
  await sleep(10);
  
  try {
    // Simple condition evaluation for POC
    // In production, this would use a safe expression evaluator
    const result = evaluateSimpleCondition(params.condition, params.data);
    console.log(`✅ Condition result: ${result}`);
    return result;
  } catch (error:any) {
    console.error('❌ Condition evaluation failed:', error);
    throw new Error(`Condition evaluation failed: ${error.message}`);
  }
};

/**
 * Updates a record (mock implementation)
 */
export const updateRecord = async (params: {
  recordId: string;
  tableSlug: string;
  updates: Record<string, any>;
}): Promise<{ updated: boolean; record: any }> => {
  console.log('📝 Updating record:', params);
  
  // Simulate database update delay
  await sleep(80);
  
  const result = {
    updated: true,
    record: {
      id: params.recordId,
      ...params.updates,
      updatedAt: new Date().toISOString()
    }
  };
  
  console.log('✅ Record updated:', result);
  return result;
};

/**
 * Creates an audit log entry (mock implementation)
 */
export const createAuditLog = async (params: {
  action: string;
  recordId: string;
  details: any;
}): Promise<{ created: boolean; auditId: string }> => {
  console.log('📊 Creating audit log:', params);
  
  // Simulate audit creation delay
  await sleep(40);
  
  const auditId = `audit_${Date.now()}`;
  
  console.log(`✅ Audit log created: ${auditId}`);
  
  return {
    created: true,
    auditId
  };
};

/**
 * Compliance check activity (mock implementation)
 */
export const complianceCheck = async (params: {
  data: Record<string, any>;
  rules: string[];
}): Promise<{ compliant: boolean; violations: string[] }> => {
  console.log('🛡️ Running compliance check:', params);
  
  // Simulate compliance check delay
  await sleep(150);
  
  const violations: string[] = [];
  
  // Mock compliance rules
  if (params.rules.includes('amount_limit') && params.data.amount > 5000) {
    violations.push('Amount exceeds compliance limit of $5000');
  }
  
  if (params.rules.includes('approval_required') && !params.data.approved) {
    violations.push('Approval required for this type of request');
  }
  
  const result = {
    compliant: violations.length === 0,
    violations
  };
  
  console.log('✅ Compliance check result:', result);
  return result;
};

/**
 * Helper Functions
 */

/**
 * Simple sleep function for simulating delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get auto-completion delay based on task type (for testing)
 */
function getAutoCompleteDelay(taskType: string): number {
  switch (taskType) {
    case 'approval':
      return 3000; // 3 seconds
    case 'escalation':
      return 8000; // 8 seconds (longer than timeout for testing)
    case 'review':
      return 2000; // 2 seconds
    default:
      return 5000; // 5 seconds
  }
}

/**
 * Automatically complete a user task (for testing purposes)
 */
function completeUserTaskAutomatically(taskId: string, taskType: string): void {
  const task = userTasks.get(taskId);
  if (!task || task.status !== 'pending') {
    return;
  }
  
  // Generate mock completion result based on task type
  let result: any;
  
  switch (taskType) {
    case 'approval':
      result = {
        approved: Math.random() > 0.3, // 70% approval rate
        comments: 'Auto-completed for testing',
        approver: task.assignee,
        approvedAt: new Date().toISOString()
      };
      break;
    
    case 'escalation':
      result = {
        approved: Math.random() > 0.5, // 50% approval rate for escalations
        escalation_reason: 'Escalated due to timeout',
        approver: task.assignee,
        approvedAt: new Date().toISOString()
      };
      break;
    
    case 'review':
      result = {
        reviewed: true,
        rating: Math.floor(Math.random() * 5) + 1,
        feedback: 'Auto-generated review for testing',
        reviewer: task.assignee,
        reviewedAt: new Date().toISOString()
      };
      break;
    
    default:
      result = {
        completed: true,
        completedBy: task.assignee,
        completedAt: new Date().toISOString()
      };
  }
  
  task.status = 'completed';
  task.result = result;
  task.completedAt = new Date();
  
  console.log(`🤖 Auto-completed task ${taskId}:`, result);
}

/**
 * Simple condition evaluator for POC (not production-safe)
 */
function evaluateSimpleCondition(condition: string, data: any): boolean {
  // Replace state references with actual values
  let expr = condition.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getNestedValue(data, path.trim());
    
    if (typeof value === 'string') {
      return `"${value}"`;
    } else if (typeof value === 'number') {
      return String(value);
    } else if (typeof value === 'boolean') {
      return String(value);
    } else if (value === null || value === undefined) {
      return 'null';
    } else {
      return JSON.stringify(value);
    }
  });
  
  // Simple evaluation for basic conditions
  try {
    // Allow numbers, operators, and basic comparisons
    const safePattern = /^[0-9\s+\-*/><=!&|()."']+$/;
    const cleanExpr = expr.replace(/true|false|null/g, '');
    
    if (!safePattern.test(cleanExpr)) {
      throw new Error('Unsafe condition expression');
    }
    
    const result = Function(`"use strict"; return (${expr})`)();
    return Boolean(result);
  } catch (error) {
    console.error('Condition evaluation error:', error);
    return false;
  }
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
 * Export all activities for use in tests
 */
export const activities = {
  validateInput,
  createUserTask,
  isTaskCompleted,
  sendNotification,
  processRequest,
  evaluateCondition,
  updateRecord,
  createAuditLog,
  complianceCheck
};

/**
 * Utility function to get all pending tasks (for testing)
 */
export const getPendingTasks = (): Array<{ id: string; assignee: string; taskType: string; createdAt: Date }> => {
  return Array.from(userTasks.values())
    .filter(task => task.status === 'pending')
    .map(task => ({
      id: task.id,
      assignee: task.assignee,
      taskType: task.taskType,
      createdAt: task.createdAt
    }));
};

/**
 * Utility function to manually complete a task (for testing)
 */
export const completeTask = (taskId: string, result: any): boolean => {
  const task = userTasks.get(taskId);
  if (!task || task.status !== 'pending') {
    return false;
  }
  
  task.status = 'completed';
  task.result = result;
  task.completedAt = new Date();
  
  return true;
};

/**
 * Utility function to clear all tasks (for testing)
 */
export const clearAllTasks = (): void => {
  userTasks.clear();
  taskIdCounter = 1;
};
