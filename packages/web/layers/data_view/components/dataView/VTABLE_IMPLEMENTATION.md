# VTable Implementation for Data View

## Overview

The data view table component has been migrated from VxeTable to `@visactor/vue-vtable` (VTable) for better performance and modern table features.

## Features Implemented

### ✅ Basic Table Functionality
- **Data Display**: Shows dynamic table data with proper column formatting
- **Column Management**: Supports dynamic columns with different data types
- **Sorting**: Column sorting with remote data loading
- **Pagination**: Built-in pagination with configurable page sizes
- **Column Resizing**: Users can resize columns and preferences are saved
- **Column Reordering**: Drag and drop column reordering with preference saving

### ✅ Data Type Support
- **Text**: Standard text display
- **Number/Integer**: Right-aligned with proper formatting
- **Boolean**: Checkbox display (read-only)
- **Date/DateTime**: Formatted date display
- **Relations**: Custom display templates for related data

### ✅ User Experience Features
- **Loading States**: Skeleton loading while data loads
- **Empty States**: Helpful messages when no data is available
- **Permission-based UI**: Add Column button only shows for users with `can_manage` permission
- **Responsive Design**: Table adapts to container size
- **Theme**: Modern Arco design theme with alternating row colors

### ✅ Data Management
- **Remote Data Loading**: Fetches data from API with proper pagination
- **Filter Support**: Framework for filtering (to be implemented)
- **Sort Support**: Single and multiple column sorting
- **Relation Handling**: Embedded relation data display

## Configuration

### Table Configuration
```typescript
const tableConfig = computed(() => ({
  columns: vtableColumns.value,
  data: tableData.value,
  widthMode: 'standard',
  heightMode: 'standard',
  defaultRowHeight: 40,
  defaultHeaderRowHeight: 40,
  defaultColumnWidth: 150,
  enableColumnResize: true,
  enableColumnDrag: true,
  enableSort: true,
  enableFilter: true,
  enablePagination: true,
  pagination: {
    current: currentPage.value,
    pageSize: pageSize.value,
    total: totalSize.value,
    pageSizeOptions: [10, 20, 50, 100],
    showSizeChanger: true,
    showQuickJumper: true,
  },
  sort: {
    field: sorts.value[0]?.column || '',
    order: sorts.value[0]?.direction || 'asc'
  },
  theme: {
    name: 'arco',
    // ... theme configuration
  }
}));
```

### Column Configuration
```typescript
const vtableColumn: any = {
  field: col.column_name,
  title: col.display_name || col.column_name,
  width: 150,
  minWidth: 150,
  maxWidth: 400,
  sortable: col.can_sort,
  cellType: 'text', // or 'checkbox' for boolean
  align: 'right', // for numbers
  formatter: (value: any) => { /* custom formatting */ }
};
```

## Event Handling

### Table Events
```typescript
const handleTableEvents = {
  sort: handleSort,
  filter: handleFilter,
  pageChange: handlePageChange,
  pageSizeChange: handlePageSizeChange,
  columnResize: ({ column, width }: any) => {
    tablePreferences.updateColumnWidth(column.field, width);
  },
  columnDrag: () => {
    // Update column order after drag
    const currentColumns = tableRef.value?.getColumns() || [];
    const newOrder = currentColumns.map((col: any) => col.field).filter(Boolean);
    tablePreferences.updateColumnOrder(newOrder);
  }
};
```

## Preferences System

The table uses a preferences system that saves user customizations to localStorage:

- **Column Widths**: Resized column widths are saved
- **Column Order**: Drag-and-drop column reordering is saved
- **Column Visibility**: Column show/hide preferences (framework ready)
- **Pagination**: Page size preferences (framework ready)

## API Integration

### Data Loading
```typescript
const loadTableData = async () => {
  const queryParams = {
    select: props.columns.filter(col => !col.is_relation).map(col => col.column_name),
    includeRelations: props.columns
      .filter(col => col.is_relation)
      .map(col => ({ name: col.relation_config.relation_name })),
    relationMode: "embedded" as const,
    filters: filters.value,
    sorts: sorts.value,
    page: currentPage.value,
    includeVirtualColumns: true,
    pageSize: pageSize.value,
  };

  const data = await apiClient.companies.postDataRecordsTablenameQuerytable(
    props.tableName,
    queryParams
  );
  
  tableData.value = data.data || [];
  totalSize.value = data.pagination?.total || 0;
};
```

## Future Enhancements

### 🚧 Planned Features
- **Inline Editing**: Cell editing capabilities
- **Advanced Filtering**: Multi-column filters with different filter types
- **Export Functionality**: CSV/Excel export
- **Bulk Operations**: Select multiple rows for batch operations
- **Keyboard Navigation**: Arrow key navigation between cells
- **Search**: Global search across all columns

### 🔧 Technical Improvements
- **Virtual Scrolling**: For large datasets
- **Column Grouping**: Group related columns
- **Custom Cell Renderers**: More sophisticated cell content
- **Row Selection**: Checkbox selection with bulk actions
- **Context Menus**: Right-click context menus for rows/cells

## Migration Notes

### From VxeTable
- ✅ Replaced `VxeGrid` with `VTable`
- ✅ Updated column configuration format
- ✅ Simplified event handling
- ✅ Maintained preferences system compatibility
- ✅ Kept same API integration pattern

### Benefits of VTable
- **Better Performance**: More efficient rendering for large datasets
- **Modern Architecture**: Built with modern web standards
- **Extensibility**: Easier to customize and extend
- **TypeScript Support**: Better type safety
- **Active Development**: Regular updates and improvements

## Usage Example

```vue
<template>
  <DataViewTable
    :columns="columns"
    :permission="permission"
    :loading="loading"
    :table-name="tableName"
    @column-created="handleColumnCreated"
  />
</template>

<script setup>
import DataViewTable from './dataView/table.vue';

// Your component logic here
</script>
```

## Troubleshooting

### Common Issues
1. **Table not rendering**: Check if columns array is populated
2. **Data not loading**: Verify API endpoint and permissions
3. **Column preferences not saving**: Check localStorage permissions
4. **Sorting not working**: Ensure `can_sort` is true for columns

### Debug Tips
- Check browser console for errors
- Verify column configuration format
- Test API endpoints independently
- Check user permissions for the table
