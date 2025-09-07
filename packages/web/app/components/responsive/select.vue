<template>
  <div>
    <el-button ref="buttonRef" text :index="index" v-click-outside="onClickOutside">
      {{ $t(selectData.label) }}
      <el-tag v-if="selectData.value && selectData.value.length > 0" class="el-icon--right" effect="dark" round size="small">{{
        selectData.value.length > 9 ? '9+' : selectData.value.length
      }}</el-tag>
      <el-icon class="el-icon--right"><ArrowDownBold /></el-icon>
    </el-button>
    <!-- {{ selectData }} -->
    <el-popover
      ref="popoverRef"
      :virtual-ref="buttonRef"
      placement="bottom"
      :width="300"
      trigger="click"
      popper-class="auto-popper"
      virtual-triggering
      :popper-append-to-body="false"
    >
      <template #default>
        <el-checkbox-group
          v-if="selectData.options && selectData.options.length > 0"
          :max="selectData.isMultiple ? 100 : 2"
          v-model="selectData.value"
          @change="handleChange(selectData)"
        >
          <el-checkbox
            v-for="item in selectData.options"
            :key="item.value"
            :data-testid="`filter-${item.value}`"
            :value="item.value"
          >
            <template v-if="selectData.type === 'date'">
              {{ formatDate(item.label) }}
            </template>
            <template v-else> {{ $t(String(item.label)) }} </template>
          </el-checkbox>
        </el-checkbox-group>
        <div v-else>
          {{ $t('noData') }}
        </div>
      </template>
    </el-popover>
  </div>
</template>

<script lang="ts" setup>
import { deepCopy } from '#imports'
import type ResSelectData from './filter.vue'
import { ArrowDownBold } from '@element-plus/icons-vue'
import { ClickOutside as vClickOutside } from 'element-plus'
const props = defineProps<{
  selectData: typeof ResSelectData
  index: number
}>()
const emits = defineEmits(['change'])
const buttonRef = ref()
const popoverRef = ref()
const onClickOutside = () => {
  //   unref(popoverRef).popperRef?.delayHide?.()
}
function handleChange(data: typeof ResSelectData) {
  if (!data.isMultiple && data.value.length > 1) {
    data.value = [data.value.pop()]
  }
  emits('change', {
    fieldName: data.key,
    value: deepCopy(data.value)
  })
}
</script>
<style lang="scss" scoped>
.el-checkbox {
  width: calc(100% - 30px);
  white-space: pre-wrap;
  overflow: hidden;
  :deep .el-checkbox__label {
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    word-break: break-all;
  }
}
</style>
<style>
.auto-popper {
  max-height: 80vh;
  overflow-y: auto;
}
</style>
