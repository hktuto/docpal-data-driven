// Audit trigger management utilities for DocPal API

import { queryInTenantSchema, getTenantSchemaName } from './database';

/**
 * Ensure both audit_log table and audit trigger function exist in the tenant schema
 * This creates them if they don't exist (for existing tenant schemas)
 */
export const ensureAuditInfrastructure = async (companyId: string): Promise<void> => {
  const schemaName = getTenantSchemaName(companyId);
  
  // First ensure the audit_log table exists
  const checkTableSQL = `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = current_schema() 
      AND table_name = 'audit_log'
    ) as table_exists;
  `;
  
  const tableResult = await queryInTenantSchema(companyId, checkTableSQL);
  const tableExists = tableResult.rows[0]?.table_exists;
  
  if (!tableExists) {
    console.log(`🔧 Creating audit_log table in ${schemaName}...`);
    
    const createTableSQL = `
      CREATE TABLE audit_log (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          table_name TEXT NOT NULL,
          record_id UUID,
          operation CHAR(1) NOT NULL CHECK (operation IN ('I', 'U', 'D')),
          user_id UUID,
          user_email TEXT,
          session_id UUID,
          operation_source VARCHAR(50) DEFAULT 'system',
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp,
          old_data JSONB,
          new_data JSONB,
          changed_fields TEXT[],
          system_context JSONB
      );
      
      -- Create indexes for performance
      CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
      CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
      CREATE INDEX idx_audit_log_operation ON audit_log(operation);
      CREATE INDEX idx_audit_log_user_id ON audit_log(user_id) WHERE user_id IS NOT NULL;
      CREATE INDEX idx_audit_log_record_id ON audit_log(record_id) WHERE record_id IS NOT NULL;
    `;
    
    await queryInTenantSchema(companyId, createTableSQL);
    console.log(`✅ audit_log table created in ${schemaName}`);
  } else {
    console.log(`✅ audit_log table already exists in ${schemaName}`);
  }
  
  // Then ensure the trigger function exists
  await ensureAuditTriggerFunction(companyId);
};

/**
 * Ensure the audit trigger function exists in the tenant schema
 * This creates the function if it doesn't exist (for existing tenant schemas)
 */
export const ensureAuditTriggerFunction = async (companyId: string): Promise<void> => {
  const schemaName = getTenantSchemaName(companyId);
  
  // Check if the function already exists
  const checkFunctionSQL = `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = current_schema() 
      AND routine_name = 'audit_trigger_function'
      AND routine_type = 'FUNCTION'
    ) as function_exists;
  `;
  
  const result = await queryInTenantSchema(companyId, checkFunctionSQL);
  const functionExists = result.rows[0]?.function_exists;
  
  if (!functionExists) {
    console.log(`🔧 Creating audit trigger function in ${schemaName}...`);
    
    // Create the audit trigger function with workflow event support
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION audit_trigger_function()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $func$
      DECLARE
          old_data JSONB := NULL;
          new_data JSONB := NULL;
          changed_fields TEXT[] := '{}'::TEXT[];
          current_user_id UUID := NULL;
          current_session_id UUID := NULL;
          current_user_email TEXT := NULL;
          operation_source TEXT := 'system';
          system_context JSONB := NULL;
          key TEXT;
          schema_events JSONB := NULL;
          event_config JSONB;
          company_id_value UUID;
      BEGIN
          -- Try to get user context (will be NULL for system operations)
          
          BEGIN
              current_user_id := current_setting('app.current_user_id', true)::UUID;
              current_session_id := current_setting('app.current_session_id', true)::UUID;
              current_user_email := current_setting('app.current_user_email', true);
              operation_source := COALESCE(current_setting('app.operation_source', true), 'system');
              system_context := current_setting('app.system_context', true)::JSONB;
          EXCEPTION WHEN OTHERS THEN
              -- If any setting fails, continue with NULL values (system operation)
              NULL;
          END;
          
          -- Extract company ID from schema name (company_uuid format)
          -- Convert underscores back to hyphens for proper UUID format
          company_id_value := REPLACE(REPLACE(TG_TABLE_SCHEMA, 'company_', ''), '_', '-')::UUID;
          
          -- WORKFLOW EVENTS: Handle workflow notifications FIRST (before audit logging)
          -- Query custom_data_model for event configuration
          RAISE NOTICE ''Checking for workflow events for table'';
          BEGIN
              -- Get event configuration from custom_data_model table
              SELECT events INTO schema_events 
              FROM custom_data_model 
              WHERE slug = TG_TABLE_NAME;
              
              -- Check if there are workflow triggers configured for this operation
              IF schema_events IS NOT NULL AND schema_events ? ''triggers'' THEN
                  RAISE NOTICE ''Found event configuration for table'';
                  
                  -- Loop through triggers to find matching event type
                  FOR event_config IN SELECT * FROM jsonb_array_elements(schema_events->''triggers'') LOOP
                      RAISE NOTICE ''Checking trigger event config'';
                      IF event_config->>''event'' = TG_OP OR event_config->>''event'' = LOWER(TG_OP) THEN
                          RAISE NOTICE ''Triggering workflow for event'';
                          
                          -- Send workflow notification with full context
                          PERFORM pg_notify(''workflow_events'', json_build_object(
                              ''event_type'', TG_OP,
                              ''table_name'', TG_TABLE_NAME,
                              ''company_id'', company_id_value,
                              ''record_id'', COALESCE(NEW.id, OLD.id),
                              ''old_data'', CASE WHEN TG_OP = ''DELETE'' THEN to_jsonb(OLD) ELSE NULL END,
                              ''new_data'', CASE WHEN TG_OP = ''INSERT'' OR TG_OP = ''UPDATE'' THEN to_jsonb(NEW) ELSE NULL END,
                              ''schema_events'', schema_events,
                              ''trigger_config'', event_config,
                              ''user_id'', current_user_id,
                              ''session_id'', current_session_id,
                              ''timestamp'', NOW()
                          )::text);
                          
                          RAISE NOTICE ''Workflow notification sent'';
                      END IF;
                  END LOOP;
              ELSE
                  RAISE NOTICE ''No workflow triggers configured for table'';
              END IF;
          EXCEPTION WHEN OTHERS THEN
              -- If event processing fails, don''t break the main operation
              RAISE NOTICE ''Error processing workflow events'';
              RAISE NOTICE ''Error details:'';
          END;
          
          RAISE NOTICE ''trigger audit log'';
          -- Handle different operations
          IF TG_OP = 'DELETE' THEN
              old_data := to_jsonb(OLD);
              
              INSERT INTO audit_log (
                  table_name, record_id, operation,
                  user_id, user_email, session_id, operation_source, system_context,
                  old_data
              ) VALUES (
                  TG_TABLE_NAME, OLD.id, 'D',
                  current_user_id, current_user_email, current_session_id, operation_source, system_context,
                  old_data
              );
              
              RETURN OLD;
              
          ELSIF TG_OP = 'INSERT' THEN
              new_data := to_jsonb(NEW);
              
              INSERT INTO audit_log (
                  table_name, record_id, operation,
                  user_id, user_email, session_id, operation_source, system_context,
                  new_data
              ) VALUES (
                  TG_TABLE_NAME, NEW.id, 'I',
                  current_user_id, current_user_email, current_session_id, operation_source, system_context,
                  new_data
              );
              
              RETURN NEW;
              
          ELSIF TG_OP = 'UPDATE' THEN
              old_data := to_jsonb(OLD);
              new_data := to_jsonb(NEW);
              
              -- Find changed fields
              FOR key IN SELECT jsonb_object_keys(new_data) LOOP
                  IF (old_data ->> key) IS DISTINCT FROM (new_data ->> key) THEN
                      changed_fields := array_append(changed_fields, key);
                  END IF;
              END LOOP;
              
              -- Only log if there are actual changes
              IF array_length(changed_fields, 1) > 0 THEN
                  INSERT INTO audit_log (
                      table_name, record_id, operation,
                      user_id, user_email, session_id, operation_source, system_context,
                      old_data, new_data, changed_fields
                  ) VALUES (
                      TG_TABLE_NAME, NEW.id, 'U',
                      current_user_id, current_user_email, current_session_id, operation_source, system_context,
                      old_data, new_data, changed_fields
                  );
              END IF;
              
              RETURN NEW;
          END IF;
          
          RETURN COALESCE(NEW, OLD);
      END;
      $func$;
    `;
    
    await queryInTenantSchema(companyId, createFunctionSQL);
    console.log(`✅ Audit trigger function created in ${schemaName}`);
  } else {
    console.log(`✅ Audit trigger function already exists in ${schemaName}`);
  }
};

/**
 * Add audit trigger to a specific table in tenant schema
 */
export const addAuditTriggerToTable = async (
  companyId: string,
  tableName: string
): Promise<void> => {
  const schemaName = getTenantSchemaName(companyId);
  
  // First, ensure the audit infrastructure exists
  await ensureAuditInfrastructure(companyId);
  
  // Create trigger name (unique per table)
  const triggerName = `audit_trigger_${tableName}`;
  
  const triggerSQL = `
    DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};
    CREATE TRIGGER ${triggerName}
      AFTER INSERT OR UPDATE OR DELETE ON ${tableName}
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
  `;
  
  await queryInTenantSchema(companyId, triggerSQL);
  console.log(`✅ Added audit trigger to ${schemaName}.${tableName}`);
};

/**
 * Remove audit trigger from a specific table in tenant schema
 */
export const removeAuditTriggerFromTable = async (
  companyId: string,
  tableName: string
): Promise<void> => {
  const schemaName = getTenantSchemaName(companyId);
  const triggerName = `audit_trigger_${tableName}`;
  
  const dropTriggerSQL = `DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};`;
  
  await queryInTenantSchema(companyId, dropTriggerSQL);
  console.log(`🗑️ Removed audit trigger from ${schemaName}.${tableName}`);
};

/**
 * Add audit triggers to all existing tables in tenant schema
 * Excludes system tables and tables that shouldn't be audited
 */
export const addAuditTriggersToAllTables = async (companyId: string): Promise<void> => {
  const schemaName = getTenantSchemaName(companyId);
  
  // Get all tables in the tenant schema
  const tablesResult = await queryInTenantSchema(
    companyId,
    `SELECT table_name 
     FROM information_schema.tables 
     WHERE table_schema = $1 
     AND table_type = 'BASE TABLE'
     AND table_name NOT IN ('audit_log', 'history')`, // Exclude audit tables themselves
    [schemaName]
  );
  
  const tables = tablesResult.rows.map((row: any) => row.table_name);
  
  console.log(`📋 Found ${tables.length} tables to add audit triggers: ${tables.join(', ')}`);
  
  // Add triggers to each table
  for (const tableName of tables) {
    try {
      await addAuditTriggerToTable(companyId, tableName);
    } catch (error) {
      console.error(`❌ Failed to add audit trigger to ${tableName}:`, error);
    }
  }
  
  console.log(`✅ Completed adding audit triggers to all tables in ${schemaName}`);
};

/**
 * Check if a table has an audit trigger
 */
export const hasAuditTrigger = async (
  companyId: string,
  tableName: string
): Promise<boolean> => {
  const schemaName = getTenantSchemaName(companyId);
  const triggerName = `audit_trigger_${tableName}`;
  
  const result = await queryInTenantSchema(
    companyId,
    `SELECT trigger_name 
     FROM information_schema.triggers 
     WHERE trigger_schema = $1 
     AND event_object_table = $2 
     AND trigger_name = $3`,
    [schemaName, tableName, triggerName]
  );
  
  return result.rows.length > 0;
};

/**
 * List all tables with audit triggers in tenant schema
 */
export const listTablesWithAuditTriggers = async (companyId: string): Promise<string[]> => {
  const schemaName = getTenantSchemaName(companyId);
  
  const result = await queryInTenantSchema(
    companyId,
    `SELECT DISTINCT event_object_table as table_name
     FROM information_schema.triggers 
     WHERE trigger_schema = $1 
     AND trigger_name LIKE 'audit_trigger_%'
     ORDER BY table_name`,
    [schemaName]
  );
  
  return result.rows.map((row: any) => row.table_name);
};

/**
 * Get audit trigger status for all tables in tenant schema
 */
export const getAuditTriggerStatus = async (companyId: string): Promise<{
  tableName: string;
  hasAuditTrigger: boolean;
}[]> => {
  const schemaName = getTenantSchemaName(companyId);
  
  // Get all tables
  const tablesResult = await queryInTenantSchema(
    companyId,
    `SELECT table_name 
     FROM information_schema.tables 
     WHERE table_schema = $1 
     AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [schemaName]
  );
  
  const tables = tablesResult.rows.map((row: any) => row.table_name);
  
  // Check trigger status for each table
  const status:any[] = [];
  for (const tableName of tables) {
    const hasAudit = await hasAuditTrigger(companyId, tableName);
    status.push({
      tableName,
      hasAuditTrigger: hasAudit
    });
  }
  
  return status;
};

/**
 * Tables that should NOT have audit triggers
 */
const EXCLUDED_TABLES = [
  'audit_log',    // Don't audit the audit log itself
  'history',      // Don't audit the history table
  'session'       // Don't audit sessions (too noisy)
];

/**
 * Check if a table should be excluded from audit triggers
 */
export const shouldExcludeFromAudit = (tableName: string): boolean => {
  return EXCLUDED_TABLES.includes(tableName.toLowerCase());
};

/**
 * Add audit trigger to a newly created dynamic table
 * This should be called whenever a new table is created via the schema service
 */
export const addAuditTriggerToNewTable = async (
  companyId: string,
  tableName: string
): Promise<void> => {
  console.log(`🔧 addAuditTriggerToNewTable called for table: ${tableName}, company: ${companyId}`);
  
  if (shouldExcludeFromAudit(tableName)) {
    console.log(`⏭️ Skipping audit trigger for excluded table: ${tableName}`);
    return;
  }
  
  console.log(`🔧 Calling addAuditTriggerToTable for: ${tableName}`);
  try {
    await addAuditTriggerToTable(companyId, tableName);
    console.log(`🆕 Added audit trigger to newly created table: ${tableName}`);
  } catch (error) {
    console.error(`❌ Error in addAuditTriggerToNewTable for ${tableName}:`, error);
    throw error;
  }
};
