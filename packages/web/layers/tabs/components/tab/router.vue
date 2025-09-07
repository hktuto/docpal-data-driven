<script lang="ts" setup>
import type { TabItem, RouterParams } from '#imports'
import { ElMessage, ElNotification } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { useMagicKeys } from '@vueuse/core'

import { MenuRouterKey, TabManagerKey, panelRouteUpdate, useTabsManager, useCurrentTargetPanel } from '#imports'

const errorBoundary = useTemplateRef<any>("errorBoundary")
const { current } = useMagicKeys()
const { allComponents, layout } = useTabsManager()

const hightLightPanel = useCurrentTargetPanel()

const historyLimit = 10

const tab = defineModel<any>('tab', { required: true })
const tabManager = inject(TabManagerKey)
if (!tabManager) {
  throw createError('no ' + TabManagerKey.toString + 'provided')
}
const { t } = useI18n()
const history = ref<RouterParams[]>([])
const forwardHistory = ref<RouterParams[]>([])




const refeshActions = ref<Function[]>([])

async function handleRefresh() {
  try {
    await Promise.all(refeshActions.value.map(item => item()))
  } catch (err) {
    console.log(err)
  }
}

function navigateTo(param: RouterParams, openInNewTab?: boolean | undefined, ignoreExist?: boolean | undefined) {
  if (current.has('meta') || current.has('control') || openInNewTab) {
    tabManager?.openInNewTab(param)
    return
  }
  if (!ignoreExist) {
    const existingTab = allComponents.value.find(item => item.name === param.name)
    if (existingTab) {
      tabManager?.openTab(param)
      return
    }
  }
  refeshActions.value = []
  // forwardHistory.value = [];
  const lastId = tab.value.id
  history.value.push({
    ...tab.value
  })
  tab.value = {
    ...param,
    parent: tab.value.parent,
    id: tab.value.id,
    initized: true
  }
  if(errorBoundary.value) {
    errorBoundary.value?.clearError()
  }
  panelRouteUpdate(tab.value.parent, lastId, tab.value)
}

function getHistory() {
  return history.value
}

function addToHistory(param: RouterParams) {
  history.value.push(param)
  if (history.value.length > historyLimit) {
    history.value.shift()
  }
}

function back(fallback?: any) {
  refeshActions.value = []
  if (history.value.length === 0) {
    if (fallback) {
      console.log('fallback', fallback)
      navigateTo(fallback)
    }
    return
  }
  const lastItem = history.value.pop()
  if (lastItem) {
    const lastId = tab.value.id

    forwardHistory.value.push({
      name: tab.value.name,
      id: tab.value.id,
      icon: tab.value.icon,
      label: tab.value.label,
      component: tab.value.component,
      props: tab.value.props
    })
    if (forwardHistory.value.length > historyLimit) {
      forwardHistory.value.shift()
    }
    if(errorBoundary.value) {
      errorBoundary.value?.clearError()
    }
    tab.value = {
      ...lastItem,
      parent: tab.value.parent,
      id: tab.value.id,
      initized: true
    }
    
    panelRouteUpdate(tab.value.parent, lastId, tab.value)
  }
}

function forward() {
  if (forwardHistory.value.length === 0) return
  const lastItem = forwardHistory.value.pop()

  if (lastItem) {
    refeshActions.value = []
    const lastId = tab.value.id

    history.value.push({
      ...tab.value
    })
    if (history.value.length > historyLimit) {
      history.value.shift()
    }
    tab.value = {
      ...lastItem,
      parent: tab.value.parent,
      id: tab.value.id,
      initized: true
    }
    if(errorBoundary.value) {
      errorBoundary.value?.clearError()
    }
    panelRouteUpdate(tab.value.parent, lastId, tab.value)
  }
}

function updateProps(newProps: any) {
  tab.value.props = { ...tab.value.props, ...newProps }
  panelRouteUpdate(tab.value.parent, tab.value.id, tab.value)
  
}

function updateTabName(newName: string) {
  tab.value.label = newName
  // add tab name to allComponents
  allComponents.value.forEach(item => {
    if (item.id === tab.value.id) {
      item.label = newName
    }
  })

}


const routerContainer = computed(() => {
  return document.getElementById(tab.value.parent + '_' + tab.value.id)
})

function createMessage(type: string, ...args: any[]) {
  if (args.length === 1 && typeof args[0] === 'string') {
    ElMessage({
      type,
      message: args[0],
      appendTo: '#' + tab.value.parent + '_' + tab.value.id
    } as any)
  } else {
    ElMessage({
      type,
      appendTo: routerContainer.value,
      ...args
    } as any)
  }
}

function createNotification(type: string, ...args: any[]) {
  if (args.length === 1 && typeof args[0] === 'string') {
    ElNotification({
      type,
      message: args[0]
    } as any, {
      appendTo: routerContainer.value
    } as any)
  } else {
    ElNotification({
      type,
      ...args
    } as any, {
      appendTo: routerContainer.value
    } as any)
  }
}


watch(() => [layout, hightLightPanel], () => {
  const currentPanel = layout.value.find(lay => lay.id === hightLightPanel.value) as any

  if (!currentPanel) return
  const showingTab = currentPanel.tabs?.[currentPanel.showingTabIndex]
  if (
    currentPanel.id === tab.value.parent &&
    showingTab &&
    showingTab.id === tab.value.id
  ) {
    handleRefresh()
  }
}, {
  deep: true
})


provide(MenuRouterKey, {
  navigateTo,
  updateProps,
  updateTabName,
  routerContainer,
  back,
  getHistory,
  addToHistory,
  refeshActions,
  message: {
    success: (...args: any[]) => createMessage('success', ...args),
    error: (...args: any[]) => createMessage('error', ...args),
    warning: (...args: any[]) => createMessage('warning', ...args),
    info: (...args: any[]) => createMessage('info', ...args),
    loading: (...args: any[]) => createMessage('loading', ...args)
  },
  notification: {
    success: (...args: any[]) => createNotification('success', ...args),
    error: (...args: any[]) => createNotification('error', ...args),
    warning: (...args: any[]) => createNotification('warning', ...args),
    info: (...args: any[]) => createNotification('info', ...args),
    loading: (...args: any[]) => createNotification('loading', ...args)
  },
  tabData: tab
})

const renderComponent = ref(true)

function reloadComponent() {
  // componentKey.value++
  // try to find a way to refresh component
  renderComponent.value = false;
  nextTick(() => {
    renderComponent.value = true;
  })
}

function handleErr(err:any){
  console.log(err)
}

const historyClass = computed(() => {
  
  return `#tab-header-${tab.value.parent}-${tab.value.id} > .tabLeftTeleportContainer`
})

defineExpose({
  navigateTo
})

onUnmounted(() => {
  history.value = []
  forwardHistory.value = []
})

</script>

<template>

  <div :class="['routerContainer', [tab.name]]">
    <Teleport :to="historyClass" defer>
      <div class="historyContainer">
        <Icon name="lucide:chevron-left" :class="{historyBtn:true, active: history.length !== 0}"
              @click="() => back()" />
        <Icon name="lucide:chevron-right" :class="{historyBtn:true, active: forwardHistory.length !== 0}"
              @click="() => forward()" />
        <Icon name="lucide:refresh-ccw" :class="{historyBtn:true, active: true}" @click="reloadComponent" />
      </div>
    </Teleport>
    <Teleport v-if="tab.icon" defer
              :to="`#tab-header-${tab.parent}-${tab.id} > .icon`">

      <Icon :name="tab.icon" />
    </Teleport>
    <Teleport v-if="tab.label" defer
              :to="`#tab-header-${tab.parent}-${tab.id} > .label`">
      <div class="label">
        {{ t(tab.label) }}
      </div>
    </Teleport>

    <template v-if="tab.initized">
      <Transition>
          <Suspense>
            <template v-if="!tab.handleError" >
            <NuxtErrorBoundary ref="errorBoundary" @error="handleErr">
              <component v-if="renderComponent" :is="tab.component" :tab="tab" v-bind="tab.props" />
              <template #error="{ error, clearError }">
                <div class="errorBoundaryContainer">
                  <div class="messageContainer">
                    <h3 class="errorTitle">ERROR : {{ $t(tab.label) }}</h3>
                    <pre>
                       {{ error }}
                    </pre>
                    <pre>
                      {{ tab }}
                    </pre>
                    <el-button :icon="Refresh" @click="clearError">
                      {{ $t('common_refresh') }}
                    </el-button>
                  </div>
                </div>
              </template>
            </NuxtErrorBoundary>
            </template>
            <template v-else>
              <component v-if="renderComponent"  :is="tab.component" :tab="tab" v-bind="tab.props" />
            </template>
            <template #fallback>
              <LoadingBgInline />
            </template>
          </Suspense>
      </Transition>
    </template>
    
  </div>
</template>

<style lang="scss" scoped>
.loadingContainer {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
}

.historyContainer {
  line-height: 1;
  display: flex;
  flex-flow: row nowrap;
  gap: var(--app-space-xxs);
  align-items: center;
  justify-content: flex-start;
}

.historyBtn {
  --btn-color: var(--app-grey-800);
  color: var(--btn-color);
  font-size: var(--app-font-size-m);

  &.active {
    --btn-color: var(--app-grey-300);

    &:hover {
      --btn-color: var(--app-success-color);
    }
  }
}

.routerContainer {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  /* padding: var(--app-space-s); */
}

.v-enter-active,
.v-leave-active {
  transition: opacity 0.2s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
