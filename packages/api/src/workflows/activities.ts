// Workflow Activities
// These are the building blocks that workflows can execute

import { Context } from '@temporalio/activity';
import { queryInTenantSchema, withTenantTransaction } from '../database/utils/database';

export interface ActivityContext {
  companyId: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Update a record in a dynamic table
 */
export async function updateRecord(
  context: ActivityContext,
  tableName: string,
  recordId: string,
  data: Record<string, any>
): Promise<any> {
  console.log(`Updating record ${recordId} in table ${tableName}`, { context, data });
  
  try {
    // Build update query dynamically
    
    const fields = Object.keys(data);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [recordId, ...Object.values(data)];
    
    const query = `
      UPDATE ${tableName} 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    console.log('Query:', query);
    const result = await queryInTenantSchema(context.companyId, query, values);
    
    if (result.rows.length === 0) {
      throw new Error(`Record ${recordId} not found in table ${tableName}`);
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error updating record:', error);
    throw error;
  }
}

/**
 * Create a new record in a dynamic table
 */
export async function createRecord(
  context: ActivityContext,
  tableName: string,
  data: Record<string, any>
): Promise<any> {
  console.log(`Creating record in table ${tableName}`, { context, data });
  
  try {
    const fields = Object.keys(data);
    const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
    const values = Object.values(data);
    
    const query = `
      INSERT INTO ${tableName} (${fields.join(', ')}, created_at, updated_at)
      VALUES (${placeholders}, NOW(), NOW())
      RETURNING *
    `;
    
    const result = await queryInTenantSchema(context.companyId, query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating record:', error);
    throw error;
  }
}

/**
 * Query records from a dynamic table
 */
export async function queryRecords(
  context: ActivityContext,
  tableName: string,
  conditions?: Record<string, any>,
  limit?: number
): Promise<any[]> {
  console.log(`Querying records from table ${tableName}`, { context, conditions, limit });
  
  try {
    let query = `SELECT * FROM ${tableName}`;
    const values: any[] = [];
    
    if (conditions && Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map((field, index) => `${field} = $${index + 1}`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
      values.push(...Object.values(conditions));
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    
    const result = await queryInTenantSchema(context.companyId, query, values);
    return result.rows;
  } catch (error) {
    console.error('Error querying records:', error);
    throw error;
  }
}

/**
 * Send email notification (placeholder)
 */
export async function sendEmail(
  context: ActivityContext,
  to: string,
  subject: string,
  body: string,
  template?: string
): Promise<{ success: boolean; messageId?: string }> {
  console.log(`Sending email to ${to}`, { context, subject, template });
  
  // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
  // For now, just log the email
  console.log('📧 Email sent (mock):', {
    to,
    subject,
    body: body.substring(0, 100) + '...',
    template,
  });
  
  return {
    success: true,
    messageId: `mock_${Date.now()}`,
  };
}

/**
 * Create notification (placeholder)
 */
export async function createNotification(
  context: ActivityContext,
  userId: string,
  title: string,
  message: string,
  type: 'info' | 'warning' | 'error' | 'success' = 'info'
): Promise<{ success: boolean; notificationId?: string }> {
  console.log(`Creating notification for user ${userId}`, { context, title, type });
  
  // TODO: Integrate with notification system
  // For now, just log the notification
  console.log('🔔 Notification created (mock):', {
    userId,
    title,
    message,
    type,
  });
  
  return {
    success: true,
    notificationId: `notification_${Date.now()}`,
  };
}

/**
 * Log error to audit system
 */
export async function logError(
  context: ActivityContext,
  error: string,
  details?: Record<string, any>
): Promise<void> {
  console.error('Workflow error logged:', { context, error, details });
  
  // TODO: Integrate with audit system to log workflow errors
  // For now, just console log
}

/**
 * Evaluate condition safely
 */
export async function evaluateCondition(
  context: ActivityContext,
  condition: string,
  variables: Record<string, any>
): Promise<boolean> {
  console.log('Evaluating condition:', { context, condition, variables });
  
  try {
    // Simple condition evaluation - in production, use a safe expression evaluator
    // For now, support basic comparisons
    
    // Replace variables in condition
    let evaluatedCondition = condition;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      evaluatedCondition = evaluatedCondition.replace(regex, JSON.stringify(value));
    }
    
    // Basic safety check - only allow simple comparisons
    const safePattern = /^[a-zA-Z0-9\s"'._\-+*/()>=<!&|]+$/;
    if (!safePattern.test(evaluatedCondition)) {
      throw new Error('Unsafe condition expression');
    }
    
    // For now, return a mock result
    // TODO: Implement safe expression evaluation
    console.log('Condition evaluation (mock):', evaluatedCondition);
    return Math.random() > 0.5; // Random result for testing
  } catch (error) {
    console.error('Error evaluating condition:', error);
    return false;
  }
}

/**
 * Call webhook
 */
export async function callWebhook(
  context: ActivityContext,
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
  data?: any,
  headers?: Record<string, string>
): Promise<{ success: boolean; response?: any; error?: string }> {
  console.log(`Calling webhook ${method} ${url}`, { context, data });
  
  try {
    // TODO: Implement actual HTTP request
    // For now, just log the webhook call
    console.log('🌐 Webhook called (mock):', {
      url,
      method,
      data,
      headers,
    });
    
    return {
      success: true,
      response: { status: 'ok', timestamp: new Date().toISOString() },
    };
  } catch (error) {
    console.error('Error calling webhook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Wait for user task completion
 */
export async function waitForUserTask(
  context: ActivityContext,
  taskId: string,
  timeoutMs: number = 24 * 60 * 60 * 1000 // 24 hours default
): Promise<{ completed: boolean; result?: any; timedOut?: boolean }> {
  console.log(`Waiting for user task ${taskId}`, { context, timeoutMs });
  
  // TODO: Implement actual user task waiting with Temporal activities
  // For now, simulate a quick completion
  await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
  
  return {
    completed: true,
    result: { action: 'approved', timestamp: new Date().toISOString() },
  };
}
