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
    // Convert KanbanQueryRequest to EnhancedQueryRequest
    const enhancedRequest: EnhancedQueryRequest = {
      columns: queryRequest.columns || ['*'],
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
    console.error('Error executing kanban query:', error);
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
    console.error('Error executing aggregation query:', error);
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
