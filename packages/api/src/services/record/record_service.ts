import { Pool } from 'pg';
import { queryInTenantSchema, withTenantTransaction } from '../../database/utils/database';
import { createCompanyStore, getFGAClient } from '../../utils/openfga';
import { CustomDataModel, ColumnDefinition } from '../../types';
import { getSchemaBySlug } from '../schema/schema_service';

export interface CreateRecordRequest {
  [key: string]: any; // Dynamic fields based on schema
}

export interface UpdateRecordRequest {
  [key: string]: any; // Dynamic fields based on schema
}

export interface BatchInsertRequest {
  records: CreateRecordRequest[];
}

export interface RecordQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  filters?: Record<string, any>;
  search?: string;
}

export interface RecordResponse {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  [key: string]: any; // Dynamic fields
}

/**
 * Record Service - Manages dynamic record operations
 * Handles CRUD operations for records in dynamically created tables
 */

/**
 * Create a new record in a dynamic table
 */
export const createRecord = async (
  storeId: string,
  companyId: string,
  tableSlug: string,
  userId: string,
  recordData: CreateRecordRequest
): Promise<RecordResponse> => {
  try {
    // First, get the schema to validate the table exists and user has access
    const schema = await getSchemaBySlug(companyId, tableSlug, userId);
    if (!schema) {
      throw new Error('Table not found or access denied');
    }

    // TODO : disable openFGA permission for now
    // Check if user has create permission for this table
    // const hasCreatePermission = await checkRecordPermission(storeId, schema.id, userId, 'editor');
    // if (!hasCreatePermission) {
    //   throw new Error('Insufficient permissions to create records');
    // }

    // Validate and prepare the data
    const validatedData = await validateRecordData(schema, recordData);
    
    return await withTenantTransaction(companyId, async (client) => {
      // Prepare the insert query
      const columns = Object.keys(validatedData);
      const values = Object.values(validatedData);
      const placeholders = values.map((_, index) => `$${index + 2}`); // $1 is for created_by

      const insertQuery = `
        INSERT INTO ${tableSlug} (${columns.join(', ')}, created_by)
        VALUES (${placeholders.join(', ')}, $1)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [userId, ...values]);

      if (result.rows.length === 0) {
        throw new Error('Failed to create record');
      }

      const newRecord = result.rows[0];

      // TODO : Fix openFGA permission, the model is not created yet
      // Set up OpenFGA permissions for the new record
      // await setupRecordPermissions(storeId, companyId, schema.id, newRecord.id, userId);
      console.log('---------------New Record', newRecord);
      return newRecord;
    });
  } catch (error) {
    console.error('Error creating record:', error);
    throw error;
  }
};

/**
 * Create multiple records in a dynamic table (batch insert)
 */
export const createRecordsBatch = async (
  storeId: string,
  companyId: string,
  tableSlug: string,
  userId: string,
  batchData: BatchInsertRequest
): Promise<{ records: RecordResponse[]; total: number; errors: any[] }> => {
  try {
    // First, get the schema to validate the table exists and user has access
    const schema = await getSchemaBySlug(companyId, tableSlug, userId);
    if (!schema) {
      throw new Error('Table not found or access denied');
    }

    // TODO : disable openFGA permission for now
    // Check if user has create permission for this table
    // const hasCreatePermission = await checkRecordPermission(storeId, schema.id, userId, 'editor');
    // if (!hasCreatePermission) {
    //   throw new Error('Insufficient permissions to create records');
    // }

    if (!batchData.records || !Array.isArray(batchData.records) || batchData.records.length === 0) {
      throw new Error('No records provided for batch insert');
    }

    if (batchData.records.length > 1000) {
      throw new Error('Batch insert limited to 1000 records at a time');
    }

    const results: RecordResponse[] = [];
    const errors: any[] = [];

    return await withTenantTransaction(companyId, async (client) => {
      // Process each record in the batch
      for (let i = 0; i < batchData.records.length; i++) {
        try {
          const recordData = batchData.records[i];
          
          // Validate and prepare the data
          const validatedData = await validateRecordData(schema, recordData);
          
          // Prepare the insert query
          const columns = Object.keys(validatedData);
          const values = Object.values(validatedData);
          const placeholders = values.map((_, index) => `$${index + 2}`); // $1 is for created_by

          const insertQuery = `
            INSERT INTO ${tableSlug} (${columns.join(', ')}, created_by)
            VALUES (${placeholders.join(', ')}, $1)
            RETURNING *
          `;

          const result = await client.query(insertQuery, [userId, ...values]);

          if (result.rows.length > 0) {
            const newRecord = result.rows[0];
            results.push(newRecord);
            
            // TODO : Fix openFGA permission, the model is not created yet
            // Set up OpenFGA permissions for the new record
            // await setupRecordPermissions(storeId, companyId, schema.id, newRecord.id, userId);
          } else {
            errors.push({
              index: i,
              record: recordData,
              error: 'Failed to create record'
            });
          }
        } catch (recordError: any) {
          console.error(`Error creating record at index ${i}:`, recordError);
          errors.push({
            index: i,
            record: batchData.records[i],
            error: recordError.message || 'Unknown error'
          });
        }
      }

      console.log(`Batch insert completed: ${results.length} successful, ${errors.length} errors`);
      
      return {
        records: results,
        total: results.length,
        errors
      };
    });
  } catch (error) {
    console.error('Error in batch insert:', error);
    throw error;
  }
};

/**
 * Get records from a dynamic table with filtering and pagination
 */
export const getRecords = async (
  companyId: string,
  tableSlug: string,
  userId: string,
  options: RecordQueryOptions = {}
): Promise<{ records: RecordResponse[]; total: number }> => {
  try {
    // Get the schema to validate access
    const schema = await getSchemaBySlug(companyId, tableSlug, userId);
    if (!schema) {
      throw new Error('Table not found or access denied');
    }

    const {
      limit = 50,
      offset = 0,
      orderBy = 'created_at',
      orderDirection = 'DESC',
      filters = {},
      search
    } = options;

    // Build the query with filters
    let whereClause = '';
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Add filters
    if (Object.keys(filters).length > 0) {
      const filterConditions: string[] = [];
      for (const [column, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          filterConditions.push(`${column} = $${paramIndex}`);
          queryParams.push(value);
          paramIndex++;
        }
      }
      if (filterConditions.length > 0) {
        whereClause = `WHERE ${filterConditions.join(' AND ')}`;
      }
    }

    // Add search functionality (searches across text columns)
    if (search && search.trim()) {
      const textColumns = schema.columns
        .filter(col => ['text', 'varchar', 'string'].includes(col.data_type))
        .map(col => col.name);
      
      if (textColumns.length > 0) {
        const searchConditions = textColumns.map(col => 
          `${col}::text ILIKE $${paramIndex}`
        );
        const searchClause = `(${searchConditions.join(' OR ')})`;
        
        if (whereClause) {
          whereClause += ` AND ${searchClause}`;
        } else {
          whereClause = `WHERE ${searchClause}`;
        }
        
        queryParams.push(`%${search.trim()}%`);
        paramIndex++;
      }
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM ${tableSlug} ${whereClause}`;
    const countResult = await queryInTenantSchema(companyId, countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Get records with pagination
    const selectQuery = `
      SELECT * FROM ${tableSlug} 
      ${whereClause}
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);
    const result = await queryInTenantSchema(companyId, selectQuery, queryParams);

    // Filter records based on permissions (this could be optimized with row-level security)
    const accessibleRecords: RecordResponse[] = [];
    for (const record of result.rows) {
      // TODO : disable openFGA permission for now
      // const hasViewPermission = await checkRecordPermission(companyId, schema.id, userId, 'viewer', record.id);
      // if (hasViewPermission) {
      //   accessibleRecords.push(record);
      // }
    }

    // TODO : disable openFGA permission for now, so return all records
    return {
      records: result.rows,
      total
    };
  } catch (error) {
    console.error('-------------Error fetching records:', error);
    throw error;
  }
};

/**
 * Get a specific record by ID
 */
export const getRecordById = async (
  storeId: string,
  companyId: string,
  tableSlug: string,
  recordId: string,
  userId: string
): Promise<RecordResponse | null> => {
  try {
    // Get the schema to validate access
    const schema = await getSchemaBySlug(companyId, tableSlug, userId);
    if (!schema) {
      throw new Error('Table not found or access denied');
    }

    const result = await queryInTenantSchema(
      companyId,
      `SELECT * FROM ${tableSlug} WHERE id = $1`,
      [recordId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const record = result.rows[0];

    // TODO : Fix openFGA permission, the model is not created yet
    // Check permissions for this specific record
    // const hasViewPermission = await checkRecordPermission(companyId, schema.id, userId, 'viewer', record.id);
    // if (!hasViewPermission) {
    //   return null;
    // }

    return record;
  } catch (error) {
    console.error('Error fetching record:', error);
    throw error;
  }
};

/**
 * Update a record in a dynamic table
 */
export const updateRecord = async (
  storeId: string,
  companyId: string,
  tableSlug: string,
  recordId: string,
  userId: string,
  updateData: UpdateRecordRequest
): Promise<RecordResponse> => {
  try {
    // Get the schema to validate access
    const schema = await getSchemaBySlug(companyId, tableSlug, userId);
    if (!schema) {
      throw new Error('Table not found or access denied');
    }

    // Check if record exists and user has edit permission
    const existingRecord = await getRecordById(storeId, companyId, tableSlug, recordId, userId);
    if (!existingRecord) {
      throw new Error('Record not found or access denied');
    }

    // TODO : disable openFGA permission for now
    // const hasEditPermission = await checkRecordPermission(companyId, schema.id, userId, 'editor', recordId);
    // if (!hasEditPermission) {
    //   throw new Error('Insufficient permissions to update record');
    // }

    // Validate the update data
    const validatedData = await validateRecordData(schema, updateData, true);

    return await withTenantTransaction(companyId, async (client) => {
      // Prepare the update query
      const columns = Object.keys(validatedData);
      const values = Object.values(validatedData);
      const setClause = columns.map((col, index) => `${col} = $${index + 2}`).join(', ');

      const updateQuery = `
        UPDATE ${tableSlug} 
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(updateQuery, [recordId, ...values]);
      
      if (result.rows.length === 0) {
        throw new Error('Failed to update record');
      }

      return result.rows[0];
    });
  } catch (error) {
    console.error('Error updating record:', error);
    throw error;
  }
};

/**
 * Delete a record from a dynamic table
 */
export const deleteRecord = async (
  storeId: string,
  companyId: string,
  tableSlug: string,
  recordId: string,
  userId: string
): Promise<boolean> => {
  try {
    // Get the schema to validate access
    const schema = await getSchemaBySlug(companyId, tableSlug, userId);
    if (!schema) {
      throw new Error('Table not found or access denied');
    }

    // Check if record exists and user has delete permission
    const existingRecord = await getRecordById(storeId, companyId, tableSlug, recordId, userId);
    if (!existingRecord) {
      throw new Error('Record not found or access denied');
    }

    // TODO : disable openFGA permission for now
    // const hasDeletePermission = await checkRecordPermission(companyId, schema.id, userId, 'owner', recordId);
    // if (!hasDeletePermission) {
    //   throw new Error('Insufficient permissions to delete record');
    // }

    return await withTenantTransaction(companyId, async (client) => {
      // Delete the record
      const deleteQuery = `DELETE FROM ${tableSlug} WHERE id = $1`;
      const result = await client.query(deleteQuery, [recordId]);

      if (result.rowCount === 0) {
        throw new Error('Failed to delete record');
      }

      // Clean up OpenFGA permissions for the deleted record
      await cleanupRecordPermissions(companyId, schema.id, recordId);

      return true;
    });
  } catch (error) {
    console.error('Error deleting record:', error);
    throw error;
  }
};

/**
 * Validate record data against schema
 */
const validateRecordData = async (
  schema: CustomDataModel,
  data: Record<string, any>,
  isUpdate: boolean = false
): Promise<Record<string, any>> => {
  const validatedData: Record<string, any> = {};

  for (const column of schema.columns) {
    const value = data[column.name];

    // Skip validation for update if field is not provided
    if (isUpdate && value === undefined) {
      continue;
    }

    // Check required fields for create operations (nullable: false means required)
    if (!isUpdate && !column.nullable && (value === undefined || value === null)) {
      throw new Error(`Field '${column.name}' is required`);
    }

    // Validate data type and convert if necessary
    if (value !== undefined && value !== null) {
      validatedData[column.name] = await validateColumnValue(column, value);
    }
  }

  return validatedData;
};

/**
 * Validate a single column value
 */
const validateColumnValue = async (column: ColumnDefinition, value: any): Promise<any> => {
  // Basic type validation - this can be expanded based on data-type-mapping.json
  switch (column.data_type) {
    case 'text':
    case 'varchar':
    case 'string':
      return String(value);
    
    case 'integer':
    case 'int':
      const intValue = parseInt(value);
      if (isNaN(intValue)) {
        throw new Error(`Invalid integer value for field '${column.name}'`);
      }
      return intValue;
    
    case 'decimal':
    case 'float':
      const floatValue = parseFloat(value);
      if (isNaN(floatValue)) {
        throw new Error(`Invalid decimal value for field '${column.name}'`);
      }
      return floatValue;
    
    case 'boolean':
      return Boolean(value);
    
    case 'date':
    case 'datetime':
    case 'timestamp':
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        throw new Error(`Invalid date value for field '${column.name}'`);
      }
      return dateValue.toISOString();
    
    case 'json':
    case 'jsonb':
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          throw new Error(`Invalid JSON value for field '${column.name}'`);
        }
      }
      return value;
    
    default:
      return value;
  }
};

/**
 * Check record-level permissions using OpenFGA
 */
const checkRecordPermission = async (
  storeId: string,
  schemaId: string,
  userId: string,
  permission: string,
  recordId?: string
): Promise<boolean> => {
  try {
    // query company store id from company table
    const client = getFGAClient();
    

    // For record-level permissions, we check against the specific record
    // For table-level permissions (like creator), we check against the schema
    const objectId = recordId ? `record:${recordId}` : `custom_data_model:${schemaId}`;

    const checkResult = await client.check(storeId, {
      tuple_key: {
        user: `user:${userId}`,
        relation: permission,
        object: objectId
      }
    });

    return checkResult.allowed || false;
  } catch (error) {
    console.error('Error checking record permission:', error);
    return false;
  }
};

/**
 * Set up OpenFGA permissions for a new record
 */
const setupRecordPermissions = async (
  storeId: string,
  companyId: string,
  schemaId: string,
  recordId: string,
  userId: string
): Promise<void> => {
  try {
    const client = getFGAClient();

    // Make the creator the owner of the record
    await client.write(storeId, {
      writes: {
        tuple_keys: [
          {
            user: `user:${userId}`,
            relation: 'owner',
            object: `record:${recordId}`
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error setting up record permissions:', error);
    throw error;
  }
};

/**
 * Clean up OpenFGA permissions for a deleted record
 */
const cleanupRecordPermissions = async (
  companyId: string,
  schemaId: string,
  recordId: string
): Promise<void> => {
  try {
    const client = getFGAClient();
    const storeId = `company_${companyId}`;

    // Remove all permissions for this record
    // Note: In a real implementation, you might want to list all existing tuples first
    const relationsToCleanup = ['owner', 'editor', 'viewer'];
    
    for (const relation of relationsToCleanup) {
      try {
        await client.write(storeId, {
          deletes: {
            tuple_keys: [
              {
                user: `user:*`, // This is a simplified approach
                relation: relation,
                object: `record:${recordId}`
              }
            ]
          }
        });
      } catch (error) {
        // Continue cleanup even if some deletions fail
        console.warn(`Failed to cleanup ${relation} permissions for record ${recordId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error cleaning up record permissions:', error);
    // Don't throw here as the record is already deleted
  }
};

/**
 * Get breadcrumb trail for hierarchical records
 */
export const getBreadcrumb = async (
  companyId: string,
  tableSlug: string,
  recordId: string,
  labelColumn: string,
  valueColumn: string,
  parentColumn: string,
  direction: 'root_to_current' | 'current_to_root' = 'root_to_current',
  maxDepth: number = 50,
  userId: string
): Promise<{ breadcrumb: Array<{ label: string; value: string }>; depth: number }> => {
  const schema = await getSchemaBySlug(companyId, tableSlug, userId);
  if (!schema) {
    throw new Error('Schema not found');
  }

  // Check permissions (temporarily disabled for MVP)
  // await checkRecordPermission(companyId, schema.id, recordId, userId, 'read');

  // Validate columns exist in schema
  const schemaColumns = schema.columns.map(col => col.name);
  const systemColumns = ['id', 'created_at', 'updated_at', 'created_by'];
  const allColumns = [...systemColumns, ...schemaColumns];

  if (!allColumns.includes(labelColumn)) {
    throw new Error(`Label column '${labelColumn}' not found in schema`);
  }
  if (!allColumns.includes(valueColumn)) {
    throw new Error(`Value column '${valueColumn}' not found in schema`);
  }
  if (!allColumns.includes(parentColumn)) {
    throw new Error(`Parent column '${parentColumn}' not found in schema`);
  }

  const breadcrumb: Array<{ label: string; value: string }> = [];
  const visited = new Set<string>(); // Prevent circular references
  let currentId = recordId;
  let depth = 0;

  // Build breadcrumb trail
  while (currentId && depth < maxDepth && !visited.has(currentId)) {
    visited.add(currentId);
    
    // Get current record
    const result = await queryInTenantSchema(
      companyId,
      `SELECT ${labelColumn}, ${valueColumn}, ${parentColumn} FROM ${schema.slug} WHERE id = $1`,
      [currentId]
    );
    
    if (result.rows.length === 0) {
      break; // Record not found
    }

    const record = result.rows[0];
    breadcrumb.push({
      label: String(record[labelColumn] || ''),
      value: String(record[valueColumn] || '')
    });

    // Move to parent
    currentId = record[parentColumn];
    depth++;
  }

  // Reverse if we want root_to_current order
  if (direction === 'root_to_current') {
    breadcrumb.reverse();
  }

  return {
    breadcrumb,
    depth: breadcrumb.length
  };
};
