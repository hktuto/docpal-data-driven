// Data View Service for DocPal API
// Handles data view CRUD operations and rendering within company schemas

import { v4 as uuidv4 } from 'uuid';
import { queryInTenantSchema, withTenantTransaction } from '../../database/utils/database';

// Types
export interface DataView {
  id: string;
  name: string;
  description?: string;
  table_slug: string;
  is_default: boolean;
  layout: ViewWidget[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ViewWidget {
  id: string;                    // Simple string: "widget_1", "widget_2"
  label: string;                 // "Recent Orders", "Project Tree"
  column: number;                // Start column (1-24)
  row: number;                   // Start row (1+)
  width: number;                 // Span columns (1-24)
  height: number;                // Span rows (1+)
  component: string;             // Flexible: 'table', 'tree', 'chart', etc.
  config: Record<string, any>;   // Flexible config object
}

export interface CreateDataViewData {
  name: string;
  description?: string;
  table_slug: string;
  is_default?: boolean;
  layout: ViewWidget[];
}

export interface UpdateDataViewData {
  name?: string;
  description?: string;
  is_default?: boolean;
  layout?: ViewWidget[];
}

/**
 * Get all data views for a table
 */
export const getDataViews = async (companyId: string, tableSlug: string): Promise<DataView[]> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      name,
      description,
      table_slug,
      is_default,
      layout,
      created_by,
      created_at,
      updated_at
    FROM data_views
    WHERE table_slug = $1
    ORDER BY is_default DESC, name ASC
  `, [tableSlug]);
  
  return result.rows.map(row => ({
    ...row,
    layout: Array.isArray(row.layout) ? row.layout : []
  }));
};

/**
 * Get data view by ID
 */
export const getDataViewById = async (companyId: string, viewId: string): Promise<DataView | null> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      name,
      description,
      table_slug,
      is_default,
      layout,
      created_by,
      created_at,
      updated_at
    FROM data_views
    WHERE id = $1
  `, [viewId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const view = result.rows[0];
  return {
    ...view,
    layout: Array.isArray(view.layout) ? view.layout : []
  };
};

/**
 * Get default view for a table
 */
export const getDefaultDataView = async (companyId: string, tableSlug: string): Promise<DataView | null> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      name,
      description,
      table_slug,
      is_default,
      layout,
      created_by,
      created_at,
      updated_at
    FROM data_views
    WHERE table_slug = $1 AND is_default = true
    LIMIT 1
  `, [tableSlug]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const view = result.rows[0];
  return {
    ...view,
    layout: Array.isArray(view.layout) ? view.layout : []
  };
};

/**
 * Create new data view
 */
export const createDataView = async (
  companyId: string, 
  viewData: CreateDataViewData, 
  createdBy: string
): Promise<DataView> => {
  const { name, description, table_slug, is_default = false, layout } = viewData;
  
  // Validate layout
  validateViewLayout(layout);
  
  return await withTenantTransaction(companyId, async (client) => {
    // If this is being set as default, unset any existing default
    if (is_default) {
      await client.query(
        'UPDATE data_views SET is_default = false WHERE table_slug = $1 AND is_default = true',
        [table_slug]
      );
    }
    
    const result = await client.query(`
      INSERT INTO data_views (
        id, name, description, table_slug, is_default, layout, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING 
        id, name, description, table_slug, is_default, layout, 
        created_by, created_at, updated_at
    `, [uuidv4(), name, description, table_slug, is_default, JSON.stringify(layout), createdBy]);
    
    const view = result.rows[0];
    return {
      ...view,
      layout: Array.isArray(view.layout) ? view.layout : []
    };
  });
};

/**
 * Update data view
 */
export const updateDataView = async (
  companyId: string,
  viewId: string,
  updateData: UpdateDataViewData
): Promise<DataView> => {
  const { name, description, is_default, layout } = updateData;
  
  // Validate layout if provided
  if (layout) {
    validateViewLayout(layout);
  }
  
  return await withTenantTransaction(companyId, async (client) => {
    // Get existing view to check table_slug for default handling
    const existingResult = await client.query(
      'SELECT table_slug FROM data_views WHERE id = $1',
      [viewId]
    );
    
    if (existingResult.rows.length === 0) {
      throw new Error('Data view not found');
    }
    
    const tableSlug = existingResult.rows[0].table_slug;
    
    // If this is being set as default, unset any existing default
    if (is_default) {
      await client.query(
        'UPDATE data_views SET is_default = false WHERE table_slug = $1 AND is_default = true AND id != $2',
        [tableSlug, viewId]
      );
    }
    
    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (is_default !== undefined) {
      updateFields.push(`is_default = $${paramCount++}`);
      values.push(is_default);
    }
    if (layout !== undefined) {
      updateFields.push(`layout = $${paramCount++}`);
      values.push(JSON.stringify(layout));
    }
    
    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }
    
    updateFields.push(`updated_at = NOW()`);
    values.push(viewId);
    
    const result = await client.query(`
      UPDATE data_views 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING 
        id, name, description, table_slug, is_default, layout, 
        created_by, created_at, updated_at
    `, values);
    
    if (result.rows.length === 0) {
      throw new Error('Data view not found');
    }
    
    const view = result.rows[0];
    return {
      ...view,
      layout: Array.isArray(view.layout) ? view.layout : []
    };
  });
};

/**
 * Delete data view
 */
export const deleteDataView = async (companyId: string, viewId: string): Promise<void> => {
  await withTenantTransaction(companyId, async (client) => {
    // Check if this is a default view
    const viewResult = await client.query(
      'SELECT is_default, table_slug FROM data_views WHERE id = $1',
      [viewId]
    );
    
    if (viewResult.rows.length === 0) {
      throw new Error('Data view not found');
    }
    
    const { is_default, table_slug } = viewResult.rows[0];
    
    // Delete the view
    const result = await client.query(
      'DELETE FROM data_views WHERE id = $1',
      [viewId]
    );
    
    if (result.rowCount === 0) {
      throw new Error('Data view not found');
    }
    
    // If we deleted the default view, set another view as default if available
    if (is_default) {
      await client.query(`
        UPDATE data_views 
        SET is_default = true 
        WHERE table_slug = $1 
        AND id = (
          SELECT id FROM data_views 
          WHERE table_slug = $1 
          ORDER BY created_at ASC 
          LIMIT 1
        )
      `, [table_slug]);
    }
  });
};

/**
 * Set a view as the default for its table
 */
export const setDefaultDataView = async (companyId: string, viewId: string): Promise<DataView> => {
  return await withTenantTransaction(companyId, async (client) => {
    // Get the view to find its table_slug
    const viewResult = await client.query(
      'SELECT table_slug FROM data_views WHERE id = $1',
      [viewId]
    );
    
    if (viewResult.rows.length === 0) {
      throw new Error('Data view not found');
    }
    
    const tableSlug = viewResult.rows[0].table_slug;
    
    // Unset any existing default for this table
    await client.query(
      'UPDATE data_views SET is_default = false WHERE table_slug = $1 AND is_default = true',
      [tableSlug]
    );
    
    // Set this view as default
    const result = await client.query(`
      UPDATE data_views 
      SET is_default = true, updated_at = NOW()
      WHERE id = $1
      RETURNING 
        id, name, description, table_slug, is_default, layout, 
        created_by, created_at, updated_at
    `, [viewId]);
    
    const view = result.rows[0];
    return {
      ...view,
      layout: Array.isArray(view.layout) ? view.layout : []
    };
  });
};

/**
 * Create default view for a table
 */
export const createDefaultTableView = async (
  companyId: string,
  tableSlug: string,
  tableLabel: string,
  createdBy: string
): Promise<DataView> => {
  const defaultLayout: ViewWidget[] = [
    {
      id: 'widget_1',
      label: `All ${tableLabel}`,
      column: 1,
      row: 1,
      width: 24,
      height: 4,
      component: 'table',
      config: {
        columns: ['*'], // All columns
        pagination: { page: 1, limit: 20 },
        sorting: [{ column: 'created_at', direction: 'desc' }]
      }
    }
  ];
  
  return await createDataView(companyId, {
    name: `Default ${tableLabel} View`,
    description: `Default table view showing all ${tableLabel.toLowerCase()} records`,
    table_slug: tableSlug,
    is_default: true,
    layout: defaultLayout
  }, createdBy);
};

/**
 * Create default tree view for a table (if it has parent-child relationship)
 */
export const createDefaultTreeView = async (
  companyId: string,
  tableSlug: string,
  tableLabel: string,
  parentColumn: string,
  labelColumn: string,
  createdBy: string
): Promise<DataView> => {
  const treeLayout: ViewWidget[] = [
    {
      id: 'widget_1',
      label: `${tableLabel} Hierarchy`,
      column: 1,
      row: 1,
      width: 24,
      height: 4,
      component: 'tree',
      config: {
        columns: [labelColumn, 'created_at'],
        tree_config: {
          parent_column: parentColumn,
          label_column: labelColumn,
          expand_levels: 2
        }
      }
    }
  ];
  
  return await createDataView(companyId, {
    name: `${tableLabel} Tree View`,
    description: `Hierarchical view of ${tableLabel.toLowerCase()} records`,
    table_slug: tableSlug,
    is_default: false, // Don't make tree view default
    layout: treeLayout
  }, createdBy);
};

/**
 * Validate view layout
 */
const validateViewLayout = (layout: ViewWidget[]): void => {
  if (!Array.isArray(layout)) {
    throw new Error('Layout must be an array');
  }
  
  if (layout.length === 0) {
    throw new Error('Layout must contain at least one widget');
  }
  
  const widgetIds = new Set<string>();
  
  for (const widget of layout) {
    // Check required fields
    if (!widget.id || !widget.label || !widget.component) {
      throw new Error('Widget must have id, label, and component');
    }
    
    // Check for duplicate IDs
    if (widgetIds.has(widget.id)) {
      throw new Error(`Duplicate widget ID: ${widget.id}`);
    }
    widgetIds.add(widget.id);
    
    // Validate grid positioning
    if (widget.column < 1 || widget.column > 24) {
      throw new Error(`Widget column must be between 1 and 24, got: ${widget.column}`);
    }
    
    if (widget.row < 1) {
      throw new Error(`Widget row must be at least 1, got: ${widget.row}`);
    }
    
    if (widget.width < 1 || widget.width > 24) {
      throw new Error(`Widget width must be between 1 and 24, got: ${widget.width}`);
    }
    
    if (widget.height < 1) {
      throw new Error(`Widget height must be at least 1, got: ${widget.height}`);
    }
    
    // Check if widget exceeds grid bounds
    if (widget.column + widget.width - 1 > 24) {
      throw new Error(`Widget extends beyond grid: column ${widget.column} + width ${widget.width} > 24`);
    }
    
    // Validate config is an object
    if (widget.config && typeof widget.config !== 'object') {
      throw new Error('Widget config must be an object');
    }
  }
};

/**
 * Search data views by name
 */
export const searchDataViews = async (
  companyId: string, 
  tableSlug: string,
  searchTerm: string, 
  limit: number = 50
): Promise<DataView[]> => {
  const result = await queryInTenantSchema(companyId, `
    SELECT 
      id,
      name,
      description,
      table_slug,
      is_default,
      layout,
      created_by,
      created_at,
      updated_at
    FROM data_views
    WHERE 
      table_slug = $1 AND (
        name ILIKE $2 OR 
        description ILIKE $2
      )
    ORDER BY is_default DESC, name ASC
    LIMIT $3
  `, [tableSlug, `%${searchTerm}%`, limit]);
  
  return result.rows.map(row => ({
    ...row,
    layout: Array.isArray(row.layout) ? row.layout : []
  }));
};
