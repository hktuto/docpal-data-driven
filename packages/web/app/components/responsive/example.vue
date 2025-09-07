<template>
  <div class="responsive-table-example">
    <h2>Responsive Table Example</h2>
    
    <!-- Card Template Settings Button -->
    <div class="settings-bar">
      <el-button @click="showCardSettings = true">
        <el-icon><Setting /></el-icon>
        Card Settings
      </el-button>
    </div>

    <!-- Responsive Table -->
    <ResponsiveTable
      :table-config="tableConfig"
      :table-event="tableEvent"
      @action-click="handleActionClick"
      @card-click="handleCardClick"
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
      
      <!-- Toolbar buttons -->
      <template #toolbar_buttons>
        <ResponsiveFilter 
          ref="filterRef" 
          input-key="q" 
          @form-change="handleFilterChange" 
        />
      </template>
    </ResponsiveTable>

    <!-- Card Template Settings Dialog -->
    <CardTemplateSettings
      v-model="showCardSettings"
      :table-id="'example-table'"
      @settings-saved="handleSettingsSaved"
    />
  </div>
</template>

<script lang="ts" setup>
import { Setting } from '@element-plus/icons-vue'
import type { VxeGridPropTypes } from 'vxe-table'
import type { TableMenuActions, PermissionMethodParams } from '../../composables/useVxeTable'
import { useVxeTable } from '../../composables/useVxeTable'

// Table configuration
const columns: VxeGridPropTypes.Columns = [
  {
    field: 'name',
    title: 'Name',
    width: 200
  },
  {
    field: 'email',
    title: 'Email',
    width: 250
  },
  {
    slots: { default: 'status' },
    title: 'Status',
    width: 100
  },
  {
    field: 'createdDate',
    title: 'Created Date',
    width: 150,
    formatter: ({ cellValue }) => {
      return new Date(cellValue).toLocaleDateString()
    }
  },
  {
    field: 'department',
    title: 'Department',
    width: 150
  },
  {
    field: 'role',
    title: 'Role',
    width: 120
  }
]

// Body actions
const bodyActions: TableMenuActions[][] = [
  [
    {
      code: 'edit',
      name: 'edit',
      label: 'Edit',
      action: ({ row }) => {
        console.log('Edit row:', row)
      }
    },
    {
      code: 'delete',
      name: 'delete',
      label: 'Delete',
      action: ({ row }) => {
        console.log('Delete row:', row)
      }
    }
  ]
]

// Permission method
function permissionMethod({ row, code }: PermissionMethodParams) {
  // Example: disable delete for active users
  if (code === 'delete' && row?.status === 'active') {
    return { visible: true, disabled: true }
  }
  return { visible: true, disabled: false }
}

// Mock data loading
async function loadData(params: any) {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500))
  
  const mockData = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
      status: 'active',
      createdDate: '2024-01-15',
      department: 'Engineering',
      role: 'Developer'
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      status: 'inactive',
      createdDate: '2024-01-10',
      department: 'Marketing',
      role: 'Manager'
    },
    {
      id: 3,
      name: 'Bob Johnson',
      email: 'bob.johnson@example.com',
      status: 'active',
      createdDate: '2024-01-20',
      department: 'Sales',
      role: 'Representative'
    }
  ]
  
  return {
    data: {
      entryList: mockData,
      totalSize: mockData.length
    }
  }
}

// Event handlers
function handleRowClick({ row }: any) {
  console.log('Row clicked:', row)
}

function handleActionClick({ action, row }: any) {
  console.log('Action clicked:', action.code, row)
}

function handleCardClick({ row }: any) {
  console.log('Card clicked:', row)
}

function handleFilterChange(formData: any) {
  console.log('Filter changed:', formData)
}

function handleSettingsSaved(settings: any) {
  console.log('Card settings saved:', settings)
}

// Initialize table using useVxeTable
const { tableConfig, tableEvent, reload, query } = useVxeTable({
  id: 'example-table',
  api: loadData,
  columns,
  bodyActions,
  permissionMethod,
  dblClickAction: handleRowClick
})

// State
const showCardSettings = ref(false)
const filterRef = ref()
</script>

<style lang="scss" scoped>
.responsive-table-example {
  padding: 20px;
  
  h2 {
    margin-bottom: 20px;
  }
}

.settings-bar {
  margin-bottom: 16px;
  display: flex;
  justify-content: flex-end;
}
</style> 
