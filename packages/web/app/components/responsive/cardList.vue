<template>
  <div class="card-list-container">
    <!-- Loading State -->
    
    <div class="header">
        <slot name="toolbar_buttons" />
      </div>
    <!-- Card List -->
    <div class="card-list">
      <template v-if="cardLoading" >
        <el-card v-for="i in 10" :key="i" class="data-card">
          <el-skeleton :rows="4" animated />
        </el-card>
      </template>
      <template v-else-if="cardData.length > 0">
        <el-card
          v-for="(row, index) in cardData"
          :key="getRowKey(row, index)"
          class="data-card"
          :class="{ 
            'expanded': expandedCards.has(index),
            [`layout-${cardTemplateSettings?.layout || 'default'}`]: true
          }"
          @click="handleCardClick(row, $event)"
        >
          <!-- Card Header -->
          <template #header>
            <div class="card-header">
              <div class="card-title">
                {{ getCardTitle(row) }}
              </div>
              <div class="card-actions">
                <el-dropdown 
                  trigger="click" 
                  @command="(command: any) => handleAction(command, row, $event as Event)"
                >
                  <el-button 
                    type="text" 
                    size="small"
                    @click.stop
                  >
                    <el-icon><MoreFilled /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="actionGroup in visibleActions"
                        :key="actionGroup.code"
                        :command="actionGroup"
                        :disabled="actionGroup.disabled"
                      >
                        {{ actionGroup.label }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </template>

          <!-- Card Content -->
          <div class="card-content">
            <!-- Primary Fields (always visible) -->
            <div class="primary-fields">
              <div
                v-for="column in primaryColumns"
                :key="column.field"
                class="field-item"
              >
                <span class="field-label">{{ $t(column.title) }}:</span>
                <span class="field-value">
                  <!-- Use slot if available, otherwise use component -->
                  <template v-if="column.slots?.default">
                    
                    <slot :name="column.slots.default" :row="row" :column="column" />
                  </template>
                  <span v-else>
                    {{ getFieldValue(row, column) }}
                  </span>
                  
                </span>
              </div>
            </div>

            <!-- Expandable Details -->
            <div v-if="hasSecondaryFields" class="expandable-section">
              <el-button
                type="text"
                size="small"
                @click.stop="toggleExpanded(index)"
              >
                {{ expandedCards.has(index) ? 'Show Less' : 'Show More' }}
                <el-icon>
                  <ArrowDown v-if="!expandedCards.has(index)" />
                  <ArrowUp v-else />
                </el-icon>
              </el-button>

              <div v-show="expandedCards.has(index)" class="secondary-fields">
                <div
                  v-for="column in secondaryColumns"
                  :key="column.field"
                  class="field-item"
                >
                  <span class="field-label">{{ $t(column.title) }}:</span>
                  <span class="field-value">
                    <template v-if="column.slots?.default">
                      <slot :name="column.slots.default" :row="row" :column="column" />
                    </template>
                    <span v-else>
                      {{ getFieldValue(row, column) }}
                    </span>
                    <!-- <component 
                      :is="getFieldComponent(column)"
                      :column="column"
                      :row="row"
                      :value="getFieldValue(row, column)"
                    /> -->
                  </span>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </template>
      <template v-else>
        <div class="empty-state">
          <el-empty description="No data available" />
        </div>
      </template>
    </div>
    <!-- Empty State -->
    

    <!-- Pagination -->
    <div v-if="total > 0" class="pagination-container">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { MoreFilled, ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import type { VxeGridPropTypes } from 'vxe-table'
import type { TableMenuActions, PermissionMethodParams } from '../../composables/useVxeTable'
import type { CardTemplateSettings } from '../../composables/useCardTemplate'

const props = defineProps<{
  cardTemplateSettings?: CardTemplateSettings
  tableConfig: any // Contains columns, actions, permissionMethod, etc.
}>()
const { tableConfig } = toRefs(props)
const emits = defineEmits<{
  'action-click': [params: { action: any; row: any; event: any }]
  'card-click': [params: { row: any; event: any }]
}>()

// Data state
const cardData = ref<any[]>([])
const cardLoading = ref(false)
const currentPage = ref(1)
const total = ref(0)

// Load data function based on useVxeTable pattern
async function loadCardData(pageNum = 1, append = false) {
  if (!tableConfig?.value?.proxyConfig?.enabled) return
  
  try {
    cardLoading.value = true
    
    // Get the API function from proxyConfig.ajax.query
    const apiFunction = tableConfig.value.proxyConfig.ajax.query
    
    if (tableConfig.value.virtualScroll) {
      // For virtual scroll, use the same API call as useVxeTable
      const result = await apiFunction({ page: { currentPage: pageNum, pageSize: pageSize.value } })
      const newData = Array.isArray(result.data) ? result.data : result.data.entryList
      
      if (append) {
        cardData.value.push(...newData)
      } else {
        cardData.value = newData
      }
      
      total.value = newData.length * pageSize.value // Estimate total for virtual scroll
    } else {
      // For pagination, use the same pattern as useVxeTable
      const pageParams = {
        page:{
          pageSize: pageSize.value,
          currentPage: pageNum
        }
        
      }
      
      const {result, page} = await apiFunction(pageParams)
      const newData = result
      
      if (append) {
        cardData.value.push(...newData)
      } else {
        cardData.value = newData
      }
      
      total.value = page.total
    }
    
    currentPage.value = pageNum
  } catch (error) {
    console.error('Error loading card data:', error)
  } finally {
    cardLoading.value = false
  }
}

// Expanded cards state
const expandedCards = ref(new Set<number>())

// Card template settings
const cardTemplateSettings = computed(() => props.cardTemplateSettings)

// Computed properties for card layout
const primaryColumns = computed(() => {
  const primaryCount = props.cardTemplateSettings?.primaryColumns || 3
  return props.tableConfig?.columns?.slice(0, primaryCount).filter((col: any) => col.field && col.title) || []
})

const secondaryColumns = computed(() => {
  const primaryCount = props.cardTemplateSettings?.primaryColumns || 3
  return props.tableConfig?.columns?.slice(primaryCount).filter((col: any) => col.field && col.title) || []
})

const hasSecondaryFields = computed(() => secondaryColumns.value.length > 0)

// Pagination logic
const isVirtualScroll = computed(() => props.tableConfig?.virtualScroll || false)
const pageSize = computed(() => {
  if (isVirtualScroll.value) {
    return props.cardTemplateSettings?.pageSize || 20
  }
  return props.tableConfig?.pagerConfig?.pageSize || 20
})

const hasMoreData = computed(() => {
  if (isVirtualScroll.value) {
    return currentPage.value * pageSize.value < total.value
  }
  // For pagination, check if there are more pages
  return currentPage.value * pageSize.value < total.value
})

// Filter visible actions based on permissions
const visibleActions = computed(() => {
  if (!tableConfig.value.bodyActions || !tableConfig.value.permissionMethod) return []
  
  const flattenedActions = tableConfig.value.bodyActions.flat()
  const visibleActions: any[] = []
  
  for (const action of flattenedActions) {
    const { visible, disabled } = tableConfig.value.permissionMethod({
      row: null,
      code: action.code
    })
    
    if (visible) {
      visibleActions.push({
        ...action,
        disabled
      })
    }
  }
  console.log("visibleActions", visibleActions)
  return visibleActions
})

// Methods
function getRowKey(row: any, index: number) {
  return row.id || row.key || index
}

function getCardTitle(row: any) {
  // Use the first column as the card title
  const firstColumn = props.tableConfig?.columns?.[0]
  if (firstColumn && firstColumn.field) {
    return getFieldValue(row, firstColumn)
  }
  return `Item ${getRowKey(row, 0)}`
}

function getFieldValue(row: any, column: any) {
  if (!column.field) return ''
  
  const value = row[column.field]
  
  // Use formatter if available
  if (column.formatter && typeof column.formatter === 'function') {
    return column.formatter({ cellValue: value, row })
  }
  console.log("value", value, row, column.field)
  return value
}

function getFieldComponent(column: any) {
  // Check if column has a slot
  if (column.slots?.default) {
    return 'SlotField'
  }
  
  // Return appropriate component based on column type
  if (column.type === 'date' || column.field?.includes('Date')) {
    return 'DateField'
  }
  if (column.type === 'status') {
    return 'StatusField'
  }
  return 'TextField'
}

function toggleExpanded(index: number) {
  if (expandedCards.value.has(index)) {
    expandedCards.value.delete(index)
  } else {
    expandedCards.value.add(index)
  }
}

function handleCardClick(row: any, event: Event) {
  emits('card-click', { row, event })
}

async function handleAction(action: any, row: any, event: Event) {
  if (action.action && typeof action.action === 'function') {
    action.action({ row, event })
  }
  emits('action-click', { action, row, event })
}

// Pagination handlers
function handlePageChange(page: number) {
  loadCardData(page, false)
}

function handleSizeChange(size: number) {
  // Update page size and reload data
  if (props.cardTemplateSettings) {
    props.cardTemplateSettings.pageSize = size
  }
  loadCardData(1, false)
}

// Load initial data when component mounts
onMounted(() => {
  loadCardData(0, false)
})

// Watch for tableConfig changes to reload data
watch(tableConfig, () => {
  if (tableConfig.value?.proxyConfig?.enabled) {
    loadCardData(1, false)
  }
}, { immediate: true })

// Field Components
const TextField = defineComponent({
  props: ['value'],
  template: '<span>{{ value }}</span>'
})

const DateField = defineComponent({
  props: ['value'],
  setup(props) {
    const formattedDate = computed(() => {
      if (!props.value) return ''
      return new Date(props.value).toLocaleDateString()
    })
    return { formattedDate }
  },
  template: '<span>{{ formattedDate }}</span>'
})

const StatusField = defineComponent({
  props: ['value'],
  template: '<el-tag size="small">{{ value }}</el-tag>'
})

const SlotField = defineComponent({
  props: ['column', 'row', 'value'],
  setup(props) {
    // This component will be replaced by the actual slot content
    const slotName = props.column.slots?.default || 'default'
    return () => h('div', { class: 'slot-field' }, [
      h('span', { class: 'slot-placeholder' }, `[${slotName}]`)
    ])
  }
})
</script>

<style lang="scss" scoped>
.card-list-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  justify-content: flex-start;
  align-items: flex-start;
  overflow-y: hidden;
}

.loading-container {
  padding: 20px;
}

.card-list {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--app-space-s);
  padding: var(--app-space-s);
  flex: 1;
  overflow-y: auto;
  width: 100%;
  
}

.data-card {
  cursor: pointer;
  transition: all 0.3s ease;
  height: max-content;
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  &.expanded {
    .card-content {
      max-height: none;
    }
  }
  
  // Layout variations
  &.layout-compact {
    .card-content {
      max-height: 150px;
    }
    
    .field-item {
      margin-bottom: 4px;
    }
    
    .field-label {
      min-width: 60px;
      font-size: 12px;
    }
  }
  
  &.layout-detailed {
    .card-content {
      max-height: 300px;
    }
    
    .field-item {
      margin-bottom: 12px;
    }
    
    .field-label {
      min-width: 100px;
      font-size: 14px;
    }
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.card-title {
  font-weight: 600;
  font-size: 16px;
  color: var(--el-text-color-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-actions {
  flex-shrink: 0;
}

.card-content {
  max-height: 200px;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.primary-fields {
  margin-bottom: 12px;
}

.field-item {
  display: flex;
  margin-bottom: 8px;
  align-items: flex-start;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.field-label {
  font-weight: 500;
  color: var(--el-text-color-regular);
  min-width: 80px;
  flex-shrink: 0;
  margin-right: 8px;
}

.field-value {
  flex: 1;
  color: var(--el-text-color-primary);
  word-break: break-word;
}

.expandable-section {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 12px;
}

.secondary-fields {
  margin-top: 12px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.pagination-container {
  display: flex;
  justify-content: center;
  padding: 20px;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-lighter);
}
</style> 
