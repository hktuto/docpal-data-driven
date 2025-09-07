<template>
  <el-dialog
    v-model="dialogVisible"
    title="Edit Column"
    width="600px"
    :before-close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
    >
      <el-form-item label="Column Name" prop="column_name">
        <el-input
          v-model="form.column_name"
          placeholder="Enter column name (e.g., user_email)"
          :disabled="true"
        />
        <div class="form-help-text">Column name cannot be changed after creation</div>
      </el-form-item>

      <el-form-item label="Display Name" prop="display_name">
        <el-input
          v-model="form.display_name"
          placeholder="Enter display name (e.g., User Email)"
        />
      </el-form-item>

      <el-form-item label="Data Type" prop="data_type">
        <el-select v-model="form.data_type" placeholder="Select data type" :disabled="true">
          <el-option label="Text" value="text" />
          <el-option label="Number" value="number" />
          <el-option label="Integer" value="integer" />
          <el-option label="Boolean" value="boolean" />
          <el-option label="Date" value="date" />
          <el-option label="DateTime" value="datetime" />
          <el-option label="JSON" value="json" />
        </el-select>
        <div class="form-help-text">Data type cannot be changed after creation</div>
      </el-form-item>

      <el-form-item label="Column Type" prop="column_type">
        <el-select v-model="form.column_type" placeholder="Select column type" :disabled="true">
          <el-option label="Standard" value="standard" />
          <el-option label="Computed" value="computed" />
          <el-option label="Relation" value="relation" />
        </el-select>
        <div class="form-help-text">Column type cannot be changed after creation</div>
      </el-form-item>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="Allow Sorting">
            <el-switch v-model="form.can_sort" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="Allow Filtering">
            <el-switch v-model="form.can_filter" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item v-if="form.can_filter" label="Filter Type" prop="filter_type">
        <el-select v-model="form.filter_type" placeholder="Select filter type">
          <el-option label="Text" value="text" />
          <el-option label="Number" value="number" />
          <el-option label="Date" value="date" />
          <el-option label="Select" value="select" />
        </el-select>
      </el-form-item>

      <!-- Relation Configuration (shown when column_type is 'relation') -->
      <template v-if="form.column_type === 'relation'">
        <el-divider content-position="left">Relation Configuration</el-divider>
        
        <el-form-item label="Target Table" prop="relation_config.target_table">
          <el-input
            v-model="form.relation_config.target_table"
            placeholder="Enter target table name"
          />
        </el-form-item>

        <el-form-item label="Relation Type" prop="relation_config.relation_type">
          <el-select v-model="form.relation_config.relation_type" placeholder="Select relation type">
            <el-option label="One to One" value="one_to_one" />
            <el-option label="One to Many" value="one_to_many" />
            <el-option label="Many to One" value="many_to_one" />
            <el-option label="Many to Many" value="many_to_many" />
          </el-select>
        </el-form-item>

        <el-form-item label="Display Template" prop="relation_config.display_template">
          <el-input
            v-model="form.relation_config.display_template"
            placeholder="e.g., {name} ({email})"
          />
        </el-form-item>
      </template>

      <!-- Danger Zone -->
      <el-divider content-position="left">Danger Zone</el-divider>
      <el-form-item>
        <el-button 
          type="danger" 
          plain 
          @click="handleDeleteColumn"
          :loading="deleting"
        >
          Delete Column
        </el-button>
        <div class="form-help-text">This action cannot be undone. All data in this column will be lost.</div>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">Cancel</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="loading">
          Update Column
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { apiClient } from 'api-client';
import type { Column } from '../../composables/useDataView';

interface Props {
  tableName: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  updated: [columnId: string];
  deleted: [columnId: string];
  cancelled: [];
}>();

const dialogVisible = ref(false);
const loading = ref(false);
const deleting = ref(false);
const formRef = ref<FormInstance>();
const currentColumn = ref<Column | null>(null);

const form = reactive<any>({
  id: '',
  column_name: '',
  display_name: '',
  data_type: 'text',
  column_type: 'standard',
  can_sort: true,
  can_filter: true,
  filter_type: 'text',
  is_system: false,
  is_relation: false,
  relation_config: {
    relation_name: '',
    relation_type: 'one_to_one',
    target_table: '',
    target_column: 'id',
    display_columns: [],
    display_template: ''
  }
});

const rules: FormRules = {
  display_name: [
    { required: true, message: 'Display name is required', trigger: 'blur' }
  ]
};

const open = (column: Column) => {
  currentColumn.value = column;
  dialogVisible.value = true;
  populateForm(column);
};

const populateForm = (column: Column) => {
  form.id = column.id;
  form.column_name = column.column_name;
  form.display_name = column.display_name || column.column_name;
  form.data_type = column.data_type;
  form.column_type = column.column_type || 'standard';
  form.can_sort = column.can_sort;
  form.can_filter = column.can_filter;
  form.filter_type = column.filter_type || 'text';
  form.is_system = column.is_system;
  form.is_relation = column.is_relation;
  
  if (column.relation_config) {
    form.relation_config = {
      relation_name: column.relation_config.relation_name || '',
      relation_type: column.relation_config.relation_type || 'one_to_one',
      target_table: column.relation_config.target_table || '',
      target_column: column.relation_config.target_column || 'id',
      display_columns: column.relation_config.display_columns || [],
      display_template: column.relation_config.display_template || ''
    };
  }
  
  formRef.value?.clearValidate();
};

const resetForm = () => {
  form.id = '';
  form.column_name = '';
  form.display_name = '';
  form.data_type = 'text';
  form.column_type = 'standard';
  form.can_sort = true;
  form.can_filter = true;
  form.filter_type = 'text';
  form.is_system = false;
  form.is_relation = false;
  form.relation_config = {
    relation_name: '',
    relation_type: 'one_to_one',
    target_table: '',
    target_column: 'id',
    display_columns: [],
    display_template: ''
  };
  formRef.value?.clearValidate();
};

const handleClose = () => {
  dialogVisible.value = false;
  currentColumn.value = null;
  emit('cancelled');
};

const handleSubmit = async () => {
  if (!formRef.value || !currentColumn.value) return;

  try {
    const valid = await formRef.value.validate();
    if (!valid) return;

    loading.value = true;

    // Prepare the column data
    const columnData = {
      ...form,
      is_relation: form.column_type === 'relation',
      relation_config: form.column_type === 'relation' ? {
        ...form.relation_config,
        relation_name: form.column_name
      } : null
    };

    // Call API to update column
    const response = await apiClient.companies.putDataSchemaTableNameColumnsColumnName(
      props.tableName,
      form.column_name,
      columnData
    );

    if (response.data) {
      dialogVisible.value = false;
      emit('updated', response.data.id);
      ElMessage.success('Column updated successfully');
    } else {
      ElMessage.error('Failed to update column');
    }
  } catch (error) {
    console.error('Error updating column:', error);
    ElMessage.error('Failed to update column');
  } finally {
    loading.value = false;
  }
};

const handleDeleteColumn = async () => {
  if (!currentColumn.value) return;

  try {
    await ElMessageBox.confirm(
      `Are you sure you want to delete the column "${currentColumn.value.display_name || currentColumn.value.column_name}"? This action cannot be undone and all data in this column will be lost.`,
      'Delete Column',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    );

    deleting.value = true;

    // TODO: Implement delete column API endpoint
    // For now, show a message that this feature is not yet available
    ElMessage.warning('Delete column functionality is not yet implemented. Please contact your administrator.');
    
    // Uncomment when API endpoint is available:
    // await apiClient.companies.deleteDataSchemaTableNameColumnsColumnName(
    //   props.tableName,
    //   form.column_name
    // );
    // 
    // dialogVisible.value = false;
    // emit('deleted', form.id);
    // ElMessage.success('Column deleted successfully');

  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('Error deleting column:', error);
      ElMessage.error('Failed to delete column');
    }
  } finally {
    deleting.value = false;
  }
};

defineExpose({
  open
});
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.form-help-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
</style>
