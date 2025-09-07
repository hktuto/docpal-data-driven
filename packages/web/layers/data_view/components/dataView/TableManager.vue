<template>
  <div class="table-manager-container">
    <!-- Header with table info -->
    <div class="table-header">
      <div class="table-info">
        <h2 class="table-title">{{ tableDisplayName }}</h2>
        <p v-if="tableDescription" class="table-description">{{ tableDescription }}</p>
      </div>
      <div class="table-actions">
        <!-- Additional header actions can go here -->
      </div>
    </div>

    <!-- Tab Navigation -->
    <el-tabs 
      v-model="activeTab" 
      type="card" 
      class="table-manager-tabs"
      @tab-change="handleTabChange"
    >
      <!-- Data Tab -->
      <el-tab-pane label="Data" name="data" :lazy="false">
        <template #label>
          <div class="tab-label">
            <el-icon><Grid /></el-icon>
            <span>Data</span>
          </div>
        </template>
        
        <div class="tab-content">
          <DynamicTable 
            :columns="sharedTableData.columns"
            :permission="sharedTableData.permission"
            :loading="sharedTableData.loading"
            :table-name="sharedTableData.tableName"
            @column-created="handleColumnCreated"
            @data-imported="handleDataImported"
          />
        </div>
      </el-tab-pane>

      <!-- Forms Tab -->
      <el-tab-pane label="Forms" name="forms" :lazy="true">
        <template #label>
          <div class="tab-label">
            <el-icon><Document /></el-icon>
            <span>Forms</span>
          </div>
        </template>
        
        <div class="tab-content">
          <TableFormsManager 
            :table-name="sharedTableData.tableName"
            :columns="sharedTableData.columns"
            :permission="sharedTableData.permission"
            :loading="sharedTableData.loading"
          />
        </div>
      </el-tab-pane>

      <!-- Permission Tab (only if user can manage) -->
      <el-tab-pane 
        v-if="canManagePermissions" 
        label="Permissions" 
        name="permissions" 
        :lazy="true"
      >
        <template #label>
          <div class="tab-label">
            <el-icon><Lock /></el-icon>
            <span>Permissions</span>
          </div>
        </template>
        
        <div class="tab-content">
          <TablePermissionsManager 
            :table-name="sharedTableData.tableName"
            :columns="sharedTableData.columns"
            :permission="sharedTableData.permission"
            :loading="sharedTableData.loading"
          />
        </div>
      </el-tab-pane>

      <!-- Actions Tab (placeholder for future features) -->
      <el-tab-pane label="Actions" name="actions" :lazy="true">
        <template #label>
          <div class="tab-label">
            <el-icon><Setting /></el-icon>
            <span>Actions</span>
          </div>
        </template>
        
        <div class="tab-content">
          <TableActionsManager 
            :table-name="sharedTableData.tableName"
            :columns="sharedTableData.columns"
            :permission="sharedTableData.permission"
            :loading="sharedTableData.loading"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Grid, Document, Lock, Setting } from '@element-plus/icons-vue';
import DynamicTable from './table.vue';
// @ts-ignore
import TableFormsManager from './TableFormsManager.vue';
// @ts-ignore
import TablePermissionsManager from './TablePermissionsManager.vue';
// @ts-ignore
import TableActionsManager from './TableActionsManager.vue';
import { useDataView } from '../../composables/useDataView';

interface Props {
  tableName: string;
  defaultTab?: 'data' | 'forms' | 'permissions' | 'actions';
}

const props = withDefaults(defineProps<Props>(), {
  defaultTab: 'data'
});

const emit = defineEmits<{
  tabChange: [tabName: string];
}>();

// Active tab state
const activeTab = ref(props.defaultTab);

// Get table metadata and permissions - centralized for all tabs
const { columns, permission, loading, initSettings } = useDataView(props.tableName);

// Computed properties for table info
const tableDisplayName = computed(() => {
  // You might want to get this from table metadata
  return props.tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
});

const tableDescription = computed(() => {
  // You might want to get this from table metadata
  return `Manage data and settings for ${tableDisplayName.value}`;
});

// Permission checks
const canManagePermissions = computed(() => {
  return permission.value?.permissionMap?.can_manage === true;
});

// Shared data for child components
const sharedTableData = computed(() => ({
  columns: columns.value,
  permission: permission.value,
  loading: loading.value,
  tableName: props.tableName,
  canManage: canManagePermissions.value
}));

// Tab change handler
const handleTabChange = (tabName: string) => {
  activeTab.value = tabName as 'data' | 'forms' | 'permissions' | 'actions';
  emit('tabChange', tabName);
};

// Handle column created event from DynamicTable
const handleColumnCreated = () => {
  // Refresh table data when a new column is created
  initSettings();
};

// Handle data imported event from DynamicTable
const handleDataImported = (count: number) => {
  // Optionally refresh table metadata if needed
  // For now, the table component handles its own data refresh
  console.log(`${count} records imported successfully`);
};

// Initialize on mount
onMounted(() => {
  // initSettings();
});
</script>

<style scoped>
.table-manager-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 0;
  border-bottom: 1px solid var(--el-border-color-light);
  margin-bottom: 16px;
}

.table-info {
  flex: 1;
}

.table-title {
  margin: 0 0 4px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.table-description {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.table-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.table-manager-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.table-manager-tabs :deep(.el-tabs__content) {
  flex: 1;
  padding: 0;
}

.table-manager-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-label .el-icon {
  font-size: 16px;
}

.tab-content {
  height: 100%;
  padding: 16px 0;
}

/* Responsive design */
@media (max-width: 768px) {
  .table-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .table-title {
    font-size: 20px;
  }
  
  .tab-label span {
    display: none;
  }
}
</style>
