// Workflow Migration Utilities
// Ensures workflow tables exist in tenant schemas

import { Pool } from 'pg';
import { getPool, queryInTenantSchema } from './database';

/**
 * Check if workflow tables exist in a tenant schema
 */
export const checkWorkflowTablesExist = async (companyId: string): Promise<boolean> => {
  try {
    const result = await queryInTenantSchema(
      companyId,
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = $1 
       AND table_name IN ('workflow_definitions', 'workflow_executions', 'workflow_user_tasks')`,
      [`company_${companyId.replace(/-/g, '_')}`]
    );
    
    return result.rows.length === 3; // All three tables should exist
  } catch (error) {
    console.error('Error checking workflow tables:', error);
    return false;
  }
};

/**
 * Create workflow tables in a tenant schema if they don't exist
 */
export const ensureWorkflowTables = async (companyId: string): Promise<void> => {
  try {
    const tablesExist = await checkWorkflowTablesExist(companyId);
    if (tablesExist) {
      return; // Tables already exist
    }

    console.log(`Creating workflow tables for company ${companyId}`);
    
    const schemaName = `company_${companyId.replace(/-/g, '_')}`;
    const pool = getPool();
    
    // Create workflow_definitions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${schemaName}.workflow_definitions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        version VARCHAR(20) NOT NULL DEFAULT '1.0',
        definition JSONB NOT NULL,
        events JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
        created_by UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(slug, version)
      )
    `);

    // Create workflow_executions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${schemaName}.workflow_executions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workflow_definition_id UUID NOT NULL REFERENCES ${schemaName}.workflow_definitions(id) ON DELETE CASCADE,
        definition JSONB NOT NULL,
        temporal_workflow_id VARCHAR(255) NOT NULL,
        temporal_run_id VARCHAR(255) NOT NULL,
        trigger_data JSONB,
        status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'terminated')),
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        result JSONB,
        error_message TEXT,
        UNIQUE(temporal_workflow_id, temporal_run_id)
      )
    `);

    // Create workflow_user_tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${schemaName}.workflow_user_tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workflow_execution_id UUID NOT NULL REFERENCES ${schemaName}.workflow_executions(id) ON DELETE CASCADE,
        step_id VARCHAR(100) NOT NULL,
        assignee_id UUID,
        candidate JSONB,
        task_type VARCHAR(50) NOT NULL,
        form_definition JSONB,
        context_data JSONB,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'completed', 'cancelled', 'timeout')),
        result JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        timeout_at TIMESTAMP
      )
    `);

    // Create indexes
    const indexPrefix = schemaName.replace(/[^a-zA-Z0-9]/g, '_');
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_${indexPrefix}_workflow_definitions_slug ON ${schemaName}.workflow_definitions(slug)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_${indexPrefix}_workflow_definitions_status ON ${schemaName}.workflow_definitions(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_${indexPrefix}_workflow_definitions_created_by ON ${schemaName}.workflow_definitions(created_by)`);
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_${indexPrefix}_workflow_executions_definition_id ON ${schemaName}.workflow_executions(workflow_definition_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_${indexPrefix}_workflow_executions_temporal_workflow_id ON ${schemaName}.workflow_executions(temporal_workflow_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_${indexPrefix}_workflow_executions_status ON ${schemaName}.workflow_executions(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_${indexPrefix}_workflow_executions_started_at ON ${schemaName}.workflow_executions(started_at)`);
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_${indexPrefix}_workflow_user_tasks_execution_id ON ${schemaName}.workflow_user_tasks(workflow_execution_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_${indexPrefix}_workflow_user_tasks_assignee_id ON ${schemaName}.workflow_user_tasks(assignee_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_${indexPrefix}_workflow_user_tasks_status ON ${schemaName}.workflow_user_tasks(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_${indexPrefix}_workflow_user_tasks_timeout_at ON ${schemaName}.workflow_user_tasks(timeout_at)`);

    // Create update trigger for workflow_definitions
    await pool.query(`
      CREATE OR REPLACE FUNCTION ${schemaName}.update_workflow_definitions_updated_at()
      RETURNS TRIGGER AS $trigger$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $trigger$ LANGUAGE plpgsql;
    `);
    
    await pool.query(`
      CREATE TRIGGER trigger_workflow_definitions_updated_at
        BEFORE UPDATE ON ${schemaName}.workflow_definitions
        FOR EACH ROW
        EXECUTE FUNCTION ${schemaName}.update_workflow_definitions_updated_at();
    `);

    // Add events column to custom_data_model if it doesn't exist
    await pool.query(`
      ALTER TABLE ${schemaName}.custom_data_model 
      ADD COLUMN IF NOT EXISTS events JSONB DEFAULT '{}'::jsonb
    `);

    console.log(`✅ Workflow tables created successfully for company ${companyId}`);
  } catch (error) {
    console.error(`❌ Error creating workflow tables for company ${companyId}:`, error);
    throw error;
  }
};

/**
 * Ensure workflow tables exist for all existing companies
 */
export const migrateAllCompaniesToWorkflow = async (): Promise<void> => {
  try {
    const pool = getPool();
    
    // Get all companies
    const companiesResult = await pool.query('SELECT id FROM company');
    const companies = companiesResult.rows;
    
    console.log(`🔄 Migrating ${companies.length} companies to workflow system...`);
    
    for (const company of companies) {
      await ensureWorkflowTables(company.id);
    }
    
    console.log('✅ All companies migrated to workflow system');
  } catch (error) {
    console.error('❌ Error migrating companies to workflow system:', error);
    throw error;
  }
};
