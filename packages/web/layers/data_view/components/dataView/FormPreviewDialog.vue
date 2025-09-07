<template>
  <el-dialog
    v-model="dialogVisible"
    :title="`Preview: ${form?.name || 'Form'}`"
    width="600px"
    :before-close="handleClose"
  >
    <div class="form-preview-content">
      <div v-if="form" class="preview-container">
        <!-- Form Info -->
        <div class="form-info">
          <h4>{{ form.name }}</h4>
          <p v-if="form.description">{{ form.description }}</p>
        </div>

        <!-- Form Preview Placeholder -->
        <div class="form-preview-placeholder">
          <el-alert
            title="Form Preview Coming Soon"
            type="info"
            description="Interactive form preview will be available when the form builder is implemented."
            show-icon
            :closable="false"
          />
          
          <!-- Mock Form Fields -->
          <div class="mock-form">
            <el-form label-width="120px">
              <el-form-item label="Sample Field 1">
                <el-input placeholder="Text input field" disabled />
              </el-form-item>
              <el-form-item label="Sample Field 2">
                <el-select placeholder="Select field" disabled style="width: 100%">
                  <el-option label="Option 1" value="1" />
                  <el-option label="Option 2" value="2" />
                </el-select>
              </el-form-item>
              <el-form-item label="Sample Field 3">
                <el-input type="textarea" placeholder="Textarea field" disabled />
              </el-form-item>
            </el-form>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">Close</el-button>
        <el-button type="primary" disabled>
          Test Form (Coming Soon)
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  form: any;
}

const props = defineProps<Props>();

const dialogVisible = ref(false);

const open = () => {
  dialogVisible.value = true;
};

const handleClose = () => {
  dialogVisible.value = false;
};

defineExpose({
  open
});
</script>

<style scoped>
.form-preview-content {
  max-height: 500px;
  overflow-y: auto;
}

.form-info {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.form-info h4 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.form-info p {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.form-preview-placeholder {
  text-align: center;
}

.mock-form {
  margin-top: 24px;
  padding: 20px;
  background: var(--el-bg-color-page);
  border-radius: 8px;
  text-align: left;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
