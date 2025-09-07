# Column Management Features

This document describes the new column management features added to the dynamic table component.

## Features Added

### 1. Show/Hide Columns
- **Button**: "Columns" button in the table toolbar
- **Functionality**: Opens a dialog to manage column visibility
- **Persistence**: Column visibility preferences are saved to localStorage
- **Features**:
  - Toggle individual column visibility
  - Search columns by name or display name
  - Show all / Hide all buttons (with protection to keep at least one column visible)
  - Reset to defaults option
  - Real-time visibility count display

### 2. Edit Column Settings
- **Access**: Through the "Edit" button in the Column Management dialog
- **Functionality**: Edit column properties like display name, sorting, filtering
- **Limitations**: 
  - Column name, data type, and column type cannot be changed after creation
  - System columns cannot be edited
- **Features**:
  - Update display name
  - Toggle sorting and filtering capabilities
  - Modify filter type
  - Edit relation configuration for relation columns
  - Delete column functionality (UI ready, API endpoint pending)

### 3. Column Preferences Persistence
- **Storage**: localStorage using table-specific keys
- **Preferences Saved**:
  - Column visibility (show/hide)
  - Column order (future enhancement)
  - Column width (future enhancement)
- **Key Format**: `table_preferences_dynamic_table_{tableName}`

## Components Created

### 1. `EditColumnDialog.vue`
- Modal dialog for editing column settings
- Form validation for required fields
- API integration for updating columns
- Delete functionality (placeholder for future API endpoint)

### 2. `ColumnManagementDialog.vue`
- Modal dialog for managing column visibility
- Search functionality
- Bulk actions (show all, hide all, reset)
- Integration with table preferences
- Column information display with tags

### 3. Updated `table.vue`
- Added new toolbar layout with left/right sections
- Integrated column management button
- Connected to table preferences for column visibility
- Added event handlers for column management operations

## API Integration

### Existing Endpoints Used
- `POST /companies/data/schema/{table_name}/columns` - Create new column
- `PUT /companies/data/schema/{table_name}/columns/{column_name}` - Update column

### Missing Endpoints
- `DELETE /companies/data/schema/{table_name}/columns/{column_name}` - Delete column (TODO)

## Usage

### For Users
1. **Show/Hide Columns**: Click the "Columns" button in the table toolbar
2. **Edit Column**: In the Column Management dialog, click "Edit" next to any non-system column
3. **Search Columns**: Use the search box in the Column Management dialog
4. **Bulk Actions**: Use "Show All", "Hide All", or "Reset" buttons

### For Developers
```vue
<!-- The table component automatically includes all new features -->
<table
  :columns="columns"
  :permission="permission"
  :loading="loading"
  :table-name="tableName"
  @column-created="handleColumnCreated"
  @create-entry="handleCreateEntry"
/>
```

## Technical Details

### Table Preferences Integration
The component uses the `useTablePreferences` composable to:
- Load saved column preferences on mount
- Apply visibility settings to VTable columns
- Save changes automatically when preferences are modified

### VTable Integration
- Column visibility is applied through the `applyPreferencesToColumns` method
- Table re-renders when column visibility changes
- Maintains VTable's native column features (sorting, filtering, resizing)

### Error Handling
- Form validation for column editing
- API error handling with user-friendly messages
- Graceful degradation when API endpoints are not available

## Future Enhancements

1. **Column Reordering**: Drag-and-drop column reordering in the management dialog
2. **Column Width Persistence**: Save and restore column widths
3. **Column Grouping**: Group related columns together
4. **Export Column Settings**: Export/import column configurations
5. **Delete Column API**: Implement the missing delete endpoint
6. **Column Templates**: Predefined column configurations for common use cases

## Accessibility

- All dialogs are keyboard navigable
- Proper ARIA labels and roles
- Screen reader friendly
- Focus management in modal dialogs
- High contrast support through Element Plus theming

