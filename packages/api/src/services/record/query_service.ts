import { queryInTenantSchema } from '../../database/utils/database';
import { getSchemaBySlug } from '../schema/schema_service';
import { getFGAClient } from '../../utils/openfga';
import { 
  executeEnhancedQuery,
  EnhancedQueryRequest,
  EnhancedQueryResponse,
  FilterAggregation 
} from './enhanced-query-service';

// Enhanced query interfaces
export interface RelationColumn {
  label: string;
  local_key: string;
  foreign_table: string;
  foreign_key: string;
  display_columns: string[];
  filters?: Record<string, any>;
}

export interface AggColumn {
  label: string;
  local_key: string;
  foreign_table: string;
  foreign_key: string;
  function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'array_agg' | 'string_agg';
  function_field?: string;
  filters?: Record<string, any>;
  group_by?: string[];
}

export interface TableQueryRequest {
  columns?: string[];
  filters?: Record<string, any>;
  search?: string;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
  // Enhanced query features
  relationColumns?: RelationColumn[];
  aggColumns?: AggColumn[];
  aggregation_filter?: string[];
}

export interface KanbanQueryRequest {
  statusColumn: string;
  groupByColumn?: string;
  columns?: string[];
  filters?: Record<string, any>;
  search?: string;
  limit?: number;
  // Enhanced query features
  relationColumns?: RelationColumn[];
  aggColumns?: AggColumn[];
  aggregation_filter?: string[];
}

export interface TreeQueryRequest {
  parentColumn: string;
  labelColumn: string;
  columns?: string[];
  rootValue?: any;
  maxDepth?: number;
  filters?: Record<string, any>;
  // Enhanced query features
  relationColumns?: RelationColumn[];
  aggColumns?: AggColumn[];
  aggregation_filter?: string[];
}

export interface AggregationRequest {
  groupBy?: string[];
  aggregations: {
    column: string;
    function: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
    alias?: string;
  }[];
  filters?: Record<string, any>;
  having?: Record<string, any>;
}

export interface ChartDataRequest {
  chartType: 'bar' | 'line' | 'pie' | 'scatter';
  xAxis: string;
  yAxis: string;
  aggregation?: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
  groupBy?: string;
  filters?: Record<string, any>;
  limit?: number;
}

export interface GanttQueryRequest {
  taskNameColumn: string;
  startDateColumn: string;
  endDateColumn: string;
  progressColumn?: string;
  dependencyColumn?: string;
  categoryColumn?: string;
  assigneeColumn?: string;
  columns?: string[];
  filters?: Record<string, any>;
  search?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  // Enhanced query features
  relationColumns?: RelationColumn[];
  aggColumns?: AggColumn[];
  aggregation_filter?: string[];
}

export interface DropdownQueryRequest {
  label: string;
  value: string;
  search?: string;
  filters?: Record<string, any>;
  sort?: Array<{ field: string; direction: 'ASC' | 'DESC' }>;
  limit?: number;
  distinct?: boolean;
  includeEmpty?: boolean;
  groupBy?: string;
}

/**
 * Execute table view query with enhanced features
 */
export const executeTableQuery = async (
  companyId: string,
  tableSlug: string,
  userId: string,
  queryRequest: TableQueryRequest
): Promise<{ records: any[]; total: number; columns: string[]; aggregation?: Record<string, FilterAggregation> }> => {
  try {
    // Convert TableQueryRequest to EnhancedQueryRequest
    const enhancedRequest: EnhancedQueryRequest = {
      columns: queryRequest.columns || ['*'],
      filters: queryRequest.filters,
      search: queryRequest.search,
      sort: queryRequest.orderBy ? [{
        field: queryRequest.orderBy,
        direction: queryRequest.orderDirection || 'DESC'
      }] : undefined,
      limit: queryRequest.limit,
      offset: queryRequest.offset,
      relationColumns: queryRequest.relationColumns,
      aggColumns: queryRequest.aggColumns,
      aggregation_filter: queryRequest.aggregation_filter
    };

    // Use enhanced query service
    const result = await executeEnhancedQuery(companyId, tableSlug, userId, enhancedRequest);
    
    return {
      records: result.records,
      total: result.total,
      columns: queryRequest.columns || ['*'],
      aggregation: result.aggregation
    };
  } catch (error) {
    console.error('Error executing table query:', error);
    throw error;
  }
};

/**
 * Execute Kanban view query with enhanced features
 */
export const executeKanbanQuery = async (
  companyId: string,
  tableSlug: string,
  userId: string,
  queryRequest: KanbanQueryRequest
): Promise<{ boards: any[]; aggregation?: Record<string, FilterAggregation> }> => {
  try {
    // Normalize columns - ensure statusColumn is included
    const requestedColumns = queryRequest.columns || ['*'];
    const normalizedColumns = requestedColumns.includes('*') 
      ? ['*'] 
      : [...new Set([queryRequest.statusColumn, ...requestedColumns])];

    // Convert KanbanQueryRequest to EnhancedQueryRequest
    const enhancedRequest: EnhancedQueryRequest = {
      columns: normalizedColumns,
      filters: queryRequest.filters,
      search: queryRequest.search,
      limit: queryRequest.limit,
      relationColumns: queryRequest.relationColumns,
      aggColumns: queryRequest.aggColumns,
      aggregation_filter: queryRequest.aggregation_filter
    };

    // Use enhanced query service
    const result = await executeEnhancedQuery(companyId, tableSlug, userId, enhancedRequest);
    
    // Group records by status column for Kanban view
    const boards: Record<string, any[]> = {};
    
    result.records.forEach(record => {
      const status = record[queryRequest.statusColumn] || 'No Status';
      if (!boards[status]) {
        boards[status] = [];
      }
      boards[status].push(record);
    });

    // Convert to array format
    const boardsArray = Object.entries(boards).map(([status, records]) => ({
      status,
      records,
      count: records.length
    }));

    return {
      boards: boardsArray,
      aggregation: result.aggregation
    };
  } catch (error) {
    console.error('-------------Error executing kanban query:', error);
    throw error;
  }
};

/**
 * Execute Tree view query with enhanced features
 */
export const executeTreeQuery = async (
  companyId: string,
  tableSlug: string,
  userId: string,
  queryRequest: TreeQueryRequest
): Promise<{ tree: any[]; aggregation?: Record<string, FilterAggregation> }> => {
  try {
    // Convert TreeQueryRequest to EnhancedQueryRequest
    const enhancedRequest: EnhancedQueryRequest = {
      columns: queryRequest.columns || ['*'],
      filters: queryRequest.filters,
      relationColumns: queryRequest.relationColumns,
      aggColumns: queryRequest.aggColumns,
      aggregation_filter: queryRequest.aggregation_filter
    };

    // Use enhanced query service
    const result = await executeEnhancedQuery(companyId, tableSlug, userId, enhancedRequest);
    
    // Build tree structure
    const tree = buildTreeStructure(
      result.records, 
      queryRequest.parentColumn, 
      queryRequest.labelColumn,
      queryRequest.rootValue,
      queryRequest.maxDepth
    );

    return {
      tree,
      aggregation: result.aggregation
    };
  } catch (error) {
    console.error('Error executing tree query:', error);
    throw error;
  }
};

/**
 * Execute aggregation query
 */
export const executeAggregationQuery = async (
  companyId: string,
  tableSlug: string,
  userId: string,
  queryRequest: AggregationRequest
): Promise<{ aggregations: any[] }> => {
  try {
    // Validate schema access
    const schema = await getSchemaBySlug(companyId, tableSlug, userId);
    if (!schema) {
      throw new Error('Table not found or access denied');
    }

    // Build aggregation query
    const aggregationClauses = queryRequest.aggregations.map(agg => {
      const alias = agg.alias || `${agg.function.toLowerCase()}_${agg.column}`;
      return `${agg.function}(${agg.column}) as ${alias}`;
    });

    const groupByClause = queryRequest.groupBy && queryRequest.groupBy.length > 0
      ? `GROUP BY ${queryRequest.groupBy.join(', ')}`
      : '';

    // Build WHERE clause
    let whereClause = '';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (queryRequest.filters && Object.keys(queryRequest.filters).length > 0) {
      const filterConditions: string[] = [];
      for (const [column, value] of Object.entries(queryRequest.filters)) {
        if (value !== undefined && value !== null) {
          filterConditions.push(`${column} = $${paramIndex++}`);
          queryParams.push(value);
        }
      }
      if (filterConditions.length > 0) {
        whereClause = `WHERE ${filterConditions.join(' AND ')}`;
      }
    }

    // Build HAVING clause
    let havingClause = '';
    if (queryRequest.having && Object.keys(queryRequest.having).length > 0) {
      const havingConditions: string[] = [];
      for (const [column, value] of Object.entries(queryRequest.having)) {
        if (value !== undefined && value !== null) {
          havingConditions.push(`${column} = $${paramIndex++}`);
          queryParams.push(value);
        }
      }
      if (havingConditions.length > 0) {
        havingClause = `HAVING ${havingConditions.join(' AND ')}`;
      }
    }

    const selectClause = queryRequest.groupBy && queryRequest.groupBy.length > 0
      ? `${queryRequest.groupBy.join(', ')}, ${aggregationClauses.join(', ')}`
      : aggregationClauses.join(', ');

    const query = `
      SELECT ${selectClause}
      FROM ${tableSlug}
      ${whereClause}
      ${groupByClause}
      ${havingClause}
    `;

    const result = await queryInTenantSchema(companyId, query, queryParams);

    return {
      aggregations: result.rows
    };
  } catch (error) {
    console.error('-------------Error executing aggregation query:', error);
    throw error;
  }
};

/**
 * Execute chart data query
 */
export const executeChartDataQuery = async (
  companyId: string,
  tableSlug: string,
  userId: string,
  queryRequest: ChartDataRequest
): Promise<{ chartData: any }> => {
  try {
    // Validate schema access
    const schema = await getSchemaBySlug(companyId, tableSlug, userId);
    if (!schema) {
      throw new Error('Table not found or access denied');
    }

    const { chartType, xAxis, yAxis, aggregation = 'COUNT', groupBy, filters = {}, limit = 100 } = queryRequest;

    // Build aggregation clause
    let aggregationClause = '';
    if (aggregation === 'COUNT') {
      aggregationClause = 'COUNT(*) as y_value';
    } else {
      aggregationClause = `${aggregation}(${yAxis}) as y_value`;
    }

    // Build WHERE clause
    let whereClause = '';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (Object.keys(filters).length > 0) {
      const filterConditions: string[] = [];
      for (const [column, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          filterConditions.push(`${column} = $${paramIndex++}`);
          queryParams.push(value);
        }
      }
      if (filterConditions.length > 0) {
        whereClause = `WHERE ${filterConditions.join(' AND ')}`;
      }
    }

    const groupByClause = groupBy ? `GROUP BY ${xAxis}, ${groupBy}` : `GROUP BY ${xAxis}`;
    const orderByClause = 'ORDER BY y_value DESC';
    const limitClause = `LIMIT $${paramIndex}`;
    queryParams.push(limit);

    const query = `
      SELECT ${xAxis} as x_value, ${groupBy ? `${groupBy} as series,` : ''} ${aggregationClause}
      FROM ${tableSlug}
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      ${limitClause}
    `;

    const result = await queryInTenantSchema(companyId, query, queryParams);

    // Format data based on chart type
    let chartData;
    if (chartType === 'pie') {
      chartData = {
        labels: result.rows.map(row => String(row.x_value)),
        datasets: [{
          data: result.rows.map(row => row.y_value)
        }]
      };
    } else {
      // For line, bar, scatter charts
      const labels: string[] = Array.from(new Set(result.rows.map(row => String(row.x_value))));
      
      if (groupBy) {
        // Multiple series
        const seriesMap = new Map();
        result.rows.forEach(row => {
          const series = row.series;
          if (!seriesMap.has(series)) {
            seriesMap.set(series, { label: series, data: [] });
          }
          seriesMap.get(series).data.push(row.y_value);
        });
        
        chartData = {
          labels,
          datasets: Array.from(seriesMap.values())
        };
      } else {
        // Single series
        chartData = {
          labels,
          datasets: [{
            label: yAxis,
            data: result.rows.map(row => row.y_value)
          }]
        };
      }
    }

    return { chartData };
  } catch (error) {
    console.error('Error executing chart data query:', error);
    throw error;
  }
};

/**
 * Helper function to build tree structure from flat records
 */
const buildTreeStructure = (
  records: any[],
  parentColumn: string,
  labelColumn: string,
  rootValue: any = null,
  maxDepth: number = 10,
  currentDepth: number = 0
): any[] => {
  if (currentDepth >= maxDepth) return [];

  const children = records.filter(record => record[parentColumn] === rootValue);
  
  return children.map(child => ({
    ...child,
    label: child[labelColumn],
    children: buildTreeStructure(
      records,
      parentColumn,
      labelColumn,
      child.id,
      maxDepth,
      currentDepth + 1
    )
  }));
};

/**
 * Execute Gantt chart query for project timeline visualization
 */
export const executeGanttQuery = async (
  companyId: string,
  tableSlug: string,
  userId: string,
  queryRequest: GanttQueryRequest
): Promise<any> => {
  try {
    const schema = await getSchemaBySlug(companyId, tableSlug, userId);
    if (!schema) {
      throw new Error('Schema not found');
    }

    // Validate required columns exist in schema
    const schemaColumns = schema.columns.map(col => col.name);
    const systemColumns = ['id', 'created_at', 'updated_at', 'created_by'];
    const allColumns = [...systemColumns, ...schemaColumns];

    const requiredColumns = [
      queryRequest.taskNameColumn,
      queryRequest.startDateColumn,
      queryRequest.endDateColumn
    ];

    for (const column of requiredColumns) {
      if (!allColumns.includes(column)) {
        throw new Error(`Required column '${column}' not found in schema`);
      }
    }

    // Build enhanced query request
    const enhancedRequest: EnhancedQueryRequest = {
      columns: queryRequest.columns || [
        'id',
        queryRequest.taskNameColumn,
        queryRequest.startDateColumn,
        queryRequest.endDateColumn,
        ...(queryRequest.progressColumn ? [queryRequest.progressColumn] : []),
        ...(queryRequest.dependencyColumn ? [queryRequest.dependencyColumn] : []),
        ...(queryRequest.categoryColumn ? [queryRequest.categoryColumn] : []),
        ...(queryRequest.assigneeColumn ? [queryRequest.assigneeColumn] : []),
        'created_at',
        'updated_at'
      ],
      filters: {
        ...queryRequest.filters
        // Note: Date range filtering will be handled in the enhanced query service
        // The enhanced query service doesn't support Django-style __gte/__lte syntax
      },
      search: queryRequest.search,
      sort: [{ field: queryRequest.startDateColumn, direction: 'ASC' }],
      relationColumns: queryRequest.relationColumns,
      aggColumns: queryRequest.aggColumns,
      aggregation_filter: queryRequest.aggregation_filter
    };

    // Execute the enhanced query
    const result = await executeEnhancedQuery(companyId, tableSlug, userId, enhancedRequest);

    // Apply date range filtering if specified (post-processing since enhanced query doesn't support range filters)
    let filteredRecords = result.records;
    if (queryRequest.dateRange) {
      const startDate = new Date(queryRequest.dateRange.start);
      const endDate = new Date(queryRequest.dateRange.end);
      
      filteredRecords = result.records.filter((record: any) => {
        const recordStartDate = new Date(record[queryRequest.startDateColumn]);
        const recordEndDate = new Date(record[queryRequest.endDateColumn]);
        
        // Include records that overlap with the date range
        return recordStartDate <= endDate && recordEndDate >= startDate;
      });
    }

    // Transform data for Gantt chart format
    const ganttTasks = filteredRecords.map((record: any) => {
      const task: any = {
        id: record.id,
        name: record[queryRequest.taskNameColumn],
        start: record[queryRequest.startDateColumn],
        end: record[queryRequest.endDateColumn],
        // Calculate duration in days
        duration: calculateDuration(
          record[queryRequest.startDateColumn],
          record[queryRequest.endDateColumn]
        )
      };

      // Add optional fields if they exist
      if (queryRequest.progressColumn && record[queryRequest.progressColumn] !== undefined) {
        task.progress = record[queryRequest.progressColumn];
      }
      if (queryRequest.dependencyColumn && record[queryRequest.dependencyColumn]) {
        task.dependencies = Array.isArray(record[queryRequest.dependencyColumn]) 
          ? record[queryRequest.dependencyColumn]
          : [record[queryRequest.dependencyColumn]];
      }
      if (queryRequest.categoryColumn && record[queryRequest.categoryColumn]) {
        task.category = record[queryRequest.categoryColumn];
      }
      if (queryRequest.assigneeColumn && record[queryRequest.assigneeColumn]) {
        task.assignee = record[queryRequest.assigneeColumn];
      }

      // Include all other columns for additional data
      Object.keys(record).forEach(key => {
        if (!['id', queryRequest.taskNameColumn, queryRequest.startDateColumn, queryRequest.endDateColumn].includes(key)) {
          task[key] = record[key];
        }
      });

      return task;
    });

    // Calculate project timeline
    const projectTimeline = calculateProjectTimeline(ganttTasks);

    return {
      tasks: ganttTasks,
      timeline: projectTimeline,
      aggregation: result.aggregation,
      total: filteredRecords.length // Use filtered count instead of original total
    };
  } catch (error) {
    console.error('Error executing Gantt query:', error);
    throw error;
  }
};

/**
 * Calculate duration between two dates in days
 */
const calculateDuration = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Calculate overall project timeline from tasks
 */
const calculateProjectTimeline = (tasks: any[]): any => {
  if (tasks.length === 0) {
    return {
      projectStart: null,
      projectEnd: null,
      totalDuration: 0,
      tasksCount: 0
    };
  }

  const startDates = tasks.map(task => new Date(task.start));
  const endDates = tasks.map(task => new Date(task.end));

  const projectStart = new Date(Math.min(...startDates.map(d => d.getTime())));
  const projectEnd = new Date(Math.max(...endDates.map(d => d.getTime())));
  const totalDuration = calculateDuration(projectStart.toISOString(), projectEnd.toISOString());

  return {
    projectStart: projectStart.toISOString(),
    projectEnd: projectEnd.toISOString(),
    totalDuration,
    tasksCount: tasks.length,
    // Additional statistics
    averageTaskDuration: Math.round(tasks.reduce((sum, task) => sum + task.duration, 0) / tasks.length),
    completedTasks: tasks.filter(task => task.progress === 100 || task.progress === '100').length,
    inProgressTasks: tasks.filter(task => task.progress > 0 && task.progress < 100).length,
    notStartedTasks: tasks.filter(task => !task.progress || task.progress === 0).length
  };
};

/**
 * Execute dropdown query to get label/value pairs for UI dropdowns
 */
export const executeDropdownQuery = async (
  companyId: string,
  tableSlug: string,
  userId: string,
  queryRequest: DropdownQueryRequest
): Promise<any> => {
  try {
    const schema = await getSchemaBySlug(companyId, tableSlug, userId);
    if (!schema) {
      throw new Error('Schema not found');
    }

    const schemaColumns = schema.columns.map(col => col.name);
    const systemColumns = ['id', 'created_at', 'updated_at', 'created_by'];
    const allColumns = [...systemColumns, ...schemaColumns];

    // Validate required columns
    if (!allColumns.includes(queryRequest.label)) {
      throw new Error(`Label column '${queryRequest.label}' not found in schema`);
    }
    if (!allColumns.includes(queryRequest.value)) {
      throw new Error(`Value column '${queryRequest.value}' not found in schema`);
    }
    if (queryRequest.groupBy && !allColumns.includes(queryRequest.groupBy)) {
      throw new Error(`Group by column '${queryRequest.groupBy}' not found in schema`);
    }

    // Build columns to select
    const columnsToSelect = [queryRequest.label, queryRequest.value];
    if (queryRequest.groupBy && !columnsToSelect.includes(queryRequest.groupBy)) {
      columnsToSelect.push(queryRequest.groupBy);
    }

    // Build enhanced query request
    const enhancedRequest: EnhancedQueryRequest = {
      columns: columnsToSelect,
      filters: queryRequest.filters || {},
      search: queryRequest.search,
      sort: queryRequest.sort || [{ field: queryRequest.label, direction: 'ASC' }],
      limit: Math.min(queryRequest.limit || 100, 1000), // Max 1000 options
      offset: 0
    };

    // Execute the query
    const result = await executeEnhancedQuery(companyId, tableSlug, userId, enhancedRequest);

    // Process results into dropdown format
    let options = result.records.map((record: any) => {
      const option: any = {
        label: record[queryRequest.label],
        value: record[queryRequest.value]
      };

      // Add group if specified and the value exists
      if (queryRequest.groupBy && record[queryRequest.groupBy] !== undefined) {
        option.group = record[queryRequest.groupBy];
      }

      return option;
    });

    // Filter out empty values if requested
    if (!queryRequest.includeEmpty) {
      options = options.filter((option: any) => 
        option.label !== null && 
        option.label !== undefined && 
        option.label !== '' &&
        option.value !== null && 
        option.value !== undefined && 
        option.value !== ''
      );
    }

    // Remove duplicates if requested (default: true)
    if (queryRequest.distinct !== false) {
      const seen = new Set();
      options = options.filter((option: any) => {
        const key = `${option.label}|${option.value}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    }

    // Sort by group if groupBy is specified
    if (queryRequest.groupBy) {
      options.sort((a: any, b: any) => {
        if (a.group !== b.group) {
          return (a.group || '').localeCompare(b.group || '');
        }
        return (a.label || '').localeCompare(b.label || '');
      });
    }

    const limit = queryRequest.limit || 100;
    const hasMore = options.length > limit;
    if (hasMore) {
      options = options.slice(0, limit);
    }

    return {
      options,
      total: options.length,
      hasMore
    };
  } catch (error) {
    console.error('Error executing dropdown query:', error);
    throw error;
  }
};

/**
 * Check record permissions using OpenFGA
 */
export const checkRecordPermission = async (
  userId: string,
  companyId: string,
  schemaId: string,
  permission: string,
  recordId?: string
): Promise<boolean> => {
  try {
    const client = getFGAClient();
    const storeId = `company_${companyId}`;

    // For record-level permissions, we check against the specific record
    // For table-level permissions (like creator), we check against the schema
    const objectId = recordId ? `record:${recordId}` : `schema:${schemaId}`;

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
