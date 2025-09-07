<template>
  <el-dialog
    v-model="dialogVisible"
    title="Edit Permission"
    width="500px"
    :before-close="handleClose"
  >
    <div class="edit-permission-content">
      <el-alert
        title="Permission Editing Coming Soon"
        type="info"
        description="Permission editing interface will be implemented here."
        show-icon
        :closable="false"
      />
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">Cancel</el-button>
        <el-button type="primary" disabled>
          Update Permission (Coming Soon)
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  tableName: string;
  permission: any;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  updated: [];
}>();

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
.edit-permission-content {
  padding: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
