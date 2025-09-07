// DocPal Activity Logging Service
// Unified service for both history and audit functionality

import { queryInTenantSchema } from '../../database/utils/database';

export interface ActivityEntry {
  action: string;
  entity_type: string;
  entity_id?: string;
  table_name?: string;
  data: Record<string, any>;
  user_id: string;
  user_email: string;
  metadata?: Record<string, any>;
}

export interface HistoryQueryOptions {
  limit?: number;
  offset?: number;
  action?: string;
  user_id?: string;
  start_date?: Date;
  end_date?: Date;
}

export interface AuditQueryOptions extends HistoryQueryOptions {
  entity_type?: string;
}

/**
 * Log an activity entry to the unified activity_log table
 */
export const logActivity = async (
  companyId: string,
  activity: ActivityEntry
): Promise<void> => {
  try {
    await queryInTenantSchema(
      companyId,
      `INSERT INTO activity_log (
        action, entity_type, entity_id, table_name, 
        data, user_id, user_email, metadata, company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        activity.action,
        activity.entity_type,
        activity.entity_id,
        activity.table_name,
        JSON.stringify(activity.data),
        activity.user_id,
        activity.user_email,
        JSON.stringify(activity.metadata || {}),
        companyId
      ]
    );
  } catch (error) {
    // Log error but don't fail the main operation
    console.error('Failed to log activity:', error);
  }
};

/**
 * Get history for a specific record (History view)
 */
export const getRecordHistory = async (
  companyId: string,
  tableSlug: string,
  recordId: string,
  options: HistoryQueryOptions = {}
): Promise<any[]> => {
  const { limit = 50, offset = 0, action, user_id, start_date, end_date } = options;
  
  let whereClause = 'WHERE entity_type = $3 AND table_name = $4 AND entity_id = $5';
  const params: any[] = [limit, offset, 'record', tableSlug, recordId];
  let paramIndex = 6;
  
  if (action) {
    whereClause += ` AND action = $${paramIndex}`;
    params.push(action);
    paramIndex++;
  }
  
  if (user_id) {
    whereClause += ` AND user_id = $${paramIndex}`;
    params.push(user_id);
    paramIndex++;
  }
  
  if (start_date) {
    whereClause += ` AND created_at >= $${paramIndex}`;
    params.push(start_date.toISOString());
    paramIndex++;
  }
  
  if (end_date) {
    whereClause += ` AND created_at <= $${paramIndex}`;
    params.push(end_date.toISOString());
    paramIndex++;
  }
  
  const result = await queryInTenantSchema(
    companyId,
    `SELECT * FROM activity_log 
     ${whereClause}
     ORDER BY created_at DESC 
     LIMIT $1 OFFSET $2`,
    params
  );
  
  return result.rows;
};

/**
 * Get history for a table (History view)
 */
export const getTableHistory = async (
  companyId: string,
  tableSlug: string,
  options: HistoryQueryOptions = {}
): Promise<any[]> => {
  const { limit = 50, offset = 0, action, user_id, start_date, end_date } = options;
  
  let whereClause = 'WHERE entity_type = $3 AND table_name = $4';
  const params: any[] = [limit, offset, 'record', tableSlug];
  let paramIndex = 5;
  
  if (action) {
    whereClause += ` AND action = $${paramIndex}`;
    params.push(action);
    paramIndex++;
  }
  
  if (user_id) {
    whereClause += ` AND user_id = $${paramIndex}`;
    params.push(user_id);
    paramIndex++;
  }
  
  if (start_date) {
    whereClause += ` AND created_at >= $${paramIndex}`;
    params.push(start_date.toISOString());
    paramIndex++;
  }
  
  if (end_date) {
    whereClause += ` AND created_at <= $${paramIndex}`;
    params.push(end_date.toISOString());
    paramIndex++;
  }
  
  const result = await queryInTenantSchema(
    companyId,
    `SELECT * FROM activity_log 
     ${whereClause}
     ORDER BY created_at DESC 
     LIMIT $1 OFFSET $2`,
    params
  );
  
  return result.rows;
};

/**
 * Get audit logs (Audit view - broader scope)
 */
export const getAuditLogs = async (
  companyId: string,
  options: AuditQueryOptions = {}
): Promise<any[]> => {
  const { limit = 50, offset = 0, action, entity_type, user_id, start_date, end_date } = options;
  
  let whereClause = 'WHERE 1=1';
  const params: any[] = [limit, offset];
  let paramIndex = 3;
  
  if (entity_type) {
    whereClause += ` AND entity_type = $${paramIndex}`;
    params.push(entity_type);
    paramIndex++;
  }
  
  if (action) {
    whereClause += ` AND action = $${paramIndex}`;
    params.push(action);
    paramIndex++;
  }
  
  if (user_id) {
    whereClause += ` AND user_id = $${paramIndex}`;
    params.push(user_id);
    paramIndex++;
  }
  
  if (start_date) {
    whereClause += ` AND created_at >= $${paramIndex}`;
    params.push(start_date.toISOString());
    paramIndex++;
  }
  
  if (end_date) {
    whereClause += ` AND created_at <= $${paramIndex}`;
    params.push(end_date.toISOString());
    paramIndex++;
  }
  
  const result = await queryInTenantSchema(
    companyId,
    `SELECT * FROM activity_log 
     ${whereClause}
     ORDER BY created_at DESC 
     LIMIT $1 OFFSET $2`,
    params
  );
  
  return result.rows;
};

/**
 * Get user activity (Audit view - user-focused)
 */
export const getUserActivity = async (
  companyId: string,
  userId: string,
  options: HistoryQueryOptions = {}
): Promise<any[]> => {
  const { limit = 50, offset = 0, action, start_date, end_date } = options;
  
  let whereClause = 'WHERE user_id = $3';
  const params: any[] = [limit, offset, userId];
  let paramIndex = 4;
  
  if (action) {
    whereClause += ` AND action = $${paramIndex}`;
    params.push(action);
    paramIndex++;
  }
  
  if (start_date) {
    whereClause += ` AND created_at >= $${paramIndex}`;
    params.push(start_date.toISOString());
    paramIndex++;
  }
  
  if (end_date) {
    whereClause += ` AND created_at <= $${paramIndex}`;
    params.push(end_date.toISOString());
    paramIndex++;
  }
  
  const result = await queryInTenantSchema(
    companyId,
    `SELECT * FROM activity_log 
     ${whereClause}
     ORDER BY created_at DESC 
     LIMIT $1 OFFSET $2`,
    params
  );
  
  return result.rows;
};

/**
 * Helper function to determine if a request should be logged
 */
export const shouldLogRequest = (method: string, url: string): boolean => {
  // Skip logging for health checks, static files, etc.
  const skipPatterns = [
    '/health',
    '/docs',
    '/favicon.ico',
    '/static/',
    '/_next/',
  ];
  
  return !skipPatterns.some(pattern => url.includes(pattern));
};

/**
 * Helper function to extract activity data from request/response
 */
export const extractActivityFromRequest = (
  request: any,
  reply: any,
  responseBody?: any
): Partial<ActivityEntry> | null => {
  const { method, url, params, body } = request;
  const { statusCode } = reply;
  
  // Only log successful operations that modify data
  if (statusCode >= 400) {
    return null;
  }
  
  // Extract entity information from URL patterns
  const urlParts = url.split('/').filter((part: string) => part);
  
  // Record operations: /api/records/:table_slug[/:record_id]
  if (urlParts[1] === 'records' && urlParts[2]) {
    const tableSlug = urlParts[2];
    const recordId = urlParts[3];
    
    let action: string;
    let data: Record<string, any> = {};
    
    switch (method) {
      case 'POST':
        if (!recordId) {
          action = 'CREATE';
          data = { after: responseBody };
        } else if (url.includes('/rollback')) {
          action = 'ROLLBACK';
          data = { record_id: recordId };
        } else {
          return null; // Other POST operations
        }
        break;
      case 'PUT':
        action = 'UPDATE';
        data = { after: body };
        break;
      case 'DELETE':
        action = 'DELETE';
        data = { record_id: recordId };
        break;
      default:
        return null; // Don't log GET requests
    }
    
    return {
      action,
      entity_type: 'record',
      entity_id: recordId,
      table_name: tableSlug,
      data
    };
  }
  
  // Schema operations: /api/schemas[/:table_slug]
  if (urlParts[1] === 'schemas') {
    const tableSlug = urlParts[2];
    
    let action: string;
    let data: Record<string, any> = {};
    
    switch (method) {
      case 'POST':
        action = 'CREATE_SCHEMA';
        data = { schema: body };
        break;
      case 'PUT':
        action = 'UPDATE_SCHEMA';
        data = { schema: body };
        break;
      case 'DELETE':
        action = 'DELETE_SCHEMA';
        data = { table_slug: tableSlug };
        break;
      default:
        return null;
    }
    
    return {
      action,
      entity_type: 'schema',
      entity_id: tableSlug,
      table_name: tableSlug,
      data
    };
  }
  
  // File operations: /api/files[/:file_id]
  if (urlParts[1] === 'files') {
    const fileId = urlParts[2];
    
    let action: string;
    let data: Record<string, any> = {};
    
    switch (method) {
      case 'POST':
        if (url.includes('/upload')) {
          action = 'UPLOAD_FILE';
          data = { file_info: responseBody };
        } else if (url.includes('/delete')) {
          action = 'DELETE_FILE';
          data = { file_id: fileId };
        } else {
          return null;
        }
        break;
      default:
        return null;
    }
    
    return {
      action,
      entity_type: 'file',
      entity_id: fileId,
      data
    };
  }
  
  return null;
};
