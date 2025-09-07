<script setup lang="ts" generic="T extends Record<string, any>">
import { apiClient } from 'api-client';
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import type { Column } from '../../composables/useDataView';
import { Plus, Upload, Download, Setting } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import CreateColumnDialog from './CreateColumnDialog.vue';
import EditColumnDialog from './EditColumnDialog.vue';
import ColumnManagementDialog from './ColumnManagementDialog.vue';
import BatchImportDialog from './BatchImportDialog.vue';
import { useTablePreferences } from '../../composables/useTablePreferences';
import { ListTable, VTable } from '@visactor/vue-vtable';
import { downloadExcel, exportVTableToExcel } from '@visactor/vtable-export';

interface Props {
  columns: Column[];
  permission: any;
  loading: boolean;
  tableName: string;
}

const props = defineProps<Props>();

// Emit events for parent component
const emit = defineEmits<{
  columnCreated: [];
  dataImported: [count: number];
  createEntry: [];
}>();

function reloadData() {
  records.value = [];
  getTotalRecords();
  tableInstance.value.renderWithRecreateCells();
}

// Dialog refs
const newColumnDialogRef = ref();
const editColumnDialogRef = ref();
const columnManagementDialogRef = ref();
const batchImportDialogRef = ref();

// Export state
const exporting = ref(false);

// Table preferences for localStorage
const tablePreferences = useTablePreferences(`dynamic_table_${props.tableName}`);

// VTable ref
const tableInstance = ref();

// Export plugin instance
let exportPlugin: any = null;

const sorts = ref<Array<{ column: string; direction: 'asc' | 'desc' }>>([]);
const filters = ref<any[]>([]);

// Convert dynamic columns to VTable columns format
const vtableColumns = computed(() => {
  if (!props.columns || props.columns.length === 0) return [];
  
  const baseColumns = props.columns.map((col: Column) => {
    const vtableColumn: any = {
      field: col.column_name,
      title: col.display_name || col.column_name,
      width: 150,
      minWidth: 150,
      maxWidth: 400,
      sort: col.can_sort,
    };

    // Add sorting if allowed
    if (col.can_sort) {
      vtableColumn.sortable = true;
    }
    // Handle different data types
    switch (col.data_type) {
      case 'boolean':
        vtableColumn.cellType = 'checkbox';
        vtableColumn.disable = true;
        break;
      case 'date':
      case 'datetime':
        vtableColumn.cellType = 'datetime';
        break;
      case 'number':
      case 'integer':
        vtableColumn.cellType = 'text';
        vtableColumn.align = 'right';
        break;
      case 'jsonb':
        vtableColumn.cellType = 'text';
        vtableColumn.customRender = ({value}: any) => {
          return JSON.stringify(value);
        };
        break;
      default:
        vtableColumn.cellType = 'text';
    }

    // Handle relation columns
    if (col.is_relation && col.relation_config) {
      if (col.relation_config.display_template) {
        vtableColumn.formatter = (value: any) => {
          if (value && typeof value === 'object') {
            return col.relation_config.display_template.replace(/\{(\w+)\}/g, (match: string, key: string) => {
              return value[key] || '';
            });
          }
          return value || '';
        };
      }
    }

    return vtableColumn;
  });

  // Apply preferences (order, width, visibility)
  return tablePreferences.applyPreferencesToColumns(baseColumns, tablePreferences.preferences.value);
});

// Check if user can manage (create new columns)
const canManage = computed(() => {
  return props.permission?.permissionMap?.can_manage;
});

const canCreateEntry = computed(() => {
  return props.permission?.permissionMap?.can_create;
});

const controller = new AbortController();
// Load table data
const totalRecords = ref(1);
const records = ref<any[]>([]);
async function getTotalRecords() {
  try{

    if(totalRecords.value > records.value.length){
      await loadTableData(records.value.length, 100);
      return getTotalRecords()
    }else{
      return;
    }
  }catch(error){
    console.error(error);
    return;
  }
}
const loadTableData = async (startIndex: number, num: number = 100) => {

  try {
    const queryParams = {
      select: props.columns.filter(col => !col.is_relation).map(col => col.column_name),
      includeRelations: props.columns
        .filter(col => col.is_relation)
        .map(col => ({ name: col.relation_config.relation_name })),
      relationMode: "embedded" as const,
      filters: filters.value,
      sorts: sorts.value,
      page: startIndex + 1,
      includeVirtualColumns: true,
      pageSize: num,
    };

    const data = await apiClient.companies.postDataRecordsTablenameQuerytable(
      props.tableName,
      queryParams,
      {
        signal: controller.signal
      }
    );
    totalRecords.value = data.pagination?.total || 0;
    records.value.push(...(data.data || []));
  } catch (error) {
    throw error;
  }
};


// VTable configuration
const tableConfig = computed(() => ({
  columns: vtableColumns.value,
  theme: VTable.themes.DEFAULT,
  multipleSort: true,
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

  sort: {
    field: sorts.value[0]?.column || '',
    order: sorts.value[0]?.direction || 'asc'
  },
}));


// Handle creating new column
const handleCreateNewColumn = () => {
  if (!canManage.value) {
    console.warn('User does not have permission to create new columns');
    return;
  }
  
  // Open create column dialog
  newColumnDialogRef.value?.open();
};

// Handle column created
const handleColumnCreated = () => {
  // Emit event to parent to refresh data
  emit('columnCreated');
};

// Handle column management
const handleManageColumns = () => {
  columnManagementDialogRef.value?.open();
};

// Handle column visibility changed
const handleColumnVisibilityChanged = () => {
  // Refresh the table to apply new column visibility
  nextTick(() => {
    tableInstance.value?.renderWithRecreateCells();
  });
};

// Handle edit column
const handleEditColumn = (column: Column) => {
  editColumnDialogRef.value?.open(column);
};

// Handle column updated
const handleColumnUpdated = () => {
  // Emit event to parent to refresh data
  emit('columnCreated'); // Reuse the same event as it triggers a full refresh
};

// Handle column deleted
const handleColumnDeleted = () => {
  // Emit event to parent to refresh data
  emit('columnCreated'); // Reuse the same event as it triggers a full refresh
};

// Handle batch import
const handleBatchImport = () => {
  if (!canManage.value) {
    console.warn('User does not have permission to import data');
    return;
  }
  
  // Open batch import dialog
  batchImportDialogRef.value?.open();
};

// Handle data imported
const handleDataImported = (count: number) => {
  // Emit event to parent and reload table
  emit('dataImported', count);
  // Reload table data
  nextTick(() => {
    // Refresh table by reloading data
    records.value = [];
    getTotalRecords();
  });
};

// Handle Excel export using VTable's native export
const handleExportExcel = async () => {
  if (exporting.value) return;
  
  try {
    exporting.value = true;
    
    // Use VTable's native export functionality
    const exportOptions = {
      ignoreIcon: true, // Don't export icons, just text
      formatExportOutput: ({ cellType, cellValue, table, col, row }: any) => {
        // Handle special cell types
        if (cellType === 'checkbox') {
          return table.getCellCheckboxState(col, row) ? 'Yes' : 'No';
        }
        // For other types, use default behavior
        return undefined;
      }
    };
    
    // Get the table instance
    const tableRef = tableInstance.value;
    console.log('tableRef', tableInstance.value);
    if (!tableRef) {
      throw new Error('Table instance not available');
    }
    
    // Export and download
    const excelBuffer = await exportVTableToExcel(tableRef, exportOptions);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${props.tableName}_export_${timestamp}`;
    
    await downloadExcel(excelBuffer, filename);
    
    ElMessage.success(`Data exported to ${filename}.xlsx`);
    
  } catch (error) {
    console.error('Export error:', error);
    ElMessage.error('Failed to export data to Excel');
  } finally {
    exporting.value = false;
  }
};


const handleCreateEntry = () => {
  emit('createEntry');
};

async function handleTableReady(tableReadyParams: any) {
  records.value = [];
  tableInstance.value = tableReadyParams;
  getTotalRecords();
}

onUnmounted(() => {
  controller.abort();
});

defineExpose({
  reloadData,
});



</script>

<template>
  <div class="dynamic-table-container">
    <!-- Loading state -->
    <div v-if="props.loading" class="loading-container">
      <el-skeleton :rows="5" animated />
    </div>
    
    <!-- Table -->
    <div v-else-if="props.columns.length > 0" class="table-wrapper">
      <!-- Custom toolbar for creating new columns -->
      <div class="table-toolbar">
        <div class="toolbar-left">
          <el-button 
            type="info" 
            @click="handleExportExcel"
            :icon="Download"
            :loading="exporting"
          >
            {{ exporting ? 'Exporting...' : 'Export Excel' }}
          </el-button>
          <el-button 
            v-if="canManage" 
            type="success" 
            @click="handleBatchImport"
            :icon="Upload"
          >
            Batch Import
          </el-button>
        </div>
        
        <div class="toolbar-right">
          <el-button 
            @click="handleManageColumns"
            :icon="Setting"
            title="Manage Columns"
          >
            Columns
          </el-button>
          <el-button 
            v-if="canManage" 
            type="primary" 
            @click="handleCreateNewColumn"
            :icon="Plus"
          >
            Add Column
          </el-button>
          <el-button 
            v-if="canCreateEntry"
            type="primary" 
            @click="handleCreateEntry"
            :icon="Plus"
          >
            Add Entry
          </el-button>
        </div>
      </div>

      <!-- VTable -->
      <ListTable
        ref="tableRef"
        :options="tableConfig"
        :records="records"
        @ready="handleTableReady"
      />
    </div>

    <!-- Empty state -->
    <div v-else-if="!props.loading" class="empty-state">
      <el-empty description="No columns configured for this table">
        <div v-if="canManage" class="empty-actions">
          <el-button type="primary" @click="handleCreateNewColumn">
            Add First Column
          </el-button>
        </div>
      </el-empty>
    </div>

    <!-- Create Column Dialog -->
    <CreateColumnDialog 
      ref="newColumnDialogRef"
      :table-name="props.tableName"
      @created="handleColumnCreated"
      @cancelled="() => {}"
    />

    <!-- Edit Column Dialog -->
    <EditColumnDialog 
      ref="editColumnDialogRef"
      :table-name="props.tableName"
      @updated="handleColumnUpdated"
      @deleted="handleColumnDeleted"
      @cancelled="() => {}"
    />

    <!-- Column Management Dialog -->
    <ColumnManagementDialog 
      ref="columnManagementDialogRef"
      :table-name="props.tableName"
      :columns="props.columns"
      @column-visibility-changed="handleColumnVisibilityChanged"
      @edit-column="handleEditColumn"
      @cancelled="() => {}"
    />

    <!-- Batch Import Dialog -->
    <BatchImportDialog 
      ref="batchImportDialogRef"
      :table-name="props.tableName"
      :columns="props.columns"
      @imported="handleDataImported"
      @cancelled="() => {}"
    />

  </div>
</template>

<style scoped>
.dynamic-table-container {
  width: 100%;
  height: 100%;
}

.loading-container {
  padding: 20px;
}

.table-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.table-toolbar {
  padding: 16px;
  border-bottom: 1px solid #e5e6eb;
  background-color: #fafafa;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

.vtable-component {
  flex: 1;
  min-height: 400px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.toolbar-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}

.empty-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}
</style>