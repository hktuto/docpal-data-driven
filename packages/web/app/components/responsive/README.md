# Responsive Table System

A comprehensive responsive table solution that automatically switches between VxeGrid (desktop) and card list view (mobile) based on screen size.

## Components

### ResponsiveTable
The main wrapper component that handles the responsive behavior.

**Props:**
- `tableConfig: any` - Configuration object from `useVxeTable` (contains columns, actions, permissions, etc.)
- `tableEvent: any` - Event handlers from `useVxeTable`

**Events:**
- `action-click` - Emitted when an action is clicked in card view
- `card-click` - Emitted when a card is clicked

**Exposed Methods:**
All VxeGrid methods are exposed through the ResponsiveTable ref, plus view control methods:

```typescript
// View control methods
setView(view: 'auto' | 'table' | 'card') - Manually set the view mode
getCurrentView() - Get the current view mode

// Core table methods

```typescript
// Core table methods
reload() - Reload table data
query(params) - Query with parameters

// Data methods
getData() - Get current table data
loadData(data) - Load data into table

// Checkbox methods
getCheckboxRecords() - Get selected checkbox records
clearCheckboxRow() - Clear checkbox selections
setCheckboxRow(row, checked) - Set checkbox state

// Selection methods
clearSelected() - Clear row selections

// Current row methods
setCurrentRow(row) - Set current row

// Scroll methods
scrollTo(options) - Scroll to position
scrollToRow(row) - Scroll to specific row
scrollToColumn(column) - Scroll to specific column

// Sort and filter methods
sort(field, order) - Sort by field
clearSort() - Clear sorting
setFilter(field, values) - Set filter
clearFilter() - Clear filters

// Column methods
showColumn(field) - Show column
hideColumn(field) - Hide column

// Export methods
exportData(options) - Export table data

// Utility methods
updateData() - Update table data
commitProxy(type, params) - Commit proxy operation

// Additional methods
cleanSelectedRows() - Clear all selections
tableRef - Access to original VxeGrid instance
```

### CardListView
Displays table data as cards on mobile devices.

**Features:**
- Expandable details
- Action menus in top-right corner
- Virtual scrolling support
- Customizable layouts
- Element Plus card components

### ResponsiveToggleView
Dropdown component for switching between view modes.

**Features:**
- Dropdown interface with icons
- Three view modes: Auto, Table, Cards
- v-model support for easy integration
- Clean and space-efficient design

### CardTemplateSettings
Dialog component for customizing card appearance and behavior.

**Features:**
- Template selection (Default, Compact, Detailed)
- Primary columns configuration
- Layout style selection
- Custom fields (advanced)

## Advanced Features

### Responsive Behavior
The ResponsiveTable uses **container-based responsive detection** with **manual override capability**:

- **Breakpoint**: 640px (configurable)
- **Auto Mode**: Container width ≥ 640px → VxeGrid table, < 640px → Card list view
- **Manual Override**: Users can manually switch between table and card views
- **Real-time Updates**: Uses ResizeObserver to detect container size changes
- **Multi-tab Friendly**: Works correctly in tabbed applications where window size ≠ container size

**View Toggle Options:**
- **Auto**: Automatically switches based on container size
- **Table**: Forces table view regardless of container size
- **Cards**: Forces card view regardless of container size

**UI Component:**
The view toggle is implemented as a dropdown button in the toolbar area, providing a clean and space-efficient interface.

```vue
<template>
  <!-- The container div will be observed for size changes -->
  <ResponsiveTable
    :table-config="tableConfig"
    :table-event="tableEvent"
    @view-change="handleViewChange"
    ref="responsiveTableRef"
  />
</template>

<script setup>
const responsiveTableRef = ref()

// Handle view changes
function handleViewChange(view) {
  console.log('View changed to:', view)
}

// Programmatically set view
function forceTableView() {
  responsiveTableRef.value?.setView('table')
}

function forceCardView() {
  responsiveTableRef.value?.setView('card')
}
</script>
```

### Independent Data Loading
The CardList component loads its own data using the same API as the table:

- **Same API**: Uses `tableConfig.proxyConfig.ajax.query` with the same parameters as useVxeTable
- **Pagination Support**: Uses Element Plus Pagination component for better UX
- **Page Size Control**: Users can change page size (10, 20, 50, 100)
- **Navigation**: Full pagination with prev/next, page jumping, and total display
- **Error Handling**: Proper error handling and loading states

### Slot Support
The ResponsiveTable supports custom column slots that work on both desktop and mobile:

```vue
<template>
  <ResponsiveTable
    :table-config="tableConfig"
    :table-event="tableEvent"
  >
    <!-- Custom slot for status column -->
    <template #status="{ row }">
      <el-tag 
        :type="row.status === 'active' ? 'success' : 'danger'"
        size="small"
      >
        {{ row.status === 'active' ? 'Active' : 'Inactive' }}
      </el-tag>
    </template>
  </ResponsiveTable>
</template>

<script setup>
const columns = [
  { field: 'name', title: 'Name' },
  { slots: { default: 'status' }, title: 'Status' }, // Define slot column
  { field: 'email', title: 'Email' }
]
</script>
```

### Pagination Support
The system automatically handles pagination based on the table configuration:

- **Virtual Scroll**: Uses `cardTemplateSettings.pageSize` for mobile pagination
- **Traditional Pagination**: Uses `tableConfig.pagerConfig.pageSize` for mobile pagination
- **Load More**: Automatically shows "Load More" button when more data is available

## Usage

### Basic Usage

```vue
<template>
  <ResponsiveTable
    :table-config="tableConfig"
    :table-event="tableEvent"
    @action-click="handleAction"
    @card-click="handleCardClick"
  >
    <template #toolbar_buttons>
      <ResponsiveFilter 
        ref="filterRef" 
        input-key="q" 
        @form-change="handleFilterChange" 
      />
    </template>
  </ResponsiveTable>
</template>

<script setup>
import { useVxeTable } from '../../composables/useVxeTable'

const columns = [
  { field: 'name', title: 'Name' },
  { field: 'email', title: 'Email' },
  { field: 'status', title: 'Status' }
]

const actions = [
  [
    {
      code: 'edit',
      name: 'edit',
      label: 'Edit',
      action: ({ row }) => console.log('Edit:', row)
    }
  ]
]

function permissionMethod({ row, code }) {
  return { visible: true, disabled: false }
}

// Initialize table using useVxeTable
const { tableConfig, tableEvent } = useVxeTable({
  id: 'my-table',
  api: loadData,
  columns,
  bodyActions: actions,
  permissionMethod
})
</script>
```

### With Card Template Settings

```vue
<template>
  <div>
    <el-button @click="showSettings = true">Card Settings</el-button>
    
    <ResponsiveTable
      :id="'my-table'"
      :api="loadData"
      :columns="columns"
      :body-actions="actions"
    />
    
    <CardTemplateSettings
      v-model="showSettings"
      :table-id="'my-table'"
      @settings-saved="handleSettingsSaved"
    />
  </div>
</template>
```

## Card Templates

### Default Template
- 3 primary fields
- Standard spacing
- Balanced layout

### Compact Template
- 2 primary fields
- Minimal spacing
- More cards visible

### Detailed Template
- 4 primary fields
- Expanded layout
- More information visible

## User Preferences

Card template settings are stored in user preferences and persist across sessions:

```typescript
interface CardTemplateSettings {
  templateId: string
  primaryColumns: number
  layout: 'default' | 'compact' | 'detailed'
  customFields?: CustomField[]
}
```

## Mobile Features

### Virtual Scrolling
- Automatic lazy loading
- Configurable page size
- Smooth scrolling experience

### Action Menus
- Dropdown menus in top-right corner
- Permission-based visibility
- Consistent with desktop actions

### Expandable Details
- Show/hide additional fields
- Smooth animations
- Touch-friendly interactions

## Responsive Behavior

- **Desktop (>768px)**: VxeGrid with full table functionality
- **Mobile/Tablet (≤768px)**: Card list view with mobile-optimized UI

## Integration with Existing Code

The ResponsiveTable component is designed to work with existing `useVxeTable` usage:

```vue
<!-- Before -->
<script setup>
const { tableConfig, tableEvent, tableRef } = useVxeTable(params)
</script>

<template>
  <VxeGrid v-bind="tableConfig" v-on="tableEvent" ref="tableRef">
    <template #toolbar_buttons>
      <!-- Custom toolbar content -->
    </template>
  </VxeGrid>
</template>

<!-- After -->
<script setup>
const { tableConfig, tableEvent, tableRef } = useVxeTable(params)
</script>

<template>
  <ResponsiveTable 
    :table-config="tableConfig" 
    :table-event="tableEvent" 
    :table-ref="tableRef"
  >
    <template #toolbar_buttons>
      <!-- Custom toolbar content -->
    </template>
  </ResponsiveTable>
</template>
```

### Custom Slots Support

All VxeGrid slots are automatically passed through to the desktop view:

```vue
<ResponsiveTable 
  :table-config="tableConfig" 
  :table-event="tableEvent" 
  :table-ref="tableRef"
>
  <template #toolbar_buttons>
    <ResponsiveFilter />
  </template>
  <template #toolbarTools>
    <el-button>Custom Tool</el-button>
  </template>
  <template #custom_slot>
    <div>Custom content</div>
  </template>
</ResponsiveTable>
```

## Customization

### Custom Card Templates
Create custom templates using the `useCardTemplate` composable:

```typescript
const { createCustomTemplate } = useCardTemplate()

const customTemplate = createCustomTemplate({
  name: 'My Template',
  description: 'Custom layout',
  primaryColumns: 5,
  layout: 'detailed',
  customFields: [
    { field: 'customField', label: 'Custom', type: 'text' }
  ]
})
```

### Custom Field Components
Extend the field rendering system by adding new field types in `CardListView.vue`.

## Performance Considerations

- Virtual scrolling reduces memory usage on mobile
- Lazy loading prevents unnecessary API calls
- Card templates are cached in user preferences
- Responsive detection uses efficient viewport queries

## Browser Support

- Modern browsers with CSS Grid support
- Touch devices for mobile interactions
- Element Plus component compatibility 
