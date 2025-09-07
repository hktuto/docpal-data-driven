<!--
ResponsiveFilter Component Documentation

A responsive filter component that automatically adjusts its layout based on available space.
It supports multiple filter types including text input and select dropdowns.

Props:
- inputKey: string (optional) - Key for the text input filter
- inputPlaceHolder: string (optional, default: 'tip.filterByName') - Placeholder text for the input field

Events:
- form-change: Emitted when any filter value changes
  - Parameters: (formData: object, fieldData: { fieldName: string, value: any })
- clear-filter: Emitted when filters are cleared

Methods (via ref):
- init(list: ResSelectData[], initParams?: object): void
  - Initializes the filter with select options and initial values
  - list: Array of filter configurations
  - initParams: Initial values for filters
- setValue(key: string, value: string): void
  - Sets a specific filter value
- handleFilter(): void
  - Clears all filter values

Types:
interface ResSelectData {
  label: string        // Display label for the filter
  key: string         // Unique identifier for the filter
  options: {          // Available options for select
    label: string
    value: any
  }[]
  value?: string[]    // Selected values
  isMultiple?: boolean // Whether multiple selections are allowed
  belong?: string     // Group this filter belongs to (optional)
}

Example Usage:
```vue
<script setup>
const filterRef = ref()
function initFilter(){
  filterRef.value.init({
    list:[
      {
        label: "Status",
        key: "status",
        isMultiple: false,
        options: [
          {
            label: "Active",
            value: 1
          },
          {
            label: "Inactive",
            value: 3
          }
        ]
      }
    ]
  })
}
initFilter() // call on Mounted or before use
</script>
<template>
  <ResponsiveFilter
    ref="filterRef"
    inputKey="search"
    inputPlaceHolder="Search..."
    @form-change="handleFilterChange"
    @clear-filter="handleClearFilter"
  />
</template>

<script setup>
const filterRef = ref()

// Initialize filters
filterRef.value.init([
  {
    label: 'Status',
    key: 'status',
    options: [
      { label: 'Active', value: 1 },
      { label: 'Inactive', value: 0 }
    ],
    isMultiple: true
  },
  {
    label: 'Category',
    key: 'category',
    options: [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' }
    ]
  }
], {
  status: [1],
  search: 'initial search'
})

// Handle filter changes
function handleFilterChange(formData, fieldData) {
  console.log('Filter changed:', formData)
  console.log('Changed field:', fieldData)
}

// Handle filter clear
function handleClearFilter() {
  console.log('Filters cleared')
}
</script>
```

Features:
1. Responsive Layout:
   - Automatically adjusts filter positions based on available space
   - Moves overflow filters to a "More" dropdown
   - Maintains filter state and visibility

2. Filter Types:
   - Text input (optional)
   - Single select
   - Multiple select
   - Grouped filters (using belong property)

3. State Management:
   - Tracks selected filters
   - Shows count of selected filters
   - Provides clear filter functionality

4. Accessibility:
   - Keyboard navigation support
   - Clear visual feedback
   - Proper ARIA attributes

5. Internationalization:
   - Supports i18n for labels and placeholders
   - Uses translation keys for text

Note: The component requires Element Plus and VueUse for full functionality.
-->

<template>
  <div ref="responsiveRef" class="responsive-container" v-element-size="onResize">
    <div class="flex-x-start">
      <el-input v-if="inputKey" v-model="state.inputValue" :placeholder="$t(inputPlaceHolder)" clearable @input="handleChange"></el-input>
      <div
        v-for="(item, index) in state.list"
        :key="item.label"
        :ref="
          (el) => {
            boxRefs[item.label] = el
          }
        "
      >
        <ResponsiveSelect :selectData="item" :index="index" @change="handleChange" />
      </div>
      <el-popover v-if="state.moreList.length > 0" placement="bottom" :width="200" popper-class="auto-popper" trigger="click">
        <template #default>
          <div v-for="item in state.moreList" :key="item.key">
            <ResponsiveSelect :selectData="item" @change="handleChange" />
          </div>
        </template>
        <template #reference>
          <el-button text
            >{{ $t('button.more') }}
            <el-tag v-if="state.moreSelected > 0" class="el-icon--right" effect="dark" round size="small">{{
              state.moreSelected > 9 ? '9+' : state.moreSelected
            }}</el-tag>
            <el-icon class="el-icon--right"><ArrowDownBold /></el-icon>
          </el-button>
        </template>
      </el-popover>
      <el-button v-show="state.selected > 0" style="margin: unset" text @click="handleFilter">{{ $t('button.clearFilter') }}</el-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ArrowDownBold } from '@element-plus/icons-vue'
import { vElementSize } from '@vueuse/components'
import { deepCopy } from '#imports'

const props = withDefaults(
  defineProps<{
    inputKey?: string
    inputPlaceHolder?: string
  }>(),
  {
    inputPlaceHolder: 'tip.filterByName'
  }
)
const emits = defineEmits(['form-change', 'clear-filter'])
export type option = {
  label: string
  value: any
}
export type ResSelectData = {
  label: string
  key: string
  options: option[]
  value?: string[]
  isMultiple?: boolean
}
type state = {
  list: ResSelectData[]
  moreList: ResSelectData[]
  padding: number
  moreSelected: number
  inputValue?: string
  selected?: number
  interval?: ReturnType<typeof setInterval>
}
const boxRefs = ref({})

const state = reactive<state>({
  list: [],
  moreList: [],
  selected: 0,
  moreSelected: 0,
  padding: 15,
  inputValue: '',
  interval: null
})
// #region module: onResize
function onResize({ width, height }: { width: number; height: number }) {
  let defaultWidth = state.moreList.length > 0 ? 83 : 0
  const clearFilterStr = $i18n.t('clearFilter')
  defaultWidth += clearFilterStr.getWidth() + state.padding * 2
  state.moreList = []

  Object.keys(boxRefs.value).reduce((prev, key) => {
    if (!prev) prev = defaultWidth
    const _boxRef = boxRefs.value[key]
    if (!_boxRef) return
    const index = state.list.findIndex((m) => m.label === key)
    if (index === -1) return
    const item = state.list[index]
    const boxWidth = getWidth(item)
    prev += boxWidth

    if (prev > width) {
      _boxRef.style.display = 'none'
      state.moreList.push(item)
    } else {
      _boxRef.style.display = 'unset'
      const mIndex = state.moreList.findIndex((m) => m.label === key)
      if (mIndex !== -1) state.moreList.splice(mIndex, 1)
    }
    return prev
  }, defaultWidth)
}
String.prototype.getWidth = function (fontSize: number = 16) {
  var span = document.getElementById('_getwidthID')
  if (span == null) {
    span = document.createElement('span')
    span.id = '_getwidthID'
    span.style.position = 'absolute'
    span.style.top = '0'
    span.style.visibility = 'hidden'
    span.style.whiteSpace = 'nowrap'
  } else {
    span.style.display = 'inline-block'
  }
  document.body.appendChild(span)
  span.innerText = this
  span.style.fontSize = fontSize + 'px'
  const fontWidth = span.offsetWidth
  return fontWidth
}
function getWidth(selectData: ResSelectData) {
  const labelStr = $i18n.t(selectData.label)
  let width = labelStr.getWidth()
  if (selectData.value && selectData.value.length > 0) {
    const lStr = selectData.value.length > 0 ? (selectData.value.length > 9 ? '9+' : '9') : '9'
    width += lStr.getWidth()
    width += 20 // padding+margin
  }

  width += 20 // 箭头+margin
  width += state.padding * 2 // padding
  return width
}
// #endregion
const responsiveRef = ref()

function setValue(key: string, value: string) {
  if (key === props.inputKey) {
    state.inputValue = value
    return
  }
  state.list.forEach((item) => {
    if (item.key === key) {
      item.value = [value]
    }
  })
}
function init(list: ResSelectData[], initParams: any = {}) {
  state.list = list.reduce((prev, item) => {
    if (item.isMultiple !== false) item.isMultiple = true
    if (!item.value) item.value = []
    if (!item.options) item.options = []
    item.options = item.options.filter((o) => !!o.label && (!!o.value || o.value === false))
    if (!!initParams[item.key]) item.value = typeof initParams[item.key] === 'string' ? initParams[item.key].join(',') : initParams[item.key]
    prev.push(item)
    return prev
  }, [])
  nextTick(() => {
    if (!responsiveRef.value && !responsiveRef.value.offsetWidth) return
    onResize({ width: responsiveRef.value.offsetWidth, height: 0 })
  })
}
function handleChange(filedData: { fieldName: string; value: any; [key: string]: any }) {
  if (state.interval) clearInterval(state.interval)
  state.interval = setInterval(() => {
    state.moreSelected = 0
    state.selected = 0
    const formModel = state.list.reduce((prev, item) => {
      if (item.belong) {
        if (!prev[item.belong]) prev[item.belong] = {}
        prev[item.belong][item.key] = item.isMultiple ? item.value : item.value.join(',')
        state.selected++
      } else if (item.value && item.value.length > 0) {
        prev[item.key] = item.isMultiple ? item.value : item.value.join(',')
        state.selected++
      }
      if (state.moreList.find((m) => m.key === item.key)) {
        state.moreSelected += item.value.length
      }
      return prev
    }, {})
    if (props.inputKey) formModel[props.inputKey] = state.inputValue

    emits('form-change', deepCopy(formModel), filedData)
    clearInterval(state.interval)
    if (!responsiveRef.value) return
    onResize({ width: responsiveRef.value.offsetWidth, height: 0 })
  }, 200)
}
function handleFilter() {
  state.inputValue = ''
  state.list.forEach((item) => {
    item.value = []
  })
  state.selected = 0
  state.moreSelected = 0
  emits('clear-filter')
  emits('form-change', {}, null)
}
defineExpose({ init, setValue, handleFilter })
</script>
<style lang="scss" scoped>
.responsive-container {
  overflow: hidden;
  width: 100%;
  display: flex;
  align-items: flex-end;
  & > div {
    width: 100%;
  }
}
.flex-x-start {
  display: flex;
  justify-content: start;
}
</style>
