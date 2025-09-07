<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isEditing ? 'Edit Form' : 'Create Form'"
    width="800px"
    :before-close="handleClose"
  >
    <div class="form-builder-content">
      <!-- Form Basic Info -->
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="120px"
      >
        <el-form-item label="Form Name" prop="name">
          <el-input
            v-model="formData.name"
            placeholder="Enter form name"
          />
        </el-form-item>

        <el-form-item label="Description" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="Enter form description"
          />
        </el-form-item>

        <el-form-item label="Settings">
          <div class="form-settings">
            <el-checkbox v-model="formData.is_active">
              Active
            </el-checkbox>
            <el-checkbox v-model="formData.is_default">
              Set as default form
            </el-checkbox>
          </div>
        </el-form-item>
      </el-form>

      <!-- Form Builder Placeholder -->
      <div class="form-builder-placeholder">
        <el-alert
          title="Form Builder Coming Soon"
          type="info"
          description="Visual form builder with drag-and-drop field configuration will be available in the next release."
          show-icon
          :closable="false"
        />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">Cancel</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="loading">
          {{ isEditing ? 'Update' : 'Create' }} Form
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';

interface Props {
  tableName: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  created: [];
  updated: [];
}>();

const dialogVisible = ref(false);
const loading = ref(false);
const formRef = ref<FormInstance>();
const editingForm = ref(null);

const formData = reactive({
  name: '',
  description: '',
  is_active: true,
  is_default: false
});

const rules: FormRules = {
  name: [
    { required: true, message: 'Form name is required', trigger: 'blur' }
  ]
};

const isEditing = computed(() => !!editingForm.value);

const open = (form?: any) => {
  if (form) {
    editingForm.value = form;
    Object.assign(formData, form);
  } else {
    editingForm.value = null;
    resetForm();
  }
  dialogVisible.value = true;
};

const resetForm = () => {
  formData.name = '';
  formData.description = '';
  formData.is_active = true;
  formData.is_default = false;
  formRef.value?.clearValidate();
};

const handleClose = () => {
  dialogVisible.value = false;
  resetForm();
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  try {
    const valid = await formRef.value.validate();
    if (!valid) return;

    loading.value = true;

    // TODO: Implement actual API calls
    if (isEditing.value) {
      // Update form
      ElMessage.success('Form updated successfully');
      emit('updated');
    } else {
      // Create form
      ElMessage.success('Form created successfully');
      emit('created');
    }

    dialogVisible.value = false;
  } catch (error) {
    console.error('Error saving form:', error);
    ElMessage.error('Failed to save form');
  } finally {
    loading.value = false;
  }
};

defineExpose({
  open
});
</script>

<style scoped>
.form-builder-content {
  max-height: 600px;
  overflow-y: auto;
}

.form-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-builder-placeholder {
  margin-top: 24px;
  padding: 20px;
  border: 2px dashed var(--el-border-color);
  border-radius: 8px;
  text-align: center;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
