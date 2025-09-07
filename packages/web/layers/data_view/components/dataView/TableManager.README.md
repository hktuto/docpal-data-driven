# TableManager Component

A comprehensive tabbed interface for managing all aspects of dynamic tables, including data, forms, permissions, and actions.

## Overview

The `TableManager` component provides a unified interface for table management with the following tabs:

- **📊 Data**: View and manage table data with the dynamic table component
- **📝 Forms**: Create and manage forms for data entry and editing
- **🔐 Permissions**: Configure table-level permissions (requires `can_manage` permission)
- **⚙️ Actions**: Automated actions and workflows (coming soon)

## Usage

### Basic Usage

```vue
<template>
  <TableManager 
    table-name="users" 
    @tab-change="handleTabChange"
  />
</template>

<script setup>
import TableManager from '@/layers/data_view/components/dataView/TableManager.vue';

const handleTabChange = (tabName) => {
  console.log('Active tab:', tabName);
};
</script>
```

### With Default Tab

```vue
<template>
  <TableManager 
    table-name="products" 
    default-tab="forms"
  />
</template>
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `tableName` | `string` | Yes | - | Name of the table to manage |
| `defaultTab` | `'data' \| 'forms' \| 'permissions' \| 'actions'` | No | `'data'` | Initial active tab |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `tabChange` | `string` | Emitted when the active tab changes |

## Tab Details

### 📊 Data Tab

- **Component**: Uses the existing `DynamicTable` component
- **Features**:
  - Dynamic column configuration
  - Multiple sorting support
  - Column management (show/hide, reorder, resize)
  - Permission-based "Add Column" functionality
  - Real-time data loading with pagination

### 📝 Forms Tab

- **Component**: `TableFormsManager`
- **Features**:
  - List all forms for the table
  - Create new forms (with `can_manage` permission)
  - Edit existing forms
  - Preview forms
  - Set default forms
  - Activate/deactivate forms
  - Delete forms (non-default only)

**Form Management Actions**:
- ✏️ Edit Form
- 👁️ Preview Form  
- ⭐ Set as Default
- 🔄 Activate/Deactivate
- 🗑️ Delete (if not default)

### 🔐 Permissions Tab

- **Component**: `TablePermissionsManager`
- **Visibility**: Only shown if user has `can_manage` permission
- **Sub-tabs**:
  - **Users**: User-level permissions
  - **Roles**: Role-level permissions  
  - **Groups**: Group-level permissions
  - **Overview**: Visual permission summary

**Permission Management**:
- Add new permissions
- Edit existing permissions
- Delete permissions
- Permission overview with statistics

### ⚙️ Actions Tab

- **Component**: `TableActionsManager`
- **Status**: Coming soon (placeholder implementation)
- **Planned Features**:
  - ⚡ Automated triggers on data changes
  - 🔔 Email and notification workflows
  - 🔗 Third-party integrations
  - 📄 Document generation and templates
  - ⏰ Scheduled tasks and reports
  - 📤 Data export and sync actions

## Permission System

The component integrates with your existing permission system:

- **Data Tab**: Always visible (requires basic table access)
- **Forms Tab**: Always visible, but creation requires `can_manage`
- **Permissions Tab**: Only visible with `can_manage` permission
- **Actions Tab**: Always visible (placeholder)

## API Integration

The component expects these API endpoints:

### Table Metadata
- `GET /companies/data/schema/{table_name}` - Table schema
- `GET /companies/data/records/{table_name}/permissions` - User permissions

### Forms Management
- `GET /companies/data/schema/{table_name}/forms` - List forms
- `POST /companies/data/schema/{table_name}/forms` - Create form
- `PUT /companies/data/schema/{table_name}/forms/{form_id}` - Update form
- `DELETE /companies/data/schema/{table_name}/forms/{form_id}` - Delete form
- `PUT /companies/data/schema/{table_name}/forms/{form_id}/default` - Set default
- `PUT /companies/data/schema/{table_name}/forms/{form_id}/toggle` - Toggle active

### Permissions Management
- `GET /companies/data/records/{table_name}/permissions` - List permissions
- `POST /companies/data/records/{table_name}/permissions` - Add permission
- `PUT /companies/data/records/{table_name}/permissions/{permission_id}` - Update permission
- `DELETE /companies/data/records/{table_name}/permissions/{permission_id}` - Delete permission

## Component Structure

```
TableManager.vue
├── Data Tab
│   └── DynamicTable.vue (existing component)
├── Forms Tab
│   ├── TableFormsManager.vue
│   ├── FormBuilderDialog.vue
│   └── FormPreviewDialog.vue
├── Permissions Tab
│   ├── TablePermissionsManager.vue
│   └── permissions/
│       ├── UserPermissionsTable.vue
│       ├── RolePermissionsTable.vue
│       ├── GroupPermissionsTable.vue
│       ├── PermissionOverview.vue
│       ├── AddPermissionDialog.vue
│       └── EditPermissionDialog.vue
└── Actions Tab
    └── TableActionsManager.vue
```

## Styling

The component uses Element Plus's tab component with custom styling:

- **Card-style tabs** for clear separation
- **Responsive design** with mobile-friendly layouts
- **Icon + text labels** (icons only on mobile)
- **Consistent spacing** and typography

## Development Status

| Tab | Status | Implementation |
|-----|--------|----------------|
| Data | ✅ Complete | Fully functional with existing table component |
| Forms | 🚧 Partial | UI complete, form builder coming soon |
| Permissions | 🚧 Partial | UI structure complete, detailed implementation needed |
| Actions | 📋 Planned | Placeholder with planned features |

## Future Enhancements

### Forms Tab
- [ ] Visual form builder with drag-and-drop
- [ ] Form validation rules configuration
- [ ] Conditional field logic
- [ ] Form templates and presets
- [ ] Form analytics and usage statistics

### Permissions Tab
- [ ] Visual permission matrix
- [ ] Bulk permission operations
- [ ] Permission templates
- [ ] Audit log for permission changes
- [ ] Advanced permission conditions

### Actions Tab
- [ ] Workflow builder interface
- [ ] Trigger configuration
- [ ] Action templates
- [ ] Integration marketplace
- [ ] Action monitoring and logs

## Example Implementation

```vue
<template>
  <div class="table-management-page">
    <!-- Page header -->
    <div class="page-header">
      <el-breadcrumb>
        <el-breadcrumb-item to="/tables">Tables</el-breadcrumb-item>
        <el-breadcrumb-item>{{ tableName }}</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <!-- Table manager -->
    <TableManager 
      :table-name="tableName"
      :default-tab="defaultTab"
      @tab-change="handleTabChange"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import TableManager from '@/layers/data_view/components/dataView/TableManager.vue';

const props = defineProps<{
  tableName: string;
}>();

const defaultTab = ref('data');

const handleTabChange = (tabName) => {
  // Update URL or perform other actions
  console.log('Switched to tab:', tabName);
};
</script>
```

This component provides a complete table management solution that can grow with your application's needs while maintaining a clean, intuitive interface.
