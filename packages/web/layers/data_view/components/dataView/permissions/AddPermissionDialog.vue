<template>
  <el-dialog
    v-model="dialogVisible"
    title="Add Permission"
    width="500px"
    :before-close="handleClose"
  >
    <div class="add-permission-content">
      <el-alert
        title="Permission Management Coming Soon"
        type="info"
        description="Permission assignment interface will be implemented here."
        show-icon
        :closable="false"
      />
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">Cancel</el-button>
        <el-button type="primary" disabled>
          Add Permission (Coming Soon)
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  tableName: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  created: [];
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
.add-permission-content {
  padding: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
