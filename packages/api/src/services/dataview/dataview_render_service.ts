// Data View Rendering Service for DocPal API
// Handles rendering data for data view widgets using existing query systems

import { getDataViewById, ViewWidget } from './dataview_service';
import { 
  queryTable, 
  queryKanban, 
  queryTree, 
  queryGantt,
  queryDropdown,
  QueryTableRequest,
  QueryKanbanRequest,
  QueryTreeRequest,
  QueryGanttRequest,
  QueryDropdownRequest
} from '../record/enhanced-query-service';

// Types
export interface RenderViewRequest {
  filters?: any[];
  globalFilters?: any[];
}

export interface RenderWidgetRequest extends RenderViewRequest {
  widgetOverrides?: Partial<ViewWidget>;
}

export interface RenderedView {
  view_id: string;
  view_name: string;
  table_slug: string;
  widgets: RenderedWidget[];
}

export interface RenderedWidget {
  widget_id: string;
  widget_label: string;
  component: string;
  data: any;
  error?: string;
}

/**
 * Render complete data view with all widgets
 */
export const renderDataView = async (
  companyId: string,
  viewId: string,
  renderRequest: RenderViewRequest = {}
): Promise<RenderedView> => {
  // Get the view configuration
  const view = await getDataViewById(companyId, viewId);
  if (!view) {
    throw new Error('Data view not found');
  }

  // Render each widget
  const widgets: RenderedWidget[] = [];
  
  for (const widget of view.layout) {
    try {
      const widgetData = await renderWidget(
        companyId, 
        view.table_slug, 
        widget, 
        renderRequest
      );
      
      widgets.push({
        widget_id: widget.id,
        widget_label: widget.label,
        component: widget.component,
        data: widgetData
      });
    } catch (error) {
      // Don't fail entire view if one widget fails
      widgets.push({
        widget_id: widget.id,
        widget_label: widget.label,
        component: widget.component,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return {
    view_id: view.id,
    view_name: view.name,
    table_slug: view.table_slug,
    widgets
  };
};

/**
 * Render individual widget data
 */
export const renderWidget = async (
  companyId: string,
  tableSlug: string,
  widget: ViewWidget,
  renderRequest: RenderWidgetRequest = {}
): Promise<any> => {
  // Merge widget config with any overrides
  const effectiveWidget = {
    ...widget,
    ...renderRequest.widgetOverrides
  };
  
  // Build query request based on widget component and config
  const baseQuery = {
    ...effectiveWidget.config,
    filters: mergeFilters(
      effectiveWidget.config.filters || [],
      renderRequest.filters || [],
      renderRequest.globalFilters || []
    )
  };

  // Route to appropriate query service based on component type
  switch (effectiveWidget.component.toLowerCase()) {
    case 'table':
      return await renderTableWidget(companyId, tableSlug, baseQuery);
      
    case 'kanban':
      return await renderKanbanWidget(companyId, tableSlug, baseQuery);
      
    case 'tree':
      return await renderTreeWidget(companyId, tableSlug, baseQuery);
      
    case 'gantt':
      return await renderGanttWidget(companyId, tableSlug, baseQuery);
      
    case 'dropdown':
      return await renderDropdownWidget(companyId, tableSlug, baseQuery);
      
    default:
      throw new Error(`Unsupported widget component: ${effectiveWidget.component}`);
  }
};

/**
 * Render table widget using enhanced query service
 */
const renderTableWidget = async (
  companyId: string,
  tableSlug: string,
  config: any
): Promise<any> => {
  const queryRequest: QueryTableRequest = {
    columns: config.columns || ['*'],
    relationColumns: config.relationColumns || [],
    aggColumns: config.aggColumns || [],
    filters: config.filters || [],
    sorting: config.sorting || [],
    pagination: config.pagination || { page: 1, limit: 20 }
  };

  return await queryTable(companyId, tableSlug, queryRequest);
};

/**
 * Render kanban widget using enhanced query service
 */
const renderKanbanWidget = async (
  companyId: string,
  tableSlug: string,
  config: any
): Promise<any> => {
  const queryRequest: QueryKanbanRequest = {
    columns: config.columns || ['*'],
    relationColumns: config.relationColumns || [],
    aggColumns: config.aggColumns || [],
    filters: config.filters || [],
    sorting: config.sorting || [],
    pagination: config.pagination || { page: 1, limit: 100 },
    kanban_config: config.kanban_config || {
      status_column: 'status',
      card_title_column: 'name'
    }
  };

  return await queryKanban(companyId, tableSlug, queryRequest);
};

/**
 * Render tree widget using enhanced query service
 */
const renderTreeWidget = async (
  companyId: string,
  tableSlug: string,
  config: any
): Promise<any> => {
  const queryRequest: QueryTreeRequest = {
    columns: config.columns || ['*'],
    relationColumns: config.relationColumns || [],
    aggColumns: config.aggColumns || [],
    filters: config.filters || [],
    sorting: config.sorting || [],
    pagination: config.pagination || { page: 1, limit: 1000 },
    tree_config: config.tree_config || {
      parent_column: 'parent_id',
      label_column: 'name'
    }
  };

  return await queryTree(companyId, tableSlug, queryRequest);
};

/**
 * Render gantt widget using enhanced query service
 */
const renderGanttWidget = async (
  companyId: string,
  tableSlug: string,
  config: any
): Promise<any> => {
  const queryRequest: QueryGanttRequest = {
    columns: config.columns || ['*'],
    relationColumns: config.relationColumns || [],
    aggColumns: config.aggColumns || [],
    filters: config.filters || [],
    sorting: config.sorting || [],
    pagination: config.pagination || { page: 1, limit: 1000 },
    gantt_config: config.gantt_config || {
      start_date_column: 'start_date',
      end_date_column: 'end_date',
      title_column: 'name'
    }
  };

  return await queryGantt(companyId, tableSlug, queryRequest);
};

/**
 * Render dropdown widget using enhanced query service
 */
const renderDropdownWidget = async (
  companyId: string,
  tableSlug: string,
  config: any
): Promise<any> => {
  const queryRequest: QueryDropdownRequest = {
    label_column: config.label_column || 'name',
    value_column: config.value_column || 'id',
    filters: config.filters || [],
    sorting: config.sorting || [],
    search: config.search,
    limit: config.limit || 100,
    include_empty: config.include_empty || false,
    group_by: config.group_by
  };

  return await queryDropdown(companyId, tableSlug, queryRequest);
};

/**
 * Merge multiple filter arrays
 */
const mergeFilters = (...filterArrays: any[][]): any[] => {
  const merged: any[] = [];
  
  for (const filters of filterArrays) {
    if (Array.isArray(filters)) {
      merged.push(...filters);
    }
  }
  
  return merged;
};

/**
 * Get widget data by view and widget ID
 */
export const renderViewWidget = async (
  companyId: string,
  viewId: string,
  widgetId: string,
  renderRequest: RenderWidgetRequest = {}
): Promise<RenderedWidget> => {
  // Get the view configuration
  const view = await getDataViewById(companyId, viewId);
  if (!view) {
    throw new Error('Data view not found');
  }

  // Find the specific widget
  const widget = view.layout.find(w => w.id === widgetId);
  if (!widget) {
    throw new Error('Widget not found in view');
  }

  try {
    const widgetData = await renderWidget(
      companyId, 
      view.table_slug, 
      widget, 
      renderRequest
    );
    
    return {
      widget_id: widget.id,
      widget_label: widget.label,
      component: widget.component,
      data: widgetData
    };
  } catch (error) {
    return {
      widget_id: widget.id,
      widget_label: widget.label,
      component: widget.component,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
