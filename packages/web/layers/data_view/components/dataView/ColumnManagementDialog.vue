<template>
  <el-dialog
    v-model="dialogVisible"
    title="Manage Columns"
    width="700px"
    :before-close="handleClose"
  >
    <div class="column-management-container">
      <!-- Search and Actions -->
      <div class="management-header">
        <el-input
          v-model="searchQuery"
          placeholder="Search columns..."
          clearable
          class="search-input"
        />
        <div class="header-actions">
          <el-button @click="showAllColumns" size="small">Show All</el-button>
          <el-button @click="hideAllColumns" size="small">Hide All</el-button>
          <el-button @click="resetToDefaults" size="small" type="info">Reset</el-button>
        </div>
      </div>

      <!-- Column List -->
      <div class="column-list">
        <div class="list-header">
          <span class="column-count">{{ filteredColumns.length }} columns</span>
          <span class="visibility-info">
            {{ visibleCount }} visible, {{ hiddenCount }} hidden
          </span>
        </div>

        <!-- Draggable Column Items -->
        <div class="column-items">
          <div
            v-for="column in filteredColumns"
            :key="column.column_name"
            class="column-item"
            :class="{ 'column-hidden': !isColumnVisible(column.column_name) }"
          >
            <!-- Drag Handle -->
            <div class="drag-handle">
              <el-icon><DCaret /></el-icon>
            </div>

            <!-- Visibility Toggle -->
            <el-switch
              :model-value="isColumnVisible(column.column_name)"
              @change="(value) => toggleColumnVisibility(column.column_name, value)"
              class="visibility-switch"
            />

            <!-- Column Info -->
            <div class="column-info">
              <div class="column-name">
                {{ column.display_name || column.column_name }}
              </div>
              <div class="column-details">
                <el-tag size="small" type="info">{{ column.data_type }}</el-tag>
                <el-tag v-if="column.is_relation" size="small" type="success">Relation</el-tag>
                <el-tag v-if="column.is_system" size="small" type="warning">System</el-tag>
                <span class="column-name-code">{{ column.column_name }}</span>
              </div>
            </div>

            <!-- Column Actions -->
            <div class="column-actions">
              <el-button
                size="small"
                type="primary"
                text
                @click="handleEditColumn(column)"
                :disabled="column.is_system"
              >
                Edit
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">Close</el-button>
        <el-button type="primary" @click="handleApply">
          Apply Changes
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { DCaret } from '@element-plus/icons-vue';
import type { Column } from '../../composables/useDataView';
import { useTablePreferences } from '../../composables/useTablePreferences';

interface Props {
  tableName: string;
  columns: Column[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  columnVisibilityChanged: [];
  editColumn: [column: Column];
  cancelled: [];
}>();

const dialogVisible = ref(false);
const searchQuery = ref('');

// Table preferences
const tablePreferences = useTablePreferences(`dynamic_table_${props.tableName}`);

// Initialize column preferences if not exist
const initializeColumnPreferences = () => {
  const existingPrefs = tablePreferences.preferences.value.columns;
  const existingFields = new Set(existingPrefs.map(pref => pref.field));
  
  // Add any missing columns to preferences
  props.columns.forEach((column, index) => {
    if (!existingFields.has(column.column_name)) {
      tablePreferences.toggleColumnVisibility(column.column_name, true);
    }
  });
};

// Filtered columns based on search
const filteredColumns = computed(() => {
  if (!searchQuery.value) {
    return props.columns;
  }
  
  const query = searchQuery.value.toLowerCase();
  return props.columns.filter(column => 
    column.column_name.toLowerCase().includes(query) ||
    (column.display_name && column.display_name.toLowerCase().includes(query))
  );
});

// Visibility counts
const visibleCount = computed(() => 
  props.columns.filter(col => isColumnVisible(col.column_name)).length
);

const hiddenCount = computed(() => 
  props.columns.length - visibleCount.value
);

// Check if column is visible
const isColumnVisible = (columnName: string): boolean => {
  const pref = tablePreferences.preferences.value.columns.find(col => col.field === columnName);
  return pref?.visible ?? true;
};

// Toggle column visibility
const toggleColumnVisibility = (columnName: string, visible: boolean) => {
  tablePreferences.toggleColumnVisibility(columnName, visible);
};

// Show all columns
const showAllColumns = () => {
  props.columns.forEach(column => {
    tablePreferences.toggleColumnVisibility(column.column_name, true);
  });
  ElMessage.success('All columns are now visible');
};

// Hide all columns (but keep at least one visible)
const hideAllColumns = () => {
  if (props.columns.length <= 1) {
    ElMessage.warning('Cannot hide all columns. At least one column must remain visible.');
    return;
  }
  
  props.columns.forEach((column, index) => {
    // Keep the first column visible
    const shouldBeVisible = index === 0;
    tablePreferences.toggleColumnVisibility(column.column_name, shouldBeVisible);
  });
  
  ElMessage.success('All columns hidden except the first one');
};

// Reset to defaults
const resetToDefaults = () => {
  tablePreferences.resetPreferences();
  initializeColumnPreferences();
  ElMessage.success('Column preferences reset to defaults');
};

// Handle edit column
const handleEditColumn = (column: Column) => {
  emit('editColumn', column);
};

// Open dialog
const open = () => {
  dialogVisible.value = true;
  initializeColumnPreferences();
  searchQuery.value = '';
};

// Handle close
const handleClose = () => {
  dialogVisible.value = false;
  emit('cancelled');
};

// Handle apply changes
const handleApply = () => {
  dialogVisible.value = false;
  emit('columnVisibilityChanged');
  ElMessage.success('Column visibility updated');
};

// Watch for column changes and update preferences
watch(() => props.columns, () => {
  if (dialogVisible.value) {
    initializeColumnPreferences();
  }
}, { deep: true });

defineExpose({
  open
});
</script>

<style scoped>
.column-management-container {
  max-height: 600px;
  display: flex;
  flex-direction: column;
}

.management-header {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.search-input {
  flex: 1;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.column-list {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-light);
  margin-bottom: 12px;
}

.column-count {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.visibility-info {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.column-items {
  flex: 1;
  overflow-y: auto;
  max-height: 400px;
}

.column-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.column-item:hover {
  border-color: var(--el-border-color);
  background-color: var(--el-fill-color-lighter);
}

.column-item.column-hidden {
  opacity: 0.6;
  background-color: var(--el-fill-color-light);
}

.drag-handle {
  cursor: grab;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
}

.drag-handle:active {
  cursor: grabbing;
}

.visibility-switch {
  flex-shrink: 0;
}

.column-info {
  flex: 1;
  min-width: 0;
}

.column-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.column-details {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.column-name-code {
  font-family: var(--el-font-family-mono);
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background-color: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 3px;
}

.column-actions {
  flex-shrink: 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>

