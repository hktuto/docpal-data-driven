# Record API Guide

This document explains how to use the DocPal Record Management API, including all endpoints, required fields, and examples.

## Prerequisites

Before using the Record API, you need:
1. **Authentication**: Valid session (login required)
2. **Company Context**: Selected company via `/api/companies/:companyId/select`
3. **Schema**: A table schema must exist (created via Schema API)

## Base URL Structure

All record endpoints follow this pattern:
```
/api/records/:table_slug
```

Where `table_slug` is the slug of the table schema you want to work with.

---

## 1. Basic CRUD Operations

### 1.1 Create Record

**Endpoint:** `POST /api/records/:table_slug`

**Description:** Creates a new record in the specified table.

**Required Fields:**
- All non-nullable fields defined in the table schema
- Field names and types must match the schema definition

**Request Body:** Dynamic based on schema
```json
{
  "field_name": "value",
  "another_field": "another_value"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "field_name": "value",
  "another_field": "another_value",
  "created_at": "2024-01-XX...",
  "updated_at": "2024-01-XX...",
  "created_by": "user_uuid"
}
```

**Example:**
```bash
# For a products table with schema: name (required), price (required), description (optional)
POST /api/records/products
{
  "name": "iPhone 15",
  "price": 999.99,
  "description": "Latest iPhone model"
}
```

---

### 1.2 Get Records (List with Filtering)

**Endpoint:** `GET /api/records/:table_slug`

**Description:** Retrieves records with optional filtering, searching, sorting, and pagination.

**Query Parameters:** (All optional)
- `limit` (integer, 1-1000, default: 50): Number of records to return
- `offset` (integer, default: 0): Number of records to skip
- `orderBy` (string, default: "created_at"): Field to sort by
- `orderDirection` ("ASC" | "DESC", default: "DESC"): Sort direction
- `search` (string): Search term (searches across text fields)
- `{field_name}` (any): Filter by specific field values

**Response:** `200 OK`
```json
{
  "records": [
    {
      "id": "uuid",
      "field_name": "value",
      "created_at": "...",
      "updated_at": "...",
      "created_by": "..."
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

**Examples:**
```bash
# Get all records
GET /api/records/products

# Get with pagination
GET /api/records/products?limit=20&offset=40

# Filter by field
GET /api/records/products?category=electronics&in_stock=true

# Search across text fields
GET /api/records/products?search=iPhone

# Sort by price descending
GET /api/records/products?orderBy=price&orderDirection=DESC
```

---

### 1.3 Get Single Record

**Endpoint:** `GET /api/records/:table_slug/:record_id`

**Description:** Retrieves a specific record by ID.

**Path Parameters:**
- `table_slug` (required): Table identifier
- `record_id` (required): UUID of the record

**Response:** `200 OK` or `404 Not Found`
```json
{
  "id": "uuid",
  "field_name": "value",
  "another_field": "another_value",
  "created_at": "2024-01-XX...",
  "updated_at": "2024-01-XX...",
  "created_by": "user_uuid"
}
```

**Example:**
```bash
GET /api/records/products/123e4567-e89b-12d3-a456-426614174000
```

---

### 1.4 Update Record

**Endpoint:** `PUT /api/records/:table_slug/:record_id`

**Description:** Updates an existing record. Only provided fields will be updated.

**Path Parameters:**
- `table_slug` (required): Table identifier
- `record_id` (required): UUID of the record

**Request Body:** Partial record data
```json
{
  "field_to_update": "new_value",
  "another_field": "updated_value"
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "field_name": "updated_value",
  "another_field": "updated_value",
  "created_at": "2024-01-XX...",
  "updated_at": "2024-01-XX...", // Updated timestamp
  "created_by": "user_uuid"
}
```

**Example:**
```bash
PUT /api/records/products/123e4567-e89b-12d3-a456-426614174000
{
  "price": 899.99,
  "description": "Updated description"
}
```

---

### 1.5 Delete Record

**Endpoint:** `DELETE /api/records/:table_slug/:record_id`

**Description:** Deletes a specific record.

**Path Parameters:**
- `table_slug` (required): Table identifier
- `record_id` (required): UUID of the record

**Response:** `204 No Content`

**Example:**
```bash
DELETE /api/records/products/123e4567-e89b-12d3-a456-426614174000
```

---

## 2. Bulk Operations

### 2.1 Batch Insert Records

**Endpoint:** `POST /api/records/:table_slug/batch`

**Description:** Creates multiple records in a single transaction. Supports up to 1000 records per batch with individual validation and error reporting.

**Required Fields:**
- `records` (array): Array of record objects to create

**Request Body:**
```json
{
  "records": [
    {
      "name": "Product 1",
      "price": 29.99,
      "description": "First product",
      "in_stock": true
    },
    {
      "name": "Product 2", 
      "price": 39.99,
      "description": "Second product",
      "in_stock": false
    },
    {
      "name": "Product 3",
      "price": 49.99,
      "description": "Third product",
      "in_stock": true
    }
  ]
}
```

**Response:** 
- `201 Created`: All records created successfully
- `207 Multi-Status`: Partial success (some records failed)

```json
{
  "records": [
    {
      "id": "uuid-1",
      "name": "Product 1",
      "price": "29.99",
      "description": "First product",
      "in_stock": true,
      "created_at": "2025-01-08T...",
      "updated_at": "2025-01-08T...",
      "created_by": "user-uuid"
    },
    // ... more successfully created records
  ],
  "total": 2,
  "errors": [
    {
      "index": 1,
      "record": {
        "name": "Product 2",
        "price": 39.99,
        // ... original record data
      },
      "error": "Field 'name' is required"
    }
  ],
  "success": false
}
```

**Features:**
- **Transaction Support**: All-or-partial success with rollback protection
- **Individual Validation**: Each record validated against schema
- **Error Reporting**: Detailed error information with record index
- **Performance**: Optimized for bulk operations (up to 1000 records)
- **Batch Limits**: Maximum 1000 records per request

**Example Usage:**
```bash
# Create multiple products at once
POST /api/records/products/batch
{
  "records": [
    {"name": "iPhone 15", "price": 999.99, "category": "electronics"},
    {"name": "MacBook Pro", "price": 1999.99, "category": "electronics"},
    {"name": "AirPods", "price": 199.99, "category": "electronics"}
  ]
}

# Performance test with larger batch
POST /api/records/inventory/batch
{
  "records": [
    // ... up to 1000 records
  ]
}
```

---

## 3. Advanced Query Operations

### 2.1 Table View Query

**Endpoint:** `POST /api/records/:table_slug/query/table`

**Description:** Advanced table query with column selection and complex filtering.

**Request Body:**
```json
{
  "columns": ["name", "price", "category"], // Optional: specific columns to return
  "filters": {
    "category": "electronics",
    "price": 999.99,
    "in_stock": true
  },
  "search": "iPhone", // Optional: search term
  "orderBy": "price", // Optional: sort field
  "orderDirection": "DESC", // Optional: "ASC" | "DESC"
  "limit": 100, // Optional: 1-1000
  "offset": 0 // Optional: pagination offset
}
```

**Response:** `200 OK`
```json
{
  "records": [...],
  "total": 25,
  "columns": ["name", "price", "category"]
}
```

---

### 2.2 Kanban View Query

**Endpoint:** `POST /api/records/:table_slug/query/kanban`

**Description:** Organizes records into columns based on a status field.

**Required Fields:**
- `statusColumn` (string): Field name to group by (e.g., "status", "stage")

**Request Body:**
```json
{
  "statusColumn": "status", // Required: field to group by
  "groupByColumn": "priority", // Optional: secondary grouping
  "filters": {
    "assigned_to": "user_id"
  },
  "search": "urgent", // Optional: search term
  "limit": 1000 // Optional: max records per column
}
```

**Response:** `200 OK`
```json
{
  "columns": [
    {
      "id": "todo",
      "title": "todo",
      "records": [
        {
          "id": "uuid",
          "name": "Task 1",
          "status": "todo",
          "priority": "high"
        }
      ]
    },
    {
      "id": "in_progress",
      "title": "in_progress",
      "records": [...]
    }
  ],
  "records": [...] // All records (for reference)
}
```

---

### 2.3 Tree View Query

**Endpoint:** `POST /api/records/:table_slug/query/tree`

**Description:** Displays hierarchical data with parent-child relationships.

**Required Fields:**
- `parentColumn` (string): Field that references parent record ID
- `labelColumn` (string): Field to use as display label

**Request Body:**
```json
{
  "parentColumn": "parent_id", // Required: parent reference field
  "labelColumn": "name", // Required: display field
  "rootValue": null, // Optional: root parent value (default: null)
  "maxDepth": 5, // Optional: max tree depth (1-20, default: 10)
  "filters": {
    "active": true
  }
}
```

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Root Category",
    "parent_id": null,
    "depth": 0,
    "path": ["uuid"],
    "full_path": "Root Category",
    "child_count": 3,
    "children": []
  }
]
```

---

### 2.4 Dropdown Query

**Endpoint:** `POST /api/records/:table_slug/query/dropdown`

**Description:** Transforms records into dropdown-friendly label/value pairs for UI components. Perfect for select fields, autocomplete, filters, and reference lookups.

**Required Fields:**
- `label` (string): Field to use as display text
- `value` (string): Field to use as option value

**Optional Fields:**
- `search` (string): Filter options by search term (searches label field)
- `filters` (object): Additional filtering criteria
- `sort` (array): Custom sorting with field and direction
- `limit` (number): Maximum options to return (1-1000, default: 100)
- `distinct` (boolean): Remove duplicate label/value pairs (default: true)
- `includeEmpty` (boolean): Include null/empty values (default: false)
- `groupBy` (string): Group options by field value

**Request Body:**
```json
{
  "label": "name",
  "value": "id",
  "search": "iPhone",
  "filters": {
    "active": true,
    "category": "electronics"
  },
  "sort": [
    { "field": "name", "direction": "ASC" }
  ],
  "limit": 50,
  "distinct": true,
  "includeEmpty": false,
  "groupBy": "category"
}
```

**Response:** `200 OK`
```json
{
  "options": [
    {
      "label": "iPhone 15 Pro",
      "value": "uuid-1",
      "group": "electronics"
    },
    {
      "label": "iPhone 15",
      "value": "uuid-2", 
      "group": "electronics"
    },
    {
      "label": "MacBook Pro",
      "value": "uuid-3",
      "group": "computers"
    }
  ],
  "total": 25,
  "hasMore": false
}
```

**Features:**
- **Label/Value Mapping**: Clean separation of display text and actual values
- **Search Functionality**: Filter options by search term in label field
- **Advanced Filtering**: Apply business logic filters before dropdown generation
- **Custom Sorting**: Control option ordering with multiple sort criteria
- **Deduplication**: Automatically remove duplicate label/value combinations
- **Grouping Support**: Organize options into categories for grouped selects
- **Performance Optimized**: Efficient queries with pagination support
- **Empty Value Handling**: Control inclusion of null/empty values

**Use Cases:**
- **Form Select Fields**: User selection dropdowns with clean label/value pairs
- **Filter Options**: Dynamic filter value lists based on actual data
- **Reference Lookups**: Foreign key selections with readable labels
- **Autocomplete**: Search-as-you-type functionality with filtering
- **Grouped Selects**: Categorized option lists for better UX
- **Data Validation**: Ensure valid options for form validation

**Example Usage:**
```bash
# Basic product dropdown
POST /api/records/products/query/dropdown
{
  "label": "name",
  "value": "id"
}

# Category dropdown with search
POST /api/records/categories/query/dropdown
{
  "label": "name", 
  "value": "id",
  "search": "electronics",
  "sort": [{ "field": "name", "direction": "ASC" }]
}

# User dropdown with filters and grouping
POST /api/records/users/query/dropdown
{
  "label": "full_name",
  "value": "id", 
  "filters": {
    "active": true,
    "department": "engineering"
  },
  "groupBy": "role",
  "limit": 100
}

# Price range dropdown (using price as both label and value)
POST /api/records/products/query/dropdown
{
  "label": "price",
  "value": "price",
  "distinct": true,
  "sort": [{ "field": "price", "direction": "ASC" }]
}

# Status dropdown with custom sorting
POST /api/records/tasks/query/dropdown
{
  "label": "status_display",
  "value": "status_code",
  "groupBy": "priority",
  "sort": [
    { "field": "priority", "direction": "DESC" },
    { "field": "status_display", "direction": "ASC" }
  ]
}
```

---

### 2.5 Gantt Chart Query

**Endpoint:** `POST /api/records/:table_slug/query/gantt`

**Description:** Transforms records into Gantt chart format for project timeline visualization. Perfect for project management, task scheduling, and timeline tracking.

**Required Fields:**
- `taskNameColumn` (string): Field containing task/item names
- `startDateColumn` (string): Field containing start dates
- `endDateColumn` (string): Field containing end dates

**Optional Fields:**
- `progressColumn` (string): Field containing progress percentage (0-100)
- `assigneeColumn` (string): Field containing assigned person/team
- `categoryColumn` (string): Field for task categorization
- `dependencyColumn` (string): Field containing task dependencies
- `dateRange` (object): Filter tasks by date range
- `columns` (array): Specific columns to include in response
- `filters` (object): Additional filtering criteria

**Request Body:**
```json
{
  "taskNameColumn": "task_name",
  "startDateColumn": "start_date", 
  "endDateColumn": "end_date",
  "progressColumn": "progress",
  "assigneeColumn": "assignee",
  "categoryColumn": "category",
  "dependencyColumn": "dependencies",
  "columns": ["task_name", "start_date", "end_date", "progress", "assignee"],
  "filters": {
    "project_id": "project-uuid",
    "active": true
  },
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-03-31"
  }
}
```

**Response:** `200 OK`
```json
{
  "tasks": [
    {
      "id": "task-uuid-1",
      "name": "Project Planning",
      "start": "2025-01-01",
      "end": "2025-01-07", 
      "duration": 7,
      "progress": 100,
      "assignee": "Project Manager",
      "category": "Planning",
      "dependencies": [],
      // ... additional fields from columns
    },
    {
      "id": "task-uuid-2", 
      "name": "Development Phase 1",
      "start": "2025-01-08",
      "end": "2025-01-21",
      "duration": 14,
      "progress": 60,
      "assignee": "Dev Team",
      "category": "Development",
      "dependencies": ["task-uuid-1"]
    }
  ],
  "timeline": {
    "projectStart": "2025-01-01T00:00:00.000Z",
    "projectEnd": "2025-03-15T00:00:00.000Z", 
    "totalDuration": 74,
    "tasksCount": 15,
    "averageTaskDuration": 8,
    "completedTasks": 5,
    "inProgressTasks": 7,
    "notStartedTasks": 3
  },
  "total": 15
}
```

**Features:**
- **Automatic Duration Calculation**: Days between start and end dates
- **Project Timeline Statistics**: Overall project metrics and progress
- **Progress Tracking**: Task completion percentages
- **Dependency Support**: Task relationship tracking
- **Date Range Filtering**: Focus on specific time periods
- **Category Grouping**: Organize tasks by type/category
- **Assignee Tracking**: Who's responsible for each task

**Use Cases:**
- **Project Management**: Track project phases and milestones
- **Resource Planning**: Visualize team workload and assignments
- **Timeline Analysis**: Identify bottlenecks and dependencies
- **Progress Reporting**: Monitor project completion status
- **Deadline Management**: Track due dates and critical paths

**Example Usage:**
```bash
# Basic project timeline
POST /api/records/project_tasks/query/gantt
{
  "taskNameColumn": "name",
  "startDateColumn": "start_date",
  "endDateColumn": "due_date",
  "progressColumn": "completion_percent"
}

# Filtered by date range and assignee
POST /api/records/project_tasks/query/gantt  
{
  "taskNameColumn": "title",
  "startDateColumn": "planned_start", 
  "endDateColumn": "planned_end",
  "progressColumn": "progress",
  "assigneeColumn": "assigned_to",
  "categoryColumn": "task_type",
  "filters": {
    "project_id": "proj-123",
    "status": "active"
  },
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-06-30"
  }
}
```

---

## 4. Statistics and Analytics

### 4.1 Aggregation Statistics

**Endpoint:** `POST /api/records/:table_slug/stats/agg`

**Description:** Performs aggregation operations (COUNT, SUM, AVG, MIN, MAX) with grouping.

**Required Fields:**
- `aggregations` (array): List of aggregation operations

**Request Body:**
```json
{
  "groupBy": ["category", "brand"], // Optional: fields to group by
  "aggregations": [ // Required: at least one aggregation
    {
      "column": "price", // Required: field to aggregate
      "function": "AVG", // Required: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX"
      "alias": "average_price" // Optional: result field name
    },
    {
      "column": "*",
      "function": "COUNT",
      "alias": "total_products"
    }
  ],
  "filters": {
    "active": true
  },
  "having": { // Optional: filter on aggregated results
    "total_products": 5
  }
}
```

**Response:** `200 OK`
```json
[
  {
    "category": "electronics",
    "brand": "Apple",
    "average_price": 899.99,
    "total_products": 12
  },
  {
    "category": "electronics",
    "brand": "Samsung",
    "average_price": 699.99,
    "total_products": 8
  }
]
```

---

### 4.2 Chart Data

**Endpoint:** `POST /api/records/:table_slug/stats/chart`

**Description:** Generates data formatted for charts (bar, line, pie, scatter).

**Required Fields:**
- `chartType` (string): "bar" | "line" | "pie" | "scatter"
- `xAxis` (string): Field for X-axis
- `yAxis` (string): Field for Y-axis

**Request Body:**
```json
{
  "chartType": "bar", // Required: chart type
  "xAxis": "category", // Required: X-axis field
  "yAxis": "price", // Required: Y-axis field
  "aggregation": "AVG", // Optional: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX"
  "groupBy": "brand", // Optional: series grouping
  "filters": {
    "active": true
  },
  "limit": 100 // Optional: max data points
}
```

**Response:** `200 OK`
```json
{
  "labels": ["electronics", "books", "clothing"],
  "datasets": [
    {
      "label": "Apple",
      "data": [899.99, 0, 0],
      "backgroundColor": "#FF6384",
      "borderColor": "#FF6384"
    },
    {
      "label": "Samsung",
      "data": [699.99, 0, 0],
      "backgroundColor": "#36A2EB",
      "borderColor": "#36A2EB"
    }
  ]
}
```

---

## 5. Data Types and Validation

### Supported Data Types

When creating/updating records, values are validated and converted based on the schema:

| Schema Type | Expected Input | Example |
|-------------|----------------|---------|
| `text`, `varchar`, `string` | String | `"Hello World"` |
| `integer`, `int` | Number or string | `42` or `"42"` |
| `decimal`, `float` | Number or string | `99.99` or `"99.99"` |
| `boolean` | Boolean or truthy value | `true`, `false`, `1`, `0` |
| `date`, `datetime`, `timestamp` | ISO date string | `"2024-01-15T10:30:00Z"` |
| `json`, `jsonb` | Object or JSON string | `{"key": "value"}` |

### Automatic Fields

Every record automatically includes:
- `id` (UUID): Unique identifier
- `created_at` (timestamp): Creation time
- `updated_at` (timestamp): Last modification time
- `created_by` (UUID): ID of user who created the record

---

## 6. Error Responses

### Common HTTP Status Codes

- `200 OK`: Successful GET, PUT operations
- `201 Created`: Successful POST (record created)
- `204 No Content`: Successful DELETE
- `400 Bad Request`: Invalid input, validation errors
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Table or record not found
- `500 Internal Server Error`: Unexpected server error

### Error Response Format

```json
{
  "error": "Descriptive error message"
}
```

### Common Errors

1. **Missing required fields:**
   ```json
   { "error": "Field 'name' is required" }
   ```

2. **Invalid data type:**
   ```json
   { "error": "Invalid integer value for field 'price'" }
   ```

3. **Table not found:**
   ```json
   { "error": "Table not found" }
   ```

4. **Permission denied:**
   ```json
   { "error": "Insufficient permissions" }
   ```

---

## 7. Permission System

### Record-Level Permissions

- **owner**: Full access (read, write, delete)
- **editor**: Read and write access
- **viewer**: Read-only access
- **creator**: Can create new records in the table

### Permission Inheritance

1. Record permissions inherit from schema permissions
2. Record creator automatically becomes the owner
3. Permissions are checked on every operation
4. Users only see records they have access to

---

## 8. Complete Example Workflow

Here's a complete example of working with a "tasks" table:

```bash
# 1. First, ensure you have a schema (via Schema API)
POST /api/schemas
{
  "slug": "tasks",
  "label": "Tasks",
  "description": "Task management table",
  "columns": [
    {
      "name": "title",
      "data_type": "varchar",
      "nullable": false,
      "view_type": "text"
    },
    {
      "name": "status",
      "data_type": "varchar",
      "nullable": false,
      "default": "todo",
      "view_type": "text"
    },
    {
      "name": "priority",
      "data_type": "integer",
      "nullable": true,
      "view_type": "number"
    },
    {
      "name": "due_date",
      "data_type": "date",
      "nullable": true,
      "view_type": "datetime"
    }
  ]
}

# 2. Create a task
POST /api/records/tasks
{
  "title": "Complete API documentation",
  "status": "in_progress",
  "priority": 1,
  "due_date": "2024-01-20"
}

# 3. Get all tasks
GET /api/records/tasks

# 4. Filter tasks by status
GET /api/records/tasks?status=in_progress

# 5. Get kanban view
POST /api/records/tasks/query/kanban
{
  "statusColumn": "status"
}

# 6. Get task statistics
POST /api/records/tasks/stats/agg
{
  "groupBy": ["status"],
  "aggregations": [
    {
      "column": "*",
      "function": "COUNT",
      "alias": "task_count"
    }
  ]
}

# 7. Update a task
PUT /api/records/tasks/{task_id}
{
  "status": "completed"
}

# 8. Delete a task
DELETE /api/records/tasks/{task_id}
```

---

## 9. Navigation & Hierarchical Data

### 9.1 Breadcrumb Trail

**Endpoint:** `POST /api/records/:table_slug/breadcrumb`

**Description:** Generates a breadcrumb trail for hierarchical data structures (parent-child relationships).

**Use Cases:**
- Category navigation (Root → Electronics → Smartphones)
- Organizational hierarchy (Company → Department → Team)
- File system navigation (Folder → Subfolder → File)
- Menu structures

**Required Fields:**
- `record_id`: The starting record ID
- `label_column`: Column name for display text
- `value_column`: Column name for the value (usually 'id')
- `parent_column`: Column name that links to parent record

**Optional Fields:**
- `direction`: `"root_to_current"` (default) or `"current_to_root"`
- `max_depth`: Maximum depth to traverse (default: 50)

**Request Body:**
```json
{
  "record_id": "uuid-of-starting-record",
  "label_column": "name",
  "value_column": "id", 
  "parent_column": "parent_id",
  "direction": "root_to_current",
  "max_depth": 50
}
```

**Response:** `200 OK`
```json
{
  "breadcrumb": [
    {
      "label": "Root Category",
      "value": "root-uuid"
    },
    {
      "label": "Electronics", 
      "value": "electronics-uuid"
    },
    {
      "label": "Smartphones",
      "value": "smartphones-uuid"
    }
  ],
  "depth": 3
}
```

**Example Usage:**
```bash
# Get breadcrumb trail from leaf to root
POST /api/records/categories/breadcrumb
{
  "record_id": "smartphone-category-id",
  "label_column": "name",
  "value_column": "id",
  "parent_column": "parent_id",
  "direction": "root_to_current"
}

# Response shows: Root → Electronics → Smartphones
```

**Features:**
- **Circular Reference Protection**: Prevents infinite loops
- **Flexible Direction**: Root-to-current or current-to-root ordering
- **Depth Limiting**: Configurable maximum traversal depth
- **Column Validation**: Ensures specified columns exist in schema
- **Null Parent Handling**: Properly handles root records (parent_id = null)

---

This completes the Record API documentation. The API is designed to be flexible and work with any table schema while maintaining proper security and validation.
