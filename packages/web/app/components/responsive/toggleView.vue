<template>
  <div class="view-toggle-header">
    <el-dropdown @command="handleCommand" trigger="click">
      <el-button size="small" type="default">
        <el-icon><component :is="getCurrentIcon()" /></el-icon>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="auto" >
            <el-icon><Monitor /></el-icon>
            Auto
          </el-dropdown-item>
          <el-dropdown-item command="table" :disabled="!isCardView">
            <el-icon><Grid /></el-icon>
            Table
          </el-dropdown-item>
          <el-dropdown-item command="card" :disabled="isCardView">
            <el-icon><View /></el-icon>
            Cards
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script lang="ts" setup>
import { Monitor, Grid, View, Setting, ArrowDown } from '@element-plus/icons-vue'

const modelValue = defineModel<string>('modelValue', { required: true })
const props = defineProps<{
  isCardView: boolean
}>()
// Handle dropdown command
function handleCommand(command: string) {
  modelValue.value = command
}

// Get current label for the button
function getCurrentLabel() {
  switch (modelValue.value) {
    case 'auto':
      return 'Auto'
    case 'table':
      return 'Table'
    case 'card':
      return 'Cards'
    default:
      return 'Auto'
  }
}

// Get current icon for the button - shows what you can switch TO
function getCurrentIcon() {
  return props.isCardView ? Grid : View
}
</script>

<style lang="scss" scoped>

.view-toggle-header {
  display: flex;
  justify-content: flex-end;
  padding: 4px 8px;
  flex-shrink: 0;
}

.view-toggle-header .el-button {
  display: flex;
  align-items: center;
  gap: 4px;
  
  .el-icon {
    margin-right: 2px;
  }
}

.view-toggle-header .el-dropdown-menu {
  .el-dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .el-icon {
      margin-right: 4px;
    }
  }
}


</style>
