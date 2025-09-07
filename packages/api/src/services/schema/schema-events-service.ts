// Schema Events Service
// Handles event configuration for custom data tables

import { getPool } from '../../database/utils/database';

/**
 * Get event configuration for a table
 */
export const getTableEvents = async (companyId: string, tableSlug: string): Promise<any> => {
  const pool = getPool();
  const schemaName = `company_${companyId.replace(/-/g, '_')}`;
  
  const query = `
    SELECT events 
    FROM ${schemaName}.custom_data_model 
    WHERE slug = $1
  `;
  
  const result = await pool.query(query, [tableSlug]);
  
  if (result.rows.length === 0) {
    throw new Error(`Table '${tableSlug}' not found`);
  }
  
  return result.rows[0].events || {};
};

/**
 * Update event configuration for a table
 */
export const updateTableEvents = async (
  companyId: string, 
  tableSlug: string, 
  events: any,
  userId: string
): Promise<any> => {
  const pool = getPool();
  const schemaName = `company_${companyId.replace(/-/g, '_')}`;
  
  // Validate events structure
  validateEventsConfiguration(events);
  
  const query = `
    UPDATE ${schemaName}.custom_data_model 
    SET events = $1, updated_at = NOW()
    WHERE slug = $2
    RETURNING events
  `;
  
  const result = await pool.query(query, [JSON.stringify(events), tableSlug]);
  
  if (result.rows.length === 0) {
    throw new Error(`Table '${tableSlug}' not found`);
  }
  
  console.log(`✅ Updated events configuration for table ${tableSlug}:`, events);
  return result.rows[0].events;
};

/**
 * Remove event configuration for a table
 */
export const removeTableEvents = async (
  companyId: string, 
  tableSlug: string,
  userId: string
): Promise<void> => {
  const pool = getPool();
  const schemaName = `company_${companyId.replace(/-/g, '_')}`;
  
  const query = `
    UPDATE ${schemaName}.custom_data_model 
    SET events = '{}', updated_at = NOW()
    WHERE slug = $1
  `;
  
  const result = await pool.query(query, [tableSlug]);
  
  if (result.rowCount === 0) {
    throw new Error(`Table '${tableSlug}' not found`);
  }
  
  console.log(`✅ Removed events configuration for table ${tableSlug}`);
};

/**
 * Validate events configuration structure
 */
const validateEventsConfiguration = (events: any): void => {
  if (!events || typeof events !== 'object') {
    throw new Error('Events configuration must be an object');
  }
  
  if (events.triggers && !Array.isArray(events.triggers)) {
    throw new Error('Events triggers must be an array');
  }
  
  if (events.triggers) {
    for (const trigger of events.triggers) {
      if (!trigger.workflow_slug || typeof trigger.workflow_slug !== 'string') {
        throw new Error('Each trigger must have a workflow_slug string');
      }
      
      if (!trigger.event || typeof trigger.event !== 'string') {
        throw new Error('Each trigger must have an event string');
      }
      
      const validEvents = ['insert', 'update', 'delete', 'any'];
      if (!validEvents.includes(trigger.event.toLowerCase())) {
        throw new Error(`Event must be one of: ${validEvents.join(', ')}`);
      }
    }
  }
};

/**
 * Get all tables with event configurations
 */
export const getTablesWithEvents = async (companyId: string): Promise<any[]> => {
  const pool = getPool();
  const schemaName = `company_${companyId.replace(/-/g, '_')}`;
  
  const query = `
    SELECT slug, label, events 
    FROM ${schemaName}.custom_data_model 
    WHERE events IS NOT NULL 
    AND events != '{}'::jsonb
    ORDER BY label
  `;
  
  const result = await pool.query(query);
  return result.rows;
};
