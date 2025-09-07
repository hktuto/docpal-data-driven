import { queryInTenantSchema } from '../../database/utils/database';
import { getSchemaBySlug } from '../schema/schema_service';
import { getFGAClient } from '../../utils/openfga';
import { CustomDataModel, ColumnDefinition } from '../../types';

// Enhanced Query Request Types
export interface EnhancedQueryRequest {
  columns: string[];
  filters?: Record<string, any>;
  sort?: { field: string; direction: 'ASC' | 'DESC' }[];
  search?: string;
  limit?: number;
  offset?: number;
  relationColumns?: RelationColumn[];
  aggColumns?: AggColumn[];
  aggregation_filter?: string[];
}

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

// Response Types
export interface EnhancedQueryResponse {
  records: any[];
  total: number;
  limit: number;
  offset: number;
  aggregation?: {
    [column_name: string]: FilterAggregation;
  };
}

export type FilterAggregation = 
  | TextFilterAggregation 
  | NumberFilterAggregation 
  | DateFilterAggregation 
  | BooleanFilterAggregation
  | RelationFilterAggregation;

export interface TextFilterAggregation {
  type: 'text';
  values: string[];
  count: Record<string, number>;
}

export interface NumberFilterAggregation {
  type: 'number';
  min: number;
  max: number;
  avg: number;
  count: number;
  distribution?: { range: string; count: number }[];
}

export interface DateFilterAggregation {
  type: 'date';
  min_date: string;
  max_date: string;
  distribution?: { period: string; count: number }[];
}

export interface BooleanFilterAggregation {
  type: 'boolean';
  true_count: number;
  false_count: number;
  null_count: number;
}

export interface RelationFilterAggregation {
  type: 'relation';
  values: { id: string; display: string; count: number }[];
}

// Internal Types
interface ParsedColumn {
  original: string;
  column: string;
  alias: string;
  type: 'standard' | 'relation' | 'json_path';
  json_path?: string;
  relation_info?: {
    target_table: string;
    target_field: string;
    display_field: string;
  };
}

/**
 * Enhanced Query Service - Functional approach for advanced queries with relations, aggregations, and filters
 */

/**
 * Execute enhanced query with all features
 */
export const executeEnhancedQuery = async (
  companyId: string,
  tableSlug: string,
  userId: string,
  request: EnhancedQueryRequest
): Promise<EnhancedQueryResponse> => {
  try {
    // Validate schema access
    const schema = await getSchemaBySlug(companyId, tableSlug, userId);
    if (!schema) {
      throw new Error('Table not found or access denied');
    }

    // Parse columns and build query
    const parsedColumns = await parseColumns(request.columns, schema);
    const { query, params } = await buildBaseQuery(
      companyId, 
      tableSlug, 
      parsedColumns, 
      request, 
      schema
    );

    // Execute main query
    const records =  await queryInTenantSchema(companyId, query, params);

    // Add relation data
    const recordsWithRelations = await addRelationData(
      companyId, 
      records.rows, 
      request.relationColumns || []
    );

    // Add aggregation data
    const recordsWithAggregations = await addAggregationData(
      companyId,
      recordsWithRelations,
      request.aggColumns || []
    );

    // Get total count
    const total = await getTotalCount(companyId, tableSlug, request, schema);

    // Generate filter aggregations if requested
    const aggregation = request.aggregation_filter 
      ? await generateFilterAggregations(companyId, tableSlug, request.aggregation_filter, request, schema)
      : undefined;

    return {
      records: recordsWithAggregations,
      total,
      limit: request.limit || 50,
      offset: request.offset || 0,
      aggregation
    };

  } catch (error) {
    console.error('Error executing enhanced query:', error);
    throw error;
  }
};

/**
 * Parse column specifications with dot notation support
 */
const parseColumns = async (columns: string[], schema: CustomDataModel, additionalColumns?: string[]): Promise<ParsedColumn[]> => {
  const parsed: ParsedColumn[] = [];
  
  // Handle wildcard columns
  if (columns.includes('*')) {
    // For wildcard, include all schema columns plus system columns
    const schemaColumns = schema.columns.map(col => col.name);
    const systemColumns = ['id', 'created_at', 'updated_at', 'created_by'];
    const allColumns = [...new Set([...systemColumns, ...schemaColumns, ...(additionalColumns || [])])];
    
    for (const columnSpec of allColumns) {
      parsed.push({
        original: columnSpec,
        column: columnSpec,
        alias: columnSpec,
        type: 'standard'
      });
    }
    return parsed;
  }

  // Normalize columns - ensure system columns and additional columns are included
  const systemColumns = ['id', 'created_at', 'updated_at', 'created_by'];
  const allColumns = [...new Set([...systemColumns, ...(additionalColumns || []), ...columns])];

  for (const columnSpec of allColumns) {
      if (columnSpec.includes('.')) {
        // Handle dot notation
        const parts = columnSpec.split('.');
        const baseColumn = parts[0];
        const path = parts.slice(1).join('.');

        // Check if it's a relation column
        const schemaColumn = schema.columns.find(col => col.name === baseColumn);
        if (schemaColumn && schemaColumn.view_type === 'relation' && (schemaColumn as any).is_relation) {
          // Relation column
          const relationSetting = (schemaColumn as any).relation_setting;
          parsed.push({
            original: columnSpec,
            column: baseColumn,
            alias: columnSpec,
            type: 'relation',
            relation_info: {
              target_table: relationSetting.target_table,
              target_field: relationSetting.target_field,
              display_field: path || relationSetting.display_field
            }
          });
        } else {
          // JSON path
          parsed.push({
            original: columnSpec,
            column: baseColumn,
            alias: columnSpec,
            type: 'json_path',
            json_path: path
          });
        }
      } else {
        // Standard column
        parsed.push({
          original: columnSpec,
          column: columnSpec,
          alias: columnSpec,
          type: 'standard'
        });
      }
    }

    return parsed;
};

/**
 * Build base SQL query
 */
const buildBaseQuery = async (
    companyId: string,
    tableSlug: string,
    parsedColumns: ParsedColumn[],
    request: EnhancedQueryRequest,
    schema: CustomDataModel
): Promise<{ query: string; params: any[] }> => {
    // Build SELECT clause
    const selectParts: string[] = [];
    
    for (const col of parsedColumns) {
      switch (col.type) {
        case 'standard':
          selectParts.push(`${col.column}`);
          break;
          
        case 'json_path':
          // PostgreSQL JSON path extraction
          const jsonPath = col.json_path!.split('.').map(p => `'${p}'`).join('->');
          selectParts.push(`${col.column}->${jsonPath} as "${col.alias}"`);
          break;
          
        case 'relation':
          // Subquery for relation data
          const relationInfo = col.relation_info!;
          const subquery = `(
            SELECT ${relationInfo.display_field} 
            FROM ${relationInfo.target_table} 
            WHERE ${relationInfo.target_field} = ${tableSlug}.${col.column}
            LIMIT 1
          ) as "${col.alias}"`;
          selectParts.push(subquery);
          break;
      }
    }

    // Build WHERE clause
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Add filters
    if (request.filters && Object.keys(request.filters).length > 0) {
      for (const [column, value] of Object.entries(request.filters)) {
        if (value !== undefined && value !== null) {
          if (column.includes('.')) {
            // Handle JSON path filters
            const parts = column.split('.');
            const baseColumn = parts[0];
            const jsonPath = parts.slice(1).map(p => `'${p}'`).join('->');
            whereConditions.push(`${baseColumn}->${jsonPath} = $${paramIndex}`);
          } else {
            // Standard column filter
            whereConditions.push(`${column} = $${paramIndex}`);
          }
          queryParams.push(value);
          paramIndex++;
        }
      }
    }

    // Add search
    if (request.search && request.search.trim()) {
      const textColumns = schema.columns
        .filter(col => ['text', 'varchar', 'string'].includes(col.data_type))
        .map(col => col.name);
      
      if (textColumns.length > 0) {
        const searchConditions = textColumns.map(col => 
          `${col}::text ILIKE $${paramIndex}`
        );
        whereConditions.push(`(${searchConditions.join(' OR ')})`);
        queryParams.push(`%${request.search.trim()}%`);
        paramIndex++;
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Build ORDER BY clause
    let orderByClause = '';
    if (request.sort && request.sort.length > 0) {
      const orderParts = request.sort.map(s => `${s.field} ${s.direction}`);
      orderByClause = `ORDER BY ${orderParts.join(', ')}`;
    } else {
      orderByClause = 'ORDER BY created_at DESC';
    }

    // Add limit and offset parameters
    queryParams.push(request.limit || 50, request.offset || 0);

    // Build complete query
    const query = `
      SELECT ${selectParts.join(', ')}
      FROM ${tableSlug}
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    return { query, params: queryParams };
};



/**
 * Add relation data to records
 */
const addRelationData = async (
  companyId: string,
  records: any[],
  relationColumns: RelationColumn[]
): Promise<any[]> => {
    if (relationColumns.length === 0) return records;

    // For each relation column, fetch related data
    for (const relation of relationColumns) {
      const recordIds = records.map(r => r[relation.local_key]).filter(id => id);
      
      if (recordIds.length > 0) {
        // Build relation query
        const selectFields = relation.display_columns.join(', ');
        const relationQuery = `
          SELECT ${relation.foreign_key}, ${selectFields}
          FROM ${relation.foreign_table}
          WHERE ${relation.foreign_key} = ANY($1)
        `;

        const relationResult = await queryInTenantSchema(companyId, relationQuery, [recordIds]);
        
        // Map relation data back to records
        const relationMap = new Map();
        relationResult.rows.forEach(row => {
          const key = row[relation.foreign_key];
          const data: any = {};
          relation.display_columns.forEach(col => {
            data[col] = row[col];
          });
          relationMap.set(key, data);
        });

        // Add relation data to records
        records.forEach(record => {
          const relationKey = record[relation.local_key];
          record[relation.label] = relationMap.get(relationKey) || null;
        });
      }
    }

    return records;
};

/**
 * Add aggregation data to records
 */
const addAggregationData = async (
  companyId: string,
  records: any[],
  aggColumns: AggColumn[]
): Promise<any[]> => {
    if (aggColumns.length === 0) return records;

    // For each aggregation column, calculate aggregated values
    for (const agg of aggColumns) {
      const recordIds = records.map(r => r[agg.local_key]).filter(id => id);
      
      if (recordIds.length > 0) {
        let aggFunction = '';
        switch (agg.function) {
          case 'count':
            aggFunction = 'COUNT(*)';
            break;
          case 'sum':
            aggFunction = `SUM(${agg.function_field})`;
            break;
          case 'avg':
            aggFunction = `AVG(${agg.function_field})`;
            break;
          case 'min':
            aggFunction = `MIN(${agg.function_field})`;
            break;
          case 'max':
            aggFunction = `MAX(${agg.function_field})`;
            break;
          case 'array_agg':
            aggFunction = `ARRAY_AGG(${agg.function_field || '*'})`;
            break;
        }

        const aggQuery = `
          SELECT ${agg.foreign_key}, ${aggFunction} as agg_value
          FROM ${agg.foreign_table}
          WHERE ${agg.foreign_key} = ANY($1)
          GROUP BY ${agg.foreign_key}
        `;

        const aggResult = await queryInTenantSchema(companyId, aggQuery, [recordIds]);
        
        // Map aggregation data back to records
        const aggMap = new Map();
        aggResult.rows.forEach(row => {
          aggMap.set(row[agg.foreign_key], row.agg_value);
        });

        // Add aggregation data to records
        records.forEach(record => {
          const aggKey = record[agg.local_key];
          record[agg.label] = aggMap.get(aggKey) || (agg.function === 'count' ? 0 : null);
        });
      }
    }

    return records;
};

/**
 * Get total count for pagination
 */
const getTotalCount = async (
  companyId: string,
  tableSlug: string,
  request: EnhancedQueryRequest,
  schema: CustomDataModel
): Promise<number> => {
    // Build count query (simplified version of main query)
    const countQuery = `SELECT COUNT(*) FROM ${tableSlug}`;
    const result = await queryInTenantSchema(companyId, countQuery);
    return parseInt(result.rows[0].count);
};

/**
 * Generate filter aggregations for dynamic UI
 */
const generateFilterAggregations = async (
  companyId: string,
  tableSlug: string,
  filterColumns: string[],
  request: EnhancedQueryRequest,
  schema: CustomDataModel
): Promise<Record<string, FilterAggregation>> => {
    const aggregations: Record<string, FilterAggregation> = {};

    for (const columnName of filterColumns) {
      const schemaColumn = schema.columns.find(col => col.name === columnName);
      if (!schemaColumn) continue;

      const aggregation = await generateColumnAggregation(
        companyId,
        tableSlug,
        columnName,
        schemaColumn
      );
      
      if (aggregation) {
        aggregations[columnName] = aggregation;
      }
    }

    return aggregations;
};

/**
 * Generate aggregation for a specific column based on its data type
 */
const generateColumnAggregation = async (
  companyId: string,
  tableSlug: string,
  columnName: string,
  schemaColumn: ColumnDefinition
): Promise<FilterAggregation | null> => {
    try {
      switch (schemaColumn.data_type) {
        case 'varchar':
        case 'text':
          return await generateTextAggregation(companyId, tableSlug, columnName);
          
        case 'integer':
        case 'decimal':
        case 'float':
          return await generateNumberAggregation(companyId, tableSlug, columnName);
          
        case 'boolean':
          return await generateBooleanAggregation(companyId, tableSlug, columnName);
          
        case 'timestamp':
        case 'date':
          return await generateDateAggregation(companyId, tableSlug, columnName);
          
        default:
          return null;
      }
    } catch (error) {
      console.error(`Error generating aggregation for column ${columnName}:`, error);
      return null;
    }
};

/**
 * Generate text column aggregation
 */
const generateTextAggregation = async (
  companyId: string,
  tableSlug: string,
  columnName: string
): Promise<TextFilterAggregation> => {
    const query = `
      SELECT ${columnName}, COUNT(*) as count
      FROM ${tableSlug}
      WHERE ${columnName} IS NOT NULL
      GROUP BY ${columnName}
      ORDER BY count DESC
      LIMIT 50
    `;
    
    const result = await queryInTenantSchema(companyId, query);
    
    const values: string[] = [];
    const count: Record<string, number> = {};
    
    result.rows.forEach(row => {
      const value = String(row[columnName]);
      values.push(value);
      count[value] = parseInt(row.count);
    });

    return { type: 'text', values, count };
};

/**
 * Generate number column aggregation
 */
const generateNumberAggregation = async (
  companyId: string,
  tableSlug: string,
  columnName: string
): Promise<NumberFilterAggregation> => {
    const query = `
      SELECT 
        MIN(${columnName}) as min_val,
        MAX(${columnName}) as max_val,
        AVG(${columnName}) as avg_val,
        COUNT(*) as count_val
      FROM ${tableSlug}
      WHERE ${columnName} IS NOT NULL
    `;
    
    const result = await queryInTenantSchema(companyId, query);
    const row = result.rows[0];

    return {
      type: 'number',
      min: parseFloat(row.min_val),
      max: parseFloat(row.max_val),
      avg: parseFloat(row.avg_val),
      count: parseInt(row.count_val)
    };
};

/**
 * Generate boolean column aggregation
 */
const generateBooleanAggregation = async (
  companyId: string,
  tableSlug: string,
  columnName: string
): Promise<BooleanFilterAggregation> => {
    const query = `
      SELECT 
        SUM(CASE WHEN ${columnName} = true THEN 1 ELSE 0 END) as true_count,
        SUM(CASE WHEN ${columnName} = false THEN 1 ELSE 0 END) as false_count,
        SUM(CASE WHEN ${columnName} IS NULL THEN 1 ELSE 0 END) as null_count
      FROM ${tableSlug}
    `;
    
    const result = await queryInTenantSchema(companyId, query);
    const row = result.rows[0];

    return {
      type: 'boolean',
      true_count: parseInt(row.true_count),
      false_count: parseInt(row.false_count),
      null_count: parseInt(row.null_count)
    };
};

/**
 * Generate date column aggregation
 */
const generateDateAggregation = async (
  companyId: string,
  tableSlug: string,
  columnName: string
): Promise<DateFilterAggregation> => {
    const query = `
      SELECT 
        MIN(${columnName}) as min_date,
        MAX(${columnName}) as max_date
      FROM ${tableSlug}
      WHERE ${columnName} IS NOT NULL
    `;
    
    const result = await queryInTenantSchema(companyId, query);
    const row = result.rows[0];

    return {
      type: 'date',
      min_date: row.min_date,
      max_date: row.max_date
    };
};
