<template>
  <el-dialog
    v-model="dialogVisible"
    title="Create New Column"
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
        />
      </el-form-item>

      <el-form-item label="Display Name" prop="display_name">
        <el-input
          v-model="form.display_name"
          placeholder="Enter display name (e.g., User Email)"
        />
      </el-form-item>

      <el-form-item label="Data Type" prop="data_type">
        <el-select v-model="form.data_type" placeholder="Select data type">
          <el-option label="Text" value="text" />
          <el-option label="Number" value="number" />
          <el-option label="Integer" value="integer" />
          <el-option label="Boolean" value="boolean" />
          <el-option label="Date" value="date" />
          <el-option label="DateTime" value="datetime" />
          <el-option label="JSON" value="json" />
        </el-select>
      </el-form-item>

      <el-form-item label="Column Type" prop="column_type">
        <el-select v-model="form.column_type" placeholder="Select column type">
          <el-option label="Standard" value="standard" />
          <el-option label="Computed" value="computed" />
          <el-option label="Relation" value="relation" />
        </el-select>
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
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">Cancel</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="loading">
          Create Column
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { apiClient } from 'api-client';

interface Props {
  tableName: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  created: [columnId: string];
  cancelled: [];
}>();

const dialogVisible = ref(false);
const loading = ref(false);
const formRef = ref<FormInstance>();

const form = reactive<any>({
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
  column_name: [
    { required: true, message: 'Column name is required', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_]*$/, message: 'Column name must start with a letter and contain only lowercase letters, numbers, and underscores', trigger: 'blur' }
  ],
  display_name: [
    { required: true, message: 'Display name is required', trigger: 'blur' }
  ],
  data_type: [
    { required: true, message: 'Data type is required', trigger: 'change' }
  ],
  column_type: [
    { required: true, message: 'Column type is required', trigger: 'change' }
  ]
};

const open = () => {
  dialogVisible.value = true;
  resetForm();
};

const resetForm = () => {
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
  emit('cancelled');
};

const handleSubmit = async () => {
  if (!formRef.value) return;

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

    // Call API to create column
    // Note: You'll need to implement this API endpoint
    const response = await apiClient.companies.postDataSchemaTableNameColumns(
      props.tableName,
      columnData
    );

    if (response.data) {
      dialogVisible.value = false;
      emit('created', response.data.id);
      ElMessage.success('Column created successfully');
    } else {
      ElMessage.error('Failed to create column');
    }
  } catch (error) {
    console.error('Error creating column:', error);
    ElMessage.error('Failed to create column');
  } finally {
    loading.value = false;
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
</style>
