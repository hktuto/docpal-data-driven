import { Pool } from 'pg';
import { getPool, queryInTenantSchema, withTenantTransaction } from '../../database/utils/database';
import { getFGAClient, addDynamicTableType, removeDynamicTableType } from '../../utils/openfga';
import { CustomDataModel, ColumnDefinition } from '../../types';
import dataTypeMapping from '../../config/data-type-mapping.json';
import { addAuditTriggerToNewTable } from '../../database/utils/audit-triggers';
import { createDefaultTableView, createDefaultTreeView } from '../dataview/dataview_service';

export interface CreateSchemaRequest {
  slug: string;
  label: string;
  description: string;
  columns: ColumnDefinition[];
  is_system?: boolean;
  is_relation?: boolean;
}

export interface UpdateSchemaRequest {
  label?: string;
  description?: string;
  columns?: ColumnDefinition[];
}

export interface SchemaPermissions {
  owner: string[];
  viewer: string[];
  editor: string[];
  creator: string[];
  admin: string[];
}

/**
 * Schema Service - Manages dynamic data models and table creation
 * Handles CRUD operations for custom_data_model and dynamic table creation
 */

/**
 * Get all schemas for a company with permission filtering
 */
export const getSchemas = async (companyId: string, userId: string): Promise<CustomDataModel[]> => {
  try {
    const result = await queryInTenantSchema(
      companyId,
      `SELECT id, slug, label, is_system, is_relation, description, columns, company_id, created_at, updated_at
       FROM custom_data_model
       ORDER BY created_at DESC`
    );
    
    // Filter schemas based on OpenFGA permissions
    const filteredSchemas: CustomDataModel[] = [];
    
    for (const row of result.rows) {
      const hasPermission = await checkSchemaPermission(companyId, row.id, userId, 'viewer');
      if (hasPermission) {
        filteredSchemas.push({
          ...row,
          columns: Array.isArray(row.columns) ? row.columns : []
        });
      }
    }
    
    return filteredSchemas;
  } catch (error) {
    console.error('Error fetching schemas:', error);
    throw new Error('Failed to fetch schemas');
  }
};

/**
 * Get a specific schema by slug
 */
export const getSchemaBySlug = async (companyId: string, slug: string, userId: string): Promise<CustomDataModel | null> => {
  try {
    const result = await queryInTenantSchema(
      companyId,
      `SELECT id, slug, label, is_system, is_relation, description, columns, company_id, created_at, updated_at
       FROM custom_data_model
       WHERE slug = $1`,
      [slug]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const schema = result.rows[0];
    
    // Check OpenFGA permissions for this specific schema
    const hasPermission = await checkSchemaPermission(companyId, schema.id, userId, 'viewer');
    if (!hasPermission) {
      return null; // Return null if user doesn't have permission (same as not found)
    }
    
    return {
      ...schema,
      columns: Array.isArray(schema.columns) ? schema.columns : []
    };
  } catch (error) {
    console.error('Error fetching schema:', error);
    throw new Error('Failed to fetch schema');
  }
};

/**
 * Create a new schema and corresponding database table
 */
export const createSchema = async (companyId: string, userId: string, schemaData: CreateSchemaRequest): Promise<CustomDataModel> => {
  // Validate schema data
  validateSchemaData(schemaData);
  
  // Check if slug already exists
  const existingSchema = await getSchemaBySlug(companyId, schemaData.slug, userId);
  if (existingSchema) {
    throw new Error(`Schema with slug '${schemaData.slug}' already exists`);
  }
  
  try {
    const result = await withTenantTransaction(companyId, async (client) => {
      // Insert into custom_data_model table
      const insertQuery = `
        INSERT INTO custom_data_model (slug, label, is_system, is_relation, description, columns, company_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, slug, label, is_system, is_relation, description, columns, company_id, created_at, updated_at
      `;
      
      const result = await client.query(insertQuery, [
        schemaData.slug,
        schemaData.label,
        schemaData.is_system || false,
        schemaData.is_relation || false,
        schemaData.description,
        JSON.stringify(schemaData.columns),
        companyId
      ]);
      
      const newSchema = result.rows[0];
      
      // Create the actual database table
      await createDynamicTable(client, schemaData.slug, schemaData.columns);
      
      return newSchema;
    });
    
    // Add audit trigger to the newly created table (outside transaction)
    console.log(`🔧 Adding audit trigger to table: ${schemaData.slug} for company: ${companyId}`);
    try {
      await addAuditTriggerToNewTable(companyId, schemaData.slug);
      console.log(`✅ Audit trigger added successfully to table: ${schemaData.slug}`);
    } catch (error) {
      console.error(`❌ Failed to add audit trigger to table ${schemaData.slug}:`, error);
      throw error; // Re-throw to prevent silent failures
    }
    
    // Set up default OpenFGA permissions for the schema (outside transaction)
    await setupDefaultSchemaPermissions(companyId, result.id, userId);
    
    // Create default data view for the new table
    console.log(`🎨 Creating default data view for table: ${schemaData.slug}`);
    try {
      await createDefaultTableView(companyId, schemaData.slug, schemaData.label, userId);
      console.log(`✅ Default data view created successfully for table: ${schemaData.slug}`);
      
      // Check if this table has a parent-child relationship and create tree view
      const hasParentColumn = schemaData.columns.find(col => 
        col.name.includes('parent') && (col.data_type === 'uuid' || col.view_type === 'relation')
      );
      
      if (hasParentColumn) {
        const labelColumn = schemaData.columns.find(col => 
          col.view_type === 'text' || col.name === 'name' || col.name === 'title'
        );
        
        if (labelColumn) {
          await createDefaultTreeView(
            companyId, 
            schemaData.slug, 
            schemaData.label, 
            hasParentColumn.name, 
            labelColumn.name, 
            userId
          );
          console.log(`✅ Default tree view created successfully for table: ${schemaData.slug}`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to create default data view for table ${schemaData.slug}:`, error);
      // Don't throw error here - schema creation should still succeed
    }
    
    // Note: Dynamic table types would be added to OpenFGA model here
    // For now, we'll use the existing custom_data_model permissions
    console.log(`Schema ${schemaData.slug} created successfully with OpenFGA permissions`);
    
    return {
      ...result,
      columns: Array.isArray(result.columns) ? result.columns : []
    };
    
  } catch (error) {
    console.error('Error creating schema:', error);
    throw new Error('Failed to create schema');
  }
};

/**
 * Update an existing schema
 */
export const updateSchema = async (companyId: string, slug: string, userId: string, updateData: UpdateSchemaRequest): Promise<CustomDataModel> => {
  // Check if schema exists
  const existingSchema = await getSchemaBySlug(companyId, slug, userId);
  if (!existingSchema) {
    throw new Error(`Schema with slug '${slug}' not found`);
  }
  
  // Check OpenFGA permissions for schema modification
  const hasPermission = await checkSchemaPermission(companyId, existingSchema.id, userId, 'editor');
  if (!hasPermission) {
    throw new Error('Insufficient permissions to modify this schema');
  }
  
  try {
    const result = await withTenantTransaction(companyId, async (client) => {
      // Build update query dynamically
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;
      
      if (updateData.label !== undefined) {
        updateFields.push(`label = $${paramIndex++}`);
        updateValues.push(updateData.label);
      }
      
      if (updateData.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        updateValues.push(updateData.description);
      }
      
      if (updateData.columns !== undefined) {
        validateColumnDefinitions(updateData.columns);
        updateFields.push(`columns = $${paramIndex++}`);
        updateValues.push(JSON.stringify(updateData.columns));
        
        // Update the database table structure if columns changed
        await updateDynamicTable(client, slug, existingSchema.columns, updateData.columns);
      }
      
      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }
      
      updateFields.push(`updated_at = NOW()`);
      updateValues.push(slug);
      
      const updateQuery = `
        UPDATE custom_data_model
        SET ${updateFields.join(', ')}
        WHERE slug = $${paramIndex}
        RETURNING id, slug, label, is_system, is_relation, description, columns, company_id, created_at, updated_at
      `;
      
      const result = await client.query(updateQuery, updateValues);
      return result.rows[0];
    });
    
    return {
      ...result,
      columns: Array.isArray(result.columns) ? result.columns : []
    };
    
  } catch (error) {
    console.error('Error updating schema:', error);
    throw new Error('Failed to update schema');
  }
};

/**
 * Delete a schema and its corresponding database table
 */
export const deleteSchema = async (companyId: string, slug: string, userId: string): Promise<void> => {
  // Check if schema exists
  const existingSchema = await getSchemaBySlug(companyId, slug, userId);
  if (!existingSchema) {
    throw new Error(`Schema with slug '${slug}' not found`);
  }
  
  // Prevent deletion of system schemas
  if (existingSchema.is_system) {
    throw new Error('Cannot delete system schemas');
  }
  
  // Check OpenFGA permissions for schema deletion (requires admin or owner)
  const hasPermission = await checkSchemaPermission(companyId, existingSchema.id, userId, 'admin');
  if (!hasPermission) {
    throw new Error('Insufficient permissions to delete this schema');
  }
  
  try {
    await withTenantTransaction(companyId, async (client) => {
      // Drop the database table first
      await client.query(`DROP TABLE IF EXISTS ${slug}`);
      
      // Delete from custom_data_model table
      await client.query(`DELETE FROM custom_data_model WHERE slug = $1`, [slug]);
    });
    
    // TODO : disable openFGA for now
    // Clean up OpenFGA permissions for the schema (outside transaction)
    // await cleanupSchemaPermissions(companyId, existingSchema.id);
    
    // Clean up table-level permissions for the dynamic table
    // await cleanupTablePermissions(companyId, slug);
    // end openFGA section
    
    console.log(`Schema ${slug} deleted successfully`);
    
  } catch (error) {
    console.error('Error deleting schema:', error);
    throw new Error('Failed to delete schema');
  }
};

/**
 * Create a dynamic database table based on column definitions
 */
const createDynamicTable = async (client: any, tableName: string, columns: ColumnDefinition[]): Promise<void> => {
  // Always include standard columns
  const standardColumns = [
    'id UUID PRIMARY KEY DEFAULT uuid_generate_v4()',
    'created_at TIMESTAMP NOT NULL DEFAULT NOW()',
    'updated_at TIMESTAMP NOT NULL DEFAULT NOW()',
    'created_by UUID NOT NULL'
  ];
  
  // Convert column definitions to SQL
  const dynamicColumns = columns.map(col => {
    const sqlType = convertToSQLType(col);
    const nullable = col.nullable ? '' : ' NOT NULL';
    const defaultValue = col.default !== undefined ? ` DEFAULT ${formatDefaultValue(col.default, col.data_type)}` : '';
    
    return `${col.name} ${sqlType}${nullable}${defaultValue}`;
  });
  
  const allColumns = [...standardColumns, ...dynamicColumns];
  
  const createTableQuery = `
    CREATE TABLE ${tableName} (
      ${allColumns.join(',\n      ')}
    )
  `;
  
  await client.query(createTableQuery);
  
  // Create updated_at trigger (drop first to make idempotent)
  await client.query(`
    DROP TRIGGER IF EXISTS update_${tableName}_updated_at ON ${tableName}
  `);
  await client.query(`
    CREATE TRIGGER update_${tableName}_updated_at
    BEFORE UPDATE ON ${tableName}
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `);
};

/**
 * Update a dynamic database table structure
 */
const updateDynamicTable = async (client: any, tableName: string, oldColumns: ColumnDefinition[], newColumns: ColumnDefinition[]): Promise<void> => {
  // Compare old and new columns to determine changes
  const oldColumnMap = new Map(oldColumns.map(col => [col.name, col]));
  const newColumnMap = new Map(newColumns.map(col => [col.name, col]));
  
  // Find columns to add
  for (const [name, column] of newColumnMap) {
    if (!oldColumnMap.has(name)) {
      const sqlType = convertToSQLType(column);
      const nullable = column.nullable ? '' : ' NOT NULL';
      const defaultValue = column.default !== undefined ? ` DEFAULT ${formatDefaultValue(column.default, column.data_type)}` : '';
      
      await client.query(`ALTER TABLE ${tableName} ADD COLUMN ${name} ${sqlType}${nullable}${defaultValue}`);
    }
  }
  
  // Find columns to remove
  for (const [name] of oldColumnMap) {
    if (!newColumnMap.has(name)) {
      await client.query(`ALTER TABLE ${tableName} DROP COLUMN ${name}`);
    }
  }
  
  // Find columns to modify (basic type changes only)
  for (const [name, newColumn] of newColumnMap) {
    const oldColumn = oldColumnMap.get(name);
    if (oldColumn && isColumnTypeChangeAllowed(oldColumn, newColumn)) {
      const newSqlType = convertToSQLType(newColumn);
      await client.query(`ALTER TABLE ${tableName} ALTER COLUMN ${name} TYPE ${newSqlType}`);
    }
  }
};

/**
 * Convert column definition to SQL data type
 */
const convertToSQLType = (column: ColumnDefinition): string => {
  const { data_type, data_type_options } = column;
  
  switch (data_type) {
    case 'varchar':
      return `VARCHAR(${data_type_options?.length || 255})`;
    case 'text':
      return 'TEXT';
    case 'char':
      return `CHAR(${data_type_options?.length || 1})`;
    case 'int':
      return 'INTEGER';
    case 'bigint':
      return 'BIGINT';
    case 'decimal':
    case 'numeric':
      const precision = data_type_options?.precision || 10;
      const scale = data_type_options?.scale || 2;
      return `DECIMAL(${precision}, ${scale})`;
    case 'float':
      return 'REAL';
    case 'double':
      return 'DOUBLE PRECISION';
    case 'boolean':
      return 'BOOLEAN';
    case 'timestamp':
      return 'TIMESTAMP';
    case 'timestamptz':
      return 'TIMESTAMPTZ';
    case 'date':
      return 'DATE';
    case 'time':
      return 'TIME';
    case 'jsonb':
      return 'JSONB';
    case 'json':
      return 'JSON';
    case 'uuid':
      return 'UUID';
    default:
      throw new Error(`Unsupported data type: ${data_type}`);
  }
};

/**
 * Format default value for SQL
 */
const formatDefaultValue = (value: any, dataType: string): string => {
  if (value === null) return 'NULL';
  
  switch (dataType) {
    case 'varchar':
    case 'text':
    case 'char':
      return `'${value.replace(/'/g, "''")}'`;
    case 'boolean':
      return value ? 'TRUE' : 'FALSE';
    case 'jsonb':
    case 'json':
      return `'${JSON.stringify(value)}'::jsonb`;
    default:
      return String(value);
  }
};

/**
 * Check if column type change is allowed based on migration compatibility
 */
const isColumnTypeChangeAllowed = (oldColumn: ColumnDefinition, newColumn: ColumnDefinition): boolean => {
  if (oldColumn.data_type === newColumn.data_type) return true;
  
  const compatibility = dataTypeMapping.migrationCompatibility[oldColumn.data_type as keyof typeof dataTypeMapping.migrationCompatibility];
  return compatibility?.includes(newColumn.data_type) || false;
};

/**
 * Validate schema data
 */
const validateSchemaData = (schemaData: CreateSchemaRequest): void => {
  if (!schemaData.slug || !/^[a-z][a-z0-9_]*$/.test(schemaData.slug)) {
    throw new Error('Schema slug must start with a letter and contain only lowercase letters, numbers, and underscores');
  }
  
  if (!schemaData.label || schemaData.label.trim().length === 0) {
    throw new Error('Schema label is required');
  }
  
  if (!schemaData.description || schemaData.description.trim().length === 0) {
    throw new Error('Schema description is required');
  }
  
  validateColumnDefinitions(schemaData.columns);
};

/**
 * Validate column definitions
 */
const validateColumnDefinitions = (columns: ColumnDefinition[]): void => {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error('At least one column is required');
  }
  
  const columnNames = new Set<string>();
  const reservedNames = ['id', 'created_at', 'updated_at', 'created_by'];
  
  for (const column of columns) {
    // Check for required fields
    if (!column.name || !column.data_type || !column.view_type || !column.view_editor) {
      throw new Error('Column name, data_type, view_type, and view_editor are required');
    }
    
    // Check column name format
    if (!/^[a-z][a-z0-9_]*$/.test(column.name)) {
      throw new Error(`Column name '${column.name}' must start with a letter and contain only lowercase letters, numbers, and underscores`);
    }
    
    // Check for reserved names
    if (reservedNames.includes(column.name)) {
      throw new Error(`Column name '${column.name}' is reserved`);
    }
    
    // Check for duplicate names
    if (columnNames.has(column.name)) {
      throw new Error(`Duplicate column name: ${column.name}`);
    }
    columnNames.add(column.name);
    
    // Validate data type
    const validDataTypes = Object.keys(dataTypeMapping.dataTypeViewTypeMapping);
    if (!validDataTypes.includes(column.data_type)) {
      throw new Error(`Invalid data type: ${column.data_type}`);
    }
    
    // Validate view type compatibility
    const allowedViewTypes = dataTypeMapping.dataTypeViewTypeMapping[column.data_type as keyof typeof dataTypeMapping.dataTypeViewTypeMapping];
    if (!allowedViewTypes.includes(column.view_type)) {
      throw new Error(`View type '${column.view_type}' is not compatible with data type '${column.data_type}'`);
    }
    
    // Validate editor compatibility
    const allowedEditors = dataTypeMapping.viewTypeEditors[column.view_type as keyof typeof dataTypeMapping.viewTypeEditors];
    if (!allowedEditors.includes(column.view_editor)) {
      throw new Error(`Editor '${column.view_editor}' is not compatible with view type '${column.view_type}'`);
    }
  }
};

/**
 * Permission Helper Functions
 */

/**
 * Check if a user has a specific permission on a schema
 */
const checkSchemaPermission = async (companyId: string, schemaId: string, userId: string, relation: string): Promise<boolean> => {
  try {
    const openFGAClient = getFGAClient();
    const storeId = await getCompanyStoreId(companyId);
    
    if (!storeId) {
      console.error('No OpenFGA store found for company:', companyId);
      return false;
    }
    
    const checkResult = await openFGAClient.check(storeId, {
      tuple_key: {
        user: `user:${userId}`,
        relation: relation,
        object: `custom_data_model:${schemaId}`
      }
    });
    
    return checkResult.allowed || false;
  } catch (error) {
    console.error('Error checking schema permission:', error);
    return false;
  }
};

/**
 * Set up default permissions for a newly created schema
 */
const setupDefaultSchemaPermissions = async (companyId: string, schemaId: string, creatorUserId: string): Promise<void> => {
  try {
    const openFGAClient = getFGAClient();
    const storeId = await getCompanyStoreId(companyId);
    
    if (!storeId) {
      throw new Error('No OpenFGA store found for company');
    }
    
    // Set the creator as the owner of the schema
    await openFGAClient.write(storeId, {
      writes: {
        tuple_keys: [
          {
            user: `user:${creatorUserId}`,
            relation: 'owner',
            object: `custom_data_model:${schemaId}`
          }
        ]
      }
    });
    
    console.log(`Set up default permissions for schema ${schemaId}, owner: ${creatorUserId}`);
  } catch (error) {
    console.error('Error setting up default schema permissions:', error);
    throw new Error('Failed to set up schema permissions');
  }
};

/**
 * Clean up all permissions for a schema when it's deleted
 */
const cleanupSchemaPermissions = async (companyId: string, schemaId: string): Promise<void> => {
  try {
    const openFGAClient = getFGAClient();
    const storeId = await getCompanyStoreId(companyId);
    
    if (!storeId) {
      console.error('No OpenFGA store found for company:', companyId);
      return;
    }
    
    // Read all tuples for this schema to delete them
    const readResult = await openFGAClient.read(storeId, {
      tuple_key: {
        object: `custom_data_model:${schemaId}`
      }
    });
    
    if (readResult.tuples && readResult.tuples.length > 0) {
      // Delete all existing permissions for this schema
      await openFGAClient.write(storeId, {
        deletes: {
          tuple_keys: readResult.tuples.map(tuple => ({
            user: tuple.key.user,
            relation: tuple.key.relation,
            object: tuple.key.object
          }))
        }
      });
    }
    
    console.log(`Cleaned up permissions for schema ${schemaId}`);
  } catch (error) {
    console.error('Error cleaning up schema permissions:', error);
    // Don't throw error here as the schema deletion should still proceed
  }
};

/**
 * Get the OpenFGA store ID for a company
 */
const getCompanyStoreId = async (companyId: string): Promise<string | null> => {
  try {
    const db = getPool();
    const result = await db.query('SELECT openfga_store_id FROM company WHERE id = $1', [companyId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].openfga_store_id;
  } catch (error) {
    console.error('Error getting company store ID:', error);
    return null;
  }
};

/**
 * Set up default permissions for a newly created dynamic table
 */
const setupDefaultTablePermissions = async (companyId: string, tableName: string, creatorUserId: string): Promise<void> => {
  try {
    const openFGAClient = getFGAClient();
    const storeId = await getCompanyStoreId(companyId);
    
    if (!storeId) {
      throw new Error('No OpenFGA store found for company');
    }
    
    // Set the creator as the owner of the table (using table name as object ID)
    await openFGAClient.write(storeId, {
      writes: {
        tuple_keys: [
          {
            user: `user:${creatorUserId}`,
            relation: 'owner',
            object: `${tableName}:${tableName}`
          },
          {
            user: `company:${companyId}`,
            relation: 'company',
            object: `${tableName}:${tableName}`
          }
        ]
      }
    });
    
    console.log(`Set up default permissions for table ${tableName}, owner: ${creatorUserId}`);
  } catch (error) {
    console.error('Error setting up default table permissions:', error);
    throw new Error('Failed to set up table permissions');
  }
};

/**
 * Clean up all permissions for a dynamic table when it's deleted
 */
const cleanupTablePermissions = async (companyId: string, tableName: string): Promise<void> => {
  try {
    const openFGAClient = getFGAClient();
    const storeId = await getCompanyStoreId(companyId);
    
    if (!storeId) {
      console.error('No OpenFGA store found for company:', companyId);
      return;
    }
    
    // Read all tuples for this specific table object
    const readResult = await openFGAClient.read(storeId, {
      tuple_key: {
        object: `${tableName}:${tableName}`
      }
    });
    
    // Also read any tuples that might have the table type (in case there are other objects)
    const readTableTypeResult = await openFGAClient.read(storeId, {
      tuple_key: {
        object: `${tableName}:`
      }
    });
    
    const tuplesToDelete: Array<{user: string, relation: string, object: string}> = [];
    
    // Collect tuples from specific table object
    if (readResult.tuples && readResult.tuples.length > 0) {
      tuplesToDelete.push(...readResult.tuples.map(tuple => ({
        user: tuple.key.user,
        relation: tuple.key.relation,
        object: tuple.key.object
      })));
    }
    
    // Collect tuples from table type objects
    if (readTableTypeResult.tuples && readTableTypeResult.tuples.length > 0) {
      tuplesToDelete.push(...readTableTypeResult.tuples
        .filter(tuple => tuple.key.object.startsWith(`${tableName}:`))
        .map(tuple => ({
          user: tuple.key.user,
          relation: tuple.key.relation,
          object: tuple.key.object
        })));
    }
    
    // Delete all collected tuples
    if (tuplesToDelete.length > 0) {
      await openFGAClient.write(storeId, {
        deletes: {
          tuple_keys: tuplesToDelete
        }
      });
      
      console.log(`Cleaned up ${tuplesToDelete.length} permission tuples for table ${tableName}`);
    } else {
      console.log(`No permission tuples found for table ${tableName}`);
    }
    
  } catch (error) {
    console.error('Error cleaning up table permissions:', error);
    // Don't throw error here as the table deletion should still proceed
  }
};
