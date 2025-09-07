# Enhanced Query System Design

## Overview

This document outlines the enhanced query system that supports:
- Simple column selection with dot notation for relations and JSON paths
- Explicit relationship queries
- Aggregation operations
- Dynamic filter aggregation for building UIs

## Query Request Schema

### Core Request Structure

```typescript
interface QueryRequest {
  // Simple column selection with dot notation
  columns: string[];  // ['name', 'user_id.email', 'preferences.colormode.default']
  
  // Standard query operations
  filters: Record<string, any>;
  sort: { field: string; direction: 'ASC' | 'DESC' }[];
  search: string;
  limit?: number;
  offset?: number;
  
  // Explicit relationship queries
  relationColumns?: RelationColumn[];
  
  // Aggregation queries  
  aggColumns?: AggColumn[];
  
  // Dynamic filter aggregation
  aggregation_filter?: string[];
}

interface RelationColumn {
  label: string;           // Key in response
  local_key: string;       // Column in current table
  foreign_table: string;   // Target table slug
  foreign_key: string;     // Column in target table
  display_columns: string[]; // Multiple columns to return
  filters?: Record<string, any>; // Optional filters on related data
}

interface AggColumn {
  label: string;           // Key in response
  local_key: string;       // Column in current table  
  foreign_table: string;   // Target table slug
  foreign_key: string;     // Column in target table
  function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'array_agg' | 'string_agg';
  function_field?: string; // Field to calculate (optional for count)
  filters?: Record<string, any>; // Optional filters
  group_by?: string[];     // Optional grouping
}

interface QueryResponse {
  records: any[];
  total: number;
  limit: number;
  offset: number;
  
  // Dynamic filter options based on data types
  aggregation?: {
    [column_name: string]: FilterAggregation;
  };
}

type FilterAggregation = 
  | TextFilterAggregation 
  | NumberFilterAggregation 
  | DateFilterAggregation 
  | BooleanFilterAggregation
  | RelationFilterAggregation;

interface TextFilterAggregation {
  type: 'text';
  values: string[];           // Unique values
  count: Record<string, number>; // Value frequencies
}

interface NumberFilterAggregation {
  type: 'number';
  min: number;
  max: number;
  avg: number;
  count: number;
  distribution?: { range: string; count: number }[]; // Optional histogram
}

interface DateFilterAggregation {
  type: 'date';
  min_date: string;           // Earliest date
  max_date: string;           // Latest date
  distribution?: { period: string; count: number }[]; // Optional: by month/year
}

interface BooleanFilterAggregation {
  type: 'boolean';
  true_count: number;
  false_count: number;
  null_count: number;
}

interface RelationFilterAggregation {
  type: 'relation';
  values: { id: string; display: string; count: number }[];
}
```

## Implementation Examples

### 1. Simple Column Selection with Dot Notation
```json
{
  "columns": [
    "id",
    "name", 
    "price",
    "user_id.name",                    // Auto-resolve from schema relation_setting
    "preferences.colormode.default",   // JSON path
    "preferences.notifications.email"  // JSON path
  ]
}
```

### 2. Complete Query with All Features
```json
{
  "columns": [
    "id",
    "name", 
    "email",
    "user_id.name",                    
    "preferences.colormode.default",   
    "preferences.notifications.email"  
  ],
  
  "filters": {
    "status": "active",
    "preferences.colormode.default": "dark"
  },
  
  "sort": [
    { "field": "name", "direction": "ASC" },
    { "field": "created_at", "direction": "DESC" }
  ],
  
  "search": "john",
  
  "relationColumns": [
    {
      "label": "profile",
      "local_key": "id",
      "foreign_table": "user_profile", 
      "foreign_key": "user_id",
      "display_columns": ["name", "phone", "city", "avatar"],
      "filters": { "active": true }
    },
    {
      "label": "current_role",
      "local_key": "role_id",
      "foreign_table": "roles",
      "foreign_key": "id", 
      "display_columns": ["name", "slug", "permissions"]
    }
  ],
  
  "aggColumns": [
    {
      "label": "total_orders",
      "local_key": "id",
      "foreign_table": "orders",
      "foreign_key": "user_id",
      "function": "count",
      "filters": { "status": "completed" }
    },
    {
      "label": "total_spent", 
      "local_key": "id",
      "foreign_table": "orders",
      "foreign_key": "user_id",
      "function": "sum",
      "function_field": "total_amount",
      "filters": { "status": "completed" }
    }
  ],
  
  "aggregation_filter": [
    "status", 
    "priority", 
    "created_at", 
    "price", 
    "is_featured",
    "category_id"
  ],
  
  "limit": 50,
  "offset": 0
}
```

### 3. Response Example
```json
{
  "records": [
    {
      "id": "123",
      "name": "John Doe",
      "email": "john@example.com", 
      "user_id.name": "John Doe",                    
      "preferences.colormode.default": "dark",       
      "preferences.notifications.email": true,       
      
      // Relation data
      "profile": {
        "name": "John Doe",
        "phone": "+1234567890", 
        "city": "New York",
        "avatar": "avatar.jpg"
      },
      "current_role": {
        "name": "Admin",
        "slug": "admin",
        "permissions": ["read", "write", "delete"]
      },
      
      // Aggregated data
      "total_orders": 15,
      "total_spent": 2499.99
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0,
  
  "aggregation": {
    "status": {
      "type": "text",
      "values": ["active", "inactive", "pending", "archived"],
      "count": {
        "active": 89,
        "inactive": 34,
        "pending": 15,
        "archived": 12
      }
    },
    
    "priority": {
      "type": "number", 
      "min": 1,
      "max": 10,
      "avg": 5.7,
      "count": 150,
      "distribution": [
        { "range": "1-3", "count": 45 },
        { "range": "4-6", "count": 67 },
        { "range": "7-10", "count": 38 }
      ]
    },
    
    "created_at": {
      "type": "date",
      "min_date": "2023-01-15T00:00:00Z",
      "max_date": "2024-01-15T23:59:59Z", 
      "distribution": [
        { "period": "2023-01", "count": 12 },
        { "period": "2023-02", "count": 18 },
        { "period": "2024-01", "count": 25 }
      ]
    },
    
    "is_featured": {
      "type": "boolean",
      "true_count": 23,
      "false_count": 127,
      "null_count": 0
    },
    
    "category_id": {
      "type": "relation",
      "values": [
        { "id": "cat1", "display": "Electronics", "count": 45 },
        { "id": "cat2", "display": "Books", "count": 32 },
        { "id": "cat3", "display": "Clothing", "count": 28 }
      ]
    }
  }
}
```

## Key Features

### 1. Dot Notation Support
- **Relations**: `user_id.name` - Auto-resolves using schema `relation_setting`
- **JSON Paths**: `preferences.colormode.default` - Extracts nested JSON values
- **Backward Compatible**: Simple column names still work as before

### 2. Explicit Relationship Queries
- **Multiple Fields**: Get several fields from related tables
- **Filtered Relations**: Apply filters to related data
- **Performance Optimized**: Uses efficient JOIN or subquery strategies

### 3. Aggregation Operations
- **Standard Functions**: count, sum, avg, min, max
- **Array Aggregation**: Collect related values into arrays
- **Filtered Aggregations**: Apply conditions to aggregated data

### 4. Dynamic Filter Aggregation
- **Type-Aware**: Different aggregation strategies per data type
- **UI-Ready**: Perfect for building dynamic filter interfaces
- **Performance Optimized**: Can use sampling for large datasets

## SQL Generation Strategy

### 1. Query Analysis Phase
```typescript
interface QueryPlan {
  baseTable: string;
  joins: JoinConfig[];
  selects: SelectConfig[];
  subqueries: SubqueryConfig[];
}

interface JoinConfig {
  type: 'LEFT JOIN' | 'INNER JOIN';
  table: string;
  alias: string;
  condition: string;
}

interface SelectConfig {
  expression: string;
  alias: string;
  type: 'direct' | 'subquery' | 'computed';
}
```

### 2. Implementation Approach

#### Option A: Multiple Queries (Simpler, Less Efficient)
```sql
-- Main query
SELECT id, name, price FROM products WHERE ...

-- Relation queries (executed separately)
SELECT product_id, name, email FROM user_profile WHERE user_id IN (...)
SELECT product_id, COUNT(*) as review_count FROM reviews WHERE product_id IN (...) GROUP BY product_id
```

#### Option B: Complex JOIN Query (More Efficient)
```sql
SELECT 
  p.id,
  p.name,
  p.price,
  c.name as category_name,
  c.slug as category_slug,
  AVG(r.rating) as avg_rating,
  COUNT(r.id) as review_count
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN reviews r ON p.id = r.product_id
WHERE p.active = true
GROUP BY p.id, p.name, p.price, c.name, c.slug
```

#### Option C: Hybrid Approach (Recommended)
- Use JOINs for simple 1:1 relations
- Use subqueries for aggregations
- Use separate queries for complex relations

```sql
SELECT 
  p.id,
  p.name,
  p.price,
  c.name as category_name,
  c.slug as category_slug,
  (SELECT AVG(rating) FROM reviews WHERE product_id = p.id) as avg_rating,
  (SELECT COUNT(*) FROM reviews WHERE product_id = p.id) as review_count
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.active = true
```

## Updated API Endpoints

### All Query Endpoints Support Enhanced Columns

```typescript
// Table Query
POST /api/records/:table_slug/query/table
{
  "columns": [ColumnConfig],
  "filters": {...},
  "search": "...",
  "orderBy": "...",
  "orderDirection": "ASC|DESC",
  "limit": 100,
  "offset": 0
}

// Kanban Query
POST /api/records/:table_slug/query/kanban
{
  "statusColumn": "status",
  "columns": [ColumnConfig], // NEW: Control what data is included
  "groupByColumn": "...",
  "filters": {...},
  "search": "...",
  "limit": 1000
}

// Tree Query
POST /api/records/:table_slug/query/tree
{
  "parentColumn": "parent_id",
  "labelColumn": "name",
  "columns": [ColumnConfig], // NEW: Include related data in tree nodes
  "rootValue": null,
  "maxDepth": 10,
  "filters": {...}
}
```

## Implementation Plan

### Phase 1: Core Infrastructure
1. **Column Parser**: Parse and validate column configurations
2. **Query Builder**: Generate SQL based on column configs
3. **Result Processor**: Transform query results into expected format

### Phase 2: Relation Support
1. **Relation Resolver**: Handle table relationships
2. **JOIN Generator**: Create efficient JOIN queries
3. **Subquery Generator**: Handle aggregations

### Phase 3: Advanced Features
1. **Transform Engine**: Data transformation functions
2. **Computed Fields**: Dynamic field calculations
3. **Performance Optimization**: Query caching and optimization

## Code Structure

```typescript
// Enhanced Query Service
interface EnhancedQueryService {
  parseColumns(columns: ColumnConfig[]): ParsedColumn[];
  buildQuery(table: string, parsedColumns: ParsedColumn[], filters: any): QueryPlan;
  executeQuery(queryPlan: QueryPlan): Promise<any[]>;
  processResults(results: any[], parsedColumns: ParsedColumn[]): any[];
}

// Column Parser
interface ColumnParser {
  parseColumn(config: ColumnConfig): ParsedColumn;
  validateRelation(relation: RelationConfig): boolean;
  validateTransform(transform: TransformConfig): boolean;
}

// Query Builder
interface QueryBuilder {
  buildBaseQuery(table: string, columns: ParsedColumn[]): string;
  buildJoins(relations: RelationConfig[]): JoinConfig[];
  buildSubqueries(aggregations: AggregationConfig[]): SubqueryConfig[];
}
```

## Benefits

### 1. **Unified API**: All query types support the same column configuration
### 2. **Powerful Relations**: Fetch related data without multiple API calls
### 3. **Performance**: Optimized queries reduce network overhead
### 4. **Flexibility**: Support for transformations and computed fields
### 5. **Consistency**: Same column system across all endpoints

## Backward Compatibility

- Simple string columns still work: `["id", "name", "price"]`
- Existing queries continue to function
- New features are opt-in through enhanced column configs

## Security Considerations

1. **Relation Validation**: Ensure users can only access tables they have permissions for
2. **Column Access Control**: Respect field-level permissions
3. **Query Complexity Limits**: Prevent overly complex queries that could impact performance
4. **SQL Injection Prevention**: All dynamic SQL must be parameterized

This enhanced column system would make the Record API extremely powerful while maintaining simplicity for basic use cases.
