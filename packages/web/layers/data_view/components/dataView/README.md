# Dynamic Data View Table Component

A dynamic table component built with vxeGrid that automatically configures columns based on your backend table schema and handles permissions.

## Features

✅ **Dynamic Column Configuration**: Automatically maps backend column definitions to vxeGrid columns
✅ **Multiple Sorting**: Supports multiple column sorting with server-side processing
✅ **Smart Sorting**: Enables sorting only for columns that have `can_sort: true`
✅ **Intelligent Filtering**: Configures filters based on column data types and `can_filter` property
✅ **Column Management**: Built-in VxeGrid column show/hide and reordering
✅ **Column Resizing**: Resizable columns with width persistence
✅ **Permission-Based Actions**: Shows "Add Column" button only for users with `can_manage` permission
✅ **Data Type Handling**: Properly formats different data types (dates, numbers, booleans, etc.)
✅ **Relation Support**: Handles related data with custom display templates
✅ **Remote Data Loading**: Integrates with your API for server-side pagination, sorting, and filtering
✅ **Loading States**: Shows skeleton loading and empty states
✅ **Responsive Design**: Works on different screen sizes
✅ **Persistent Preferences**: Column visibility, order, and width saved in localStorage

## Usage

```vue
<template>
  <DynamicTable :setting="{ table_name: 'users' }" />
</template>

<script setup>
import DynamicTable from '@/layers/data_view/components/dataView/table.vue';
</script>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `setting` | `tableSetting` | Yes | Configuration object containing the table name |

### tableSetting Type

```typescript
type tableSetting = {
  table_name: string;
}
```

## Column Configuration

The component automatically reads column configuration from your backend via the `useDataView` composable. Each column should have the following structure:

```typescript
type Column = {
  column_name: string;        // Database column name
  display_name: string;       // Human-readable name
  data_type: string;          // 'text', 'number', 'date', 'boolean', etc.
  column_type: string;        // 'standard', 'relation', 'computed'
  can_sort: boolean;          // Enable/disable sorting
  can_filter: boolean;        // Enable/disable filtering
  filter_type: string;        // 'text', 'number', 'date', 'select'
  is_system: boolean;         // System column flag
  is_relation: boolean;       // Relation column flag
  relation_config: {          // Relation configuration (if applicable)
    relation_name: string;
    relation_type: string;
    target_table: string;
    target_column: string;
    display_columns: string[];
    display_template: string;  // e.g., "{name} ({email})"
  }
}
```

## Permission System

The component integrates with your permission system:

- **`can_read`**: Required to view the table (handled by `useDataView`)
- **`can_manage`**: Shows "Add Column" button and allows column creation

## API Integration

The component expects these API endpoints:

1. **Get Table Schema**: `GET /companies/data/schema/{table_name}`
2. **Get Table Permissions**: `GET /companies/data/records/{table_name}/permissions`
3. **Query Table Data**: `POST /companies/data/records/{table_name}/query`
4. **Create Column**: `POST /companies/data/schema/{table_name}/columns` (for column creation)

## Data Loading

The component automatically handles:
- Server-side pagination (20 items per page by default)
- **Multiple column sorting** (when `can_sort: true`)
- Remote filtering (when `can_filter: true`)
- Relation data loading with embedded mode

### Multiple Sorting

The component now supports multiple column sorting:
- Hold `Ctrl/Cmd` while clicking column headers to add additional sort criteria
- Sort indicators show the order of sorting (1, 2, 3, etc.)
- All sorts are sent to the server in the correct format:

```typescript
// Example sorts sent to API
sorts: [
  { column: 'name', direction: 'asc' },
  { column: 'created_at', direction: 'desc' },
  { column: 'priority', direction: 'asc' }
]
```

## Column Types Support

### Standard Columns
- **Text**: Basic text display
- **Number/Integer**: Right-aligned with number formatting
- **Boolean**: Displays as disabled switch
- **Date/DateTime**: Formatted date display

### Relation Columns
- Supports custom display templates
- Automatically loads related data
- Configurable display columns

### System Columns
- Marked with `is_system: true`
- May have special handling or restrictions

## Customization

### Styling
The component uses scoped CSS and can be customized:

```css
.dynamic-table-container {
  /* Your custom styles */
}
```

### VxeGrid Configuration
The component uses sensible defaults but you can extend the configuration by modifying the `useVxeTable` parameters in the component.

## Error Handling

The component includes comprehensive error handling:
- API errors are logged and show empty state
- Permission errors show appropriate messages
- Loading states prevent user confusion

## Column Management

### Built-in VxeGrid Features
- **Show/Hide Columns**: Use VxeGrid's built-in column customization toolbar button
- **Column Ordering**: Drag and drop column headers to reorder
- **Column Resizing**: Resize columns by dragging column borders
- **Zoom & Refresh**: Built-in toolbar controls for table management

### Persistent Preferences
Column width preferences are stored in localStorage with the key pattern:
```
table_preferences_dynamic_table_{table_name}
```

**Note**: Column visibility and ordering use VxeGrid's native persistence system, while custom width changes are saved via our `useTablePreferences` composable.

## Performance

- Uses vxeGrid's virtual scrolling for large datasets
- Remote data loading reduces initial load time
- Column configuration is cached and reactive
- Preferences are stored locally for instant loading

## Example with Custom Table

```vue
<template>
  <div class="my-data-view">
    <h2>{{ tableTitle }}</h2>
    <DynamicTable :setting="{ table_name: tableName }" />
  </div>
</template>

<script setup>
import DynamicTable from '@/layers/data_view/components/dataView/table.vue';

const props = defineProps<{
  tableName: string;
  tableTitle: string;
}>();
</script>
```

## Development Notes

- The component is fully reactive to column changes
- Permission checks are performed in real-time
- Table data reloads automatically when columns are modified
- Uses TypeScript for full type safety

## Advanced Features

### useTablePreferences Composable

The component uses a dedicated composable for managing table preferences:

```typescript
const tablePreferences = useTablePreferences('my_table_id');

// Available methods:
tablePreferences.toggleColumnVisibility('column_name', true);
tablePreferences.updateColumnOrder(['col1', 'col2', 'col3']);
tablePreferences.updateColumnWidth('column_name', 200);
tablePreferences.resetPreferences();

// Reactive properties:
tablePreferences.visibleColumns.value // Array of visible column names
tablePreferences.hiddenColumns.value  // Array of hidden column names
tablePreferences.preferences.value    // Full preferences object
```

### Multiple Sort Implementation

The component converts vxeGrid's sort format to your API's expected format:

```typescript
// vxeGrid provides:
[
  { property: 'name', order: 'asc' },
  { property: 'date', order: 'desc' }
]

// Converted to:
[
  { column: 'name', direction: 'asc' },
  { column: 'date', direction: 'desc' }
]
```

## Future Enhancements

- [ ] Inline editing support
- [ ] Bulk operations
- [ ] Export functionality
- [ ] Advanced filtering UI
- [ ] Custom cell renderers
- [ ] Column grouping
- [ ] Saved table views/presets
