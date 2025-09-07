import { Pool } from 'pg';
import { getPool, queryInTenantSchema, withTenantTransaction } from '../../database/utils/database';
import { ensureWorkflowTables } from '../../database/utils/workflow-migration';
import { getFGAClient } from '../../utils/openfga';

export interface WorkflowDefinition {
  id: string;
  name: string;
  slug: string;
  version: string;
  definition: any; // JSON workflow definition
  events: any; // JSON event configuration
  status: 'active' | 'inactive' | 'draft';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkflowRequest {
  name: string;
  slug: string;
  version?: string;
  definition: any;
  events?: any;
  status?: 'active' | 'inactive' | 'draft';
}

export interface UpdateWorkflowRequest {
  name?: string;
  definition?: any;
  events?: any;
  status?: 'active' | 'inactive' | 'draft';
}

export interface WorkflowExecution {
  id: string;
  workflow_definition_id: string;
  definition: any; // Snapshot of workflow definition at execution time
  temporal_workflow_id: string;
  temporal_run_id: string;
  trigger_data?: any;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'terminated';
  started_at: string;
  completed_at?: string;
  result?: any;
  error_message?: string;
}

export interface CreateWorkflowExecutionRequest {
  workflow_definition_id: string;
  definition: any;
  temporal_workflow_id: string;
  temporal_run_id: string;
  trigger_data?: any;
}

export interface WorkflowUserTask {
  id: string;
  workflow_execution_id: string;
  step_id: string;
  assignee_id?: string;
  candidate?: any; // JSON array of user/group/role IDs
  task_type: string;
  form_definition?: any;
  context_data?: any;
  status: 'pending' | 'assigned' | 'completed' | 'cancelled' | 'timeout';
  result?: any;
  created_at: string;
  completed_at?: string;
  timeout_at?: string;
}

export interface CreateUserTaskRequest {
  workflow_execution_id: string;
  step_id: string;
  assignee_id?: string;
  candidate?: any;
  task_type: string;
  form_definition?: any;
  context_data?: any;
  timeout_at?: string;
}

/**
 * Workflow Service - Manages workflow definitions, executions, and user tasks
 * Handles CRUD operations for workflow system with tenant isolation
 */

/**
 * Get all workflow definitions for a company
 */
export const getWorkflowDefinitions = async (companyId: string, userId: string): Promise<WorkflowDefinition[]> => {
  try {
    const result = await queryInTenantSchema(
      companyId,
      `SELECT id, name, slug, version, definition, events, status, created_by, created_at, updated_at
       FROM workflow_definitions
       WHERE status != 'draft' OR created_by = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching workflow definitions:', error);
    throw new Error('Failed to fetch workflow definitions');
  }
};

/**
 * Get a specific workflow definition by slug
 */
export const getWorkflowDefinition = async (companyId: string, slug: string, userId: string): Promise<WorkflowDefinition | null> => {
  try {
    // Handle system operations where userId might be 'system' or null
    let query: string;
    let params: any[];
    
    if (!userId || userId === 'system') {
      // For system operations, only get active workflows (ignore draft status)
      query = `SELECT id, name, slug, version, definition, events, status, created_by, created_at, updated_at
               FROM workflow_definitions
               WHERE slug = $1 AND status != 'draft'`;
      params = [slug];
    } else {
      // For user operations, get active workflows or drafts created by the user
      query = `SELECT id, name, slug, version, definition, events, status, created_by, created_at, updated_at
               FROM workflow_definitions
               WHERE slug = $1 AND (status != 'draft' OR created_by = $2)`;
      params = [slug, userId];
    }
    
    const result = await queryInTenantSchema(companyId, query, params);
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching workflow definition:', error);
    throw new Error('Failed to fetch workflow definition');
  }
};

/**
 * Create a new workflow definition
 */
export const createWorkflowDefinition = async (
  companyId: string,
  userId: string,
  workflowData: CreateWorkflowRequest
): Promise<WorkflowDefinition> => {
  try {
    // Validate workflow definition JSON
    if (!workflowData.definition || typeof workflowData.definition !== 'object') {
      throw new Error('Invalid workflow definition: must be a valid JSON object');
    }

    // Check if slug already exists
    const existingWorkflow = await queryInTenantSchema(
      companyId,
      'SELECT id FROM workflow_definitions WHERE slug = $1',
      [workflowData.slug]
    );

    if (existingWorkflow.rows.length > 0) {
      throw new Error(`Workflow with slug '${workflowData.slug}' already exists`);
    }

    const result = await queryInTenantSchema(
      companyId,
      `INSERT INTO workflow_definitions (name, slug, version, definition, events, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, slug, version, definition, events, status, created_by, created_at, updated_at`,
      [
        workflowData.name,
        workflowData.slug,
        workflowData.version || '1.0',
        JSON.stringify(workflowData.definition),
        JSON.stringify(workflowData.events || {}),
        workflowData.status || 'draft',
        userId
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating workflow definition:', error);
    throw error;
  }
};

/**
 * Update a workflow definition
 */
export const updateWorkflowDefinition = async (
  companyId: string,
  slug: string,
  userId: string,
  updateData: UpdateWorkflowRequest
): Promise<WorkflowDefinition> => {
  try {
    // Check if workflow exists and user has permission
    const existingWorkflow = await getWorkflowDefinition(companyId, slug, userId);
    if (!existingWorkflow) {
      throw new Error('Workflow not found or access denied');
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (updateData.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(updateData.name);
    }

    if (updateData.definition !== undefined) {
      updateFields.push(`definition = $${paramIndex++}`);
      updateValues.push(JSON.stringify(updateData.definition));
    }

    if (updateData.events !== undefined) {
      updateFields.push(`events = $${paramIndex++}`);
      updateValues.push(JSON.stringify(updateData.events));
    }

    if (updateData.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(updateData.status);
    }

    if (updateFields.length === 0) {
      return existingWorkflow; // No updates needed
    }

    updateValues.push(slug);
    updateValues.push(userId);

    const result = await queryInTenantSchema(
      companyId,
      `UPDATE workflow_definitions 
       SET ${updateFields.join(', ')}
       WHERE slug = $${paramIndex++} AND (status != 'draft' OR created_by = $${paramIndex++})
       RETURNING id, name, slug, version, definition, events, status, created_by, created_at, updated_at`,
      updateValues
    );

    if (result.rows.length === 0) {
      throw new Error('Workflow not found or access denied');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error updating workflow definition:', error);
    throw error;
  }
};

/**
 * Delete a workflow definition
 */
export const deleteWorkflowDefinition = async (
  companyId: string, 
  slug: string, 
  userId: string, 
  force: boolean = false
): Promise<void> => {
  try {
    if (!force) {
      // Check if there are any actively running executions (not failed or completed)
      const runningExecutions = await queryInTenantSchema(
        companyId,
        `SELECT COUNT(*) as count 
         FROM workflow_executions we
         JOIN workflow_definitions wd ON we.workflow_definition_id = wd.id
         WHERE wd.slug = $1 AND we.status = 'running'`,
        [slug]
      );

      if (parseInt(runningExecutions.rows[0].count) > 0) {
        throw new Error('Cannot delete workflow with running executions');
      }
    }

    // Delete the workflow definition (CASCADE will handle executions)
    const result = await queryInTenantSchema(
      companyId,
      `DELETE FROM workflow_definitions 
       WHERE slug = $1 AND (status != 'draft' OR created_by = $2)`,
      [slug, userId]
    );

    if (result.rowCount === 0) {
      throw new Error('Workflow not found or access denied');
    }
  } catch (error) {
    console.error('Error deleting workflow definition:', error);
    throw error;
  }
};

/**
 * Force delete a workflow definition and all its executions (for testing/cleanup)
 */
export const forceDeleteWorkflowDefinition = async (
  companyId: string, 
  slug: string, 
  userId: string
): Promise<void> => {
  return deleteWorkflowDefinition(companyId, slug, userId, true);
};

/**
 * Create a workflow execution record
 */
export const createWorkflowExecution = async (
  companyId: string,
  executionData: CreateWorkflowExecutionRequest
): Promise<WorkflowExecution> => {
  try {
    const result = await queryInTenantSchema(
      companyId,
      `INSERT INTO workflow_executions (workflow_definition_id, definition, temporal_workflow_id, temporal_run_id, trigger_data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, workflow_definition_id, definition, temporal_workflow_id, temporal_run_id, trigger_data, status, started_at, completed_at, result, error_message`,
      [
        executionData.workflow_definition_id,
        JSON.stringify(executionData.definition),
        executionData.temporal_workflow_id,
        executionData.temporal_run_id,
        executionData.trigger_data ? JSON.stringify(executionData.trigger_data) : null
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating workflow execution:', error);
    throw error;
  }
};

/**
 * Update workflow execution status
 */
export const updateWorkflowExecution = async (
  companyId: string,
  executionId: string,
  status: WorkflowExecution['status'],
  result?: any,
  errorMessage?: string
): Promise<WorkflowExecution> => {
  try {
    const updateResult = await queryInTenantSchema(
      companyId,
      `UPDATE workflow_executions 
       SET status = $1, 
           completed_at = CASE WHEN $1 IN ('completed', 'failed', 'cancelled', 'terminated') THEN NOW() ELSE completed_at END,
           result = $2,
           error_message = $3
       WHERE id = $4
       RETURNING id, workflow_definition_id, definition, temporal_workflow_id, temporal_run_id, trigger_data, status, started_at, completed_at, result, error_message`,
      [status, result ? JSON.stringify(result) : null, errorMessage, executionId]
    );

    if (updateResult.rows.length === 0) {
      throw new Error('Workflow execution not found');
    }

    return updateResult.rows[0];
  } catch (error) {
    console.error('Error updating workflow execution:', error);
    throw error;
  }
};

/**
 * Get workflow executions for a definition
 */
export const getWorkflowExecutions = async (
  companyId: string,
  workflowSlug?: string,
  limit: number = 50,
  offset: number = 0
): Promise<WorkflowExecution[]> => {
  try {
    let query = `
      SELECT we.id, we.workflow_definition_id, we.definition, we.temporal_workflow_id, we.temporal_run_id, 
             we.trigger_data, we.status, we.started_at, we.completed_at, we.result, we.error_message,
             wd.name as workflow_name, wd.slug as workflow_slug
      FROM workflow_executions we
      JOIN workflow_definitions wd ON we.workflow_definition_id = wd.id
    `;
    
    const params: any[] = [];
    
    if (workflowSlug) {
      query += ' WHERE wd.slug = $1';
      params.push(workflowSlug);
    }
    
    query += ' ORDER BY we.started_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await queryInTenantSchema(companyId, query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching workflow executions:', error);
    throw new Error('Failed to fetch workflow executions');
  }
};

/**
 * Get a specific workflow execution
 */
export const getWorkflowExecution = async (companyId: string, executionId: string): Promise<WorkflowExecution | null> => {
  try {
    const result = await queryInTenantSchema(
      companyId,
      `SELECT we.id, we.workflow_definition_id, we.definition, we.temporal_workflow_id, we.temporal_run_id, 
              we.trigger_data, we.status, we.started_at, we.completed_at, we.result, we.error_message,
              wd.name as workflow_name, wd.slug as workflow_slug
       FROM workflow_executions we
       JOIN workflow_definitions wd ON we.workflow_definition_id = wd.id
       WHERE we.id = $1`,
      [executionId]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching workflow execution:', error);
    throw new Error('Failed to fetch workflow execution');
  }
};

/**
 * Create a user task
 */
export const createUserTask = async (
  companyId: string,
  taskData: CreateUserTaskRequest
): Promise<WorkflowUserTask> => {
  try {
    const result = await queryInTenantSchema(
      companyId,
      `INSERT INTO workflow_user_tasks (workflow_execution_id, step_id, assignee_id, candidate, task_type, form_definition, context_data, timeout_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, workflow_execution_id, step_id, assignee_id, candidate, task_type, form_definition, context_data, status, result, created_at, completed_at, timeout_at`,
      [
        taskData.workflow_execution_id,
        taskData.step_id,
        taskData.assignee_id,
        taskData.candidate ? JSON.stringify(taskData.candidate) : null,
        taskData.task_type,
        taskData.form_definition ? JSON.stringify(taskData.form_definition) : null,
        taskData.context_data ? JSON.stringify(taskData.context_data) : null,
        taskData.timeout_at
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating user task:', error);
    throw error;
  }
};

/**
 * Get user tasks for a user
 */
export const getUserTasks = async (
  companyId: string,
  userId: string,
  status?: WorkflowUserTask['status'],
  limit: number = 50,
  offset: number = 0
): Promise<WorkflowUserTask[]> => {
  try {
    let query = `
      SELECT wut.id, wut.workflow_execution_id, wut.step_id, wut.assignee_id, wut.candidate, 
             wut.task_type, wut.form_definition, wut.context_data, wut.status, wut.result, 
             wut.created_at, wut.completed_at, wut.timeout_at,
             we.temporal_workflow_id, wd.name as workflow_name, wd.slug as workflow_slug
      FROM workflow_user_tasks wut
      JOIN workflow_executions we ON wut.workflow_execution_id = we.id
      JOIN workflow_definitions wd ON we.workflow_definition_id = wd.id
      WHERE (wut.assignee_id = $1 OR wut.candidate ? $2)
    `;
    
    const params: any[] = [userId, `"${userId}"`]; // JSON contains check for candidate
    
    if (status) {
      query += ' AND wut.status = $3';
      params.push(status);
    }
    
    query += ' ORDER BY wut.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await queryInTenantSchema(companyId, query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    throw new Error('Failed to fetch user tasks');
  }
};

/**
 * Complete a user task
 */
export const completeUserTask = async (
  companyId: string,
  taskId: string,
  userId: string,
  result: any
): Promise<WorkflowUserTask> => {
  try {
    const updateResult = await queryInTenantSchema(
      companyId,
      `UPDATE workflow_user_tasks 
       SET status = 'completed', 
           result = $1,
           completed_at = NOW(),
           assignee_id = COALESCE(assignee_id, $2)
       WHERE id = $3 AND (assignee_id = $2 OR assignee_id IS NULL OR candidate ? $4)
       RETURNING id, workflow_execution_id, step_id, assignee_id, candidate, task_type, form_definition, context_data, status, result, created_at, completed_at, timeout_at`,
      [JSON.stringify(result), userId, taskId, `"${userId}"`]
    );

    if (updateResult.rows.length === 0) {
      throw new Error('User task not found or access denied');
    }

    return updateResult.rows[0];
  } catch (error) {
    console.error('Error completing user task:', error);
    throw error;
  }
};

/**
 * Get a specific user task
 */
export const getUserTask = async (companyId: string, taskId: string, userId: string): Promise<WorkflowUserTask | null> => {
  try {
    const result = await queryInTenantSchema(
      companyId,
      `SELECT wut.id, wut.workflow_execution_id, wut.step_id, wut.assignee_id, wut.candidate, 
              wut.task_type, wut.form_definition, wut.context_data, wut.status, wut.result, 
              wut.created_at, wut.completed_at, wut.timeout_at,
              we.temporal_workflow_id, wd.name as workflow_name, wd.slug as workflow_slug
       FROM workflow_user_tasks wut
       JOIN workflow_executions we ON wut.workflow_execution_id = we.id
       JOIN workflow_definitions wd ON we.workflow_definition_id = wd.id
       WHERE wut.id = $1 AND (wut.assignee_id = $2 OR wut.assignee_id IS NULL OR wut.candidate ? $3)`,
      [taskId, userId, `"${userId}"`]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching user task:', error);
    throw new Error('Failed to fetch user task');
  }
};
