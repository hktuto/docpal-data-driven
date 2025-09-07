# Migration Guide: VxeGrid to ResponsiveTable

This guide helps you migrate from existing VxeGrid usage to the new ResponsiveTable component with minimal code changes.

## Quick Migration

### Step 1: Import ResponsiveTable
```vue
<script setup>
// Add this import
import ResponsiveTable from '../../components/responsive/table.vue'
</script>
```

### Step 2: Replace VxeGrid with ResponsiveTable
```vue
<!-- Before -->
<template>
  <VxeGrid v-bind="tableConfig" v-on="tableEvent" ref="tableRef">
    <template #toolbar_buttons>
      <ResponsiveFilter />
    </template>
  </VxeGrid>
</template>

<!-- After -->
<template>
  <ResponsiveTable 
    :table-config="tableConfig" 
    :table-event="tableEvent" 
    :table-ref="tableRef"
  >
    <template #toolbar_buttons>
      <ResponsiveFilter />
    </template>
  </ResponsiveTable>
</template>
```

## Detailed Migration Examples

### Example 1: Basic Table
```vue
<!-- Before -->
<script setup>
const { tableConfig, tableEvent, tableRef } = useVxeTable({
  id: 'user-table',
  api: loadUsers,
  columns: userColumns,
  bodyActions: userActions
})
</script>

<template>
  <VxeGrid v-bind="tableConfig" v-on="tableEvent" ref="tableRef" />
</template>

<!-- After -->
<script setup>
const { tableConfig, tableEvent } = useVxeTable({
  id: 'user-table',
  api: loadUsers,
  columns: userColumns,
  bodyActions: userActions
})
</script>

<template>
  <ResponsiveTable 
    :table-config="tableConfig" 
    :table-event="tableEvent" 
  />
</template>
```

### Example 2: Table with Custom Slots
```vue
<!-- Before -->
<script setup>
const { tableConfig, tableEvent, tableRef } = useVxeTable({
  id: 'document-table',
  api: loadDocuments,
  columns: documentColumns,
  bodyActions: documentActions
})
</script>

<template>
  <VxeGrid v-bind="tableConfig" v-on="tableEvent" ref="tableRef">
    <template #toolbar_buttons>
      <ResponsiveFilter input-key="q" @form-change="handleFilter" />
      <el-button @click="exportData">Export</el-button>
    </template>
    <template #toolbarTools>
      <el-button @click="bulkDelete">Bulk Delete</el-button>
    </template>
  </VxeGrid>
</template>

<!-- After -->
<script setup>
const { tableConfig, tableEvent } = useVxeTable({
  id: 'document-table',
  api: loadDocuments,
  columns: documentColumns,
  bodyActions: documentActions
})
</script>

<template>
  <ResponsiveTable 
    :table-config="tableConfig" 
    :table-event="tableEvent" 
  >
    <template #toolbar_buttons>
      <ResponsiveFilter input-key="q" @form-change="handleFilter" />
      <el-button @click="exportData">Export</el-button>
    </template>
    <template #toolbarTools>
      <el-button @click="bulkDelete">Bulk Delete</el-button>
    </template>
  </ResponsiveTable>
</template>
```

### Example 3: Table with Event Handlers
```vue
<!-- Before -->
<script setup>
const { tableConfig, tableEvent, tableRef } = useVxeTable({
  id: 'order-table',
  api: loadOrders,
  columns: orderColumns,
  bodyActions: orderActions,
  dblClickAction: handleRowDblClick
})
</script>

<template>
  <VxeGrid v-bind="tableConfig" v-on="tableEvent" ref="tableRef" />
</template>

<!-- After -->
<script setup>
const { tableConfig, tableEvent } = useVxeTable({
  id: 'order-table',
  api: loadOrders,
  columns: orderColumns,
  bodyActions: orderActions,
  dblClickAction: handleRowDblClick
})
</script>

<template>
  <ResponsiveTable 
    :table-config="tableConfig" 
    :table-event="tableEvent" 
    :dbl-click-action="handleRowDblClick"
    @action-click="handleActionClick"
    @card-click="handleCardClick"
  />
</template>
```

## What Stays the Same

✅ **useVxeTable composable** - No changes needed
✅ **Table configuration** - Same props and options
✅ **API calls** - Same data loading logic
✅ **Event handlers** - Same event handling
✅ **Custom slots** - All slots are preserved
✅ **Permissions** - Same permission logic
✅ **Actions** - Same action definitions
✅ **All table methods** - All VxeGrid methods are exposed through ResponsiveTable ref

## What's New

🆕 **Mobile card view** - Automatic switching on mobile devices
🆕 **Card template settings** - Customizable card appearance
🆕 **Mobile action menus** - Touch-friendly action dropdowns
🆕 **Expandable details** - Show/hide additional fields on mobile
🆕 **Virtual scrolling** - Performance optimized for mobile

## Optional Enhancements

### Add Card Template Settings
```vue
<template>
  <div>
    <el-button @click="showCardSettings = true">Card Settings</el-button>
    
    <ResponsiveTable 
      :table-config="tableConfig" 
      :table-event="tableEvent" 
    />
    
    <CardTemplateSettings
      v-model="showCardSettings"
      :table-id="'my-table'"
      @settings-saved="handleSettingsSaved"
    />
  </div>
</template>
```

### Handle Mobile-Specific Events
```vue
<template>
  <ResponsiveTable 
    :table-config="tableConfig" 
    :table-event="tableEvent" 
    @action-click="handleMobileAction"
    @card-click="handleMobileCardClick"
  />
</template>

<script setup>
function handleMobileAction({ action, row, event }) {
  console.log('Mobile action:', action.code, row)
}

function handleMobileCardClick({ row, event }) {
  console.log('Mobile card clicked:', row)
}
</script>
```

### Using Table Methods
```vue
<template>
  <ResponsiveTable 
    ref="responsiveTableRef"
    :table-config="tableConfig" 
    :table-event="tableEvent" 
    :table-ref="tableRef"
  />
</template>

<script setup>
const responsiveTableRef = ref()

// All VxeGrid methods work the same way
function handleReload() {
  responsiveTableRef.value?.reload()
}

function handleExport() {
  responsiveTableRef.value?.exportData({ type: 'xlsx' })
}

function handleClearSelection() {
  responsiveTableRef.value?.cleanSelectedRows()
}

function handleGetSelected() {
  const selected = responsiveTableRef.value?.getCheckboxRecords()
  console.log('Selected rows:', selected)
}
</script>
```

## Benefits of Migration

1. **Zero Breaking Changes** - Existing code continues to work
2. **Automatic Mobile Support** - No additional mobile development needed
3. **Better User Experience** - Native mobile interface
4. **Performance Optimized** - Virtual scrolling and lazy loading
5. **Customizable** - User-configurable card layouts
6. **Future-Proof** - Built on existing, proven architecture

## Troubleshooting

### Common Issues

**Q: My custom slots aren't working**
A: Make sure you're passing the slot content inside ResponsiveTable tags, not VxeGrid.

**Q: Mobile view isn't showing**
A: Check that your viewport is less than 768px wide. Use browser dev tools to simulate mobile.

**Q: Actions aren't working on mobile**
A: Ensure your actions have both `code` and `name` properties defined.

**Q: Card layout looks wrong**
A: Use the Card Template Settings dialog to customize the appearance.

## Support

For additional help with migration, refer to:
- [ResponsiveTable Documentation](./README.md)
- [useVxeTable Documentation](../composables/useVxeTable.ts)
- [Card Template Settings](./cardTemplateSettings.vue) 
