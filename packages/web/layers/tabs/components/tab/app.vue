<script setup lang="ts">

import { 
  useTabsManager, 
  useCurrentTargetPanel, 
  } from '../../composables/useTab'
import { useMagicKeys, whenever, useActiveElement} from '@vueuse/core'
import {logicAnd} from '@vueuse/math'
import {useEventBus, GlobalPasteEvent } from 'eventbus'
import 'splitpanes/dist/splitpanes.css'

const emits = defineEmits(['ready', 'layoutChanged', 'highlightPanelChanged'])
const {layout, initLayout, allComponents, allComponentRef} = useTabsManager()
const loading = ref(false);
const hightLightPanel = useCurrentTargetPanel()

// #region hot key to close tab
const activeElement = useActiveElement()

const notUsingInput = computed(() =>
  activeElement.value?.tagName !== 'INPUT'
  && activeElement.value?.tagName !== 'TEXTAREA'
)

const { delete: DELETE } = useMagicKeys()

whenever(logicAnd(DELETE, notUsingInput), () => {
  console.log('Tab has been pressed outside of inputs!')
  // check layout 
  if (layout.value.length !== 1 || layout.value[0]?.tabs?.length !== 1) {
    const selectedTab = layout.value.find(panel => panel.id === hightLightPanel.value)
    if (selectedTab && typeof selectedTab.showingTabIndex === 'number') {
      closePanelTab(hightLightPanel.value, selectedTab.showingTabIndex, true)
    }
  }
})
  // #endregion

const dialogItem = ref<TabItem>()
const menuStick = ref(true)

const dialogOpened = ref(false)

function closeDialog(){
    dialogOpened.value = false
}
function openNewDialog(tab:TabItem){
    dialogOpened.value = true;
    dialogItem.value = tab
}

provide(
    TabManagerKey, 
    {
        dialogOpened,
        closeDialog,
        openNewDialog,
        openInCurrentTab,
        openTab,
        openInNewTab,
        menuStick,
        toggleMenuStick
    }
)

async function openTab(tab:TabItem, ignoreFocus:boolean = false){
    // check if tab is already open
    try{
        if(ignoreFocus) throw new Error("ignoreFocus")
        await focusExistingTab(tab)
    }catch(error){
        addTabInCurrentPanel({...tab})
    } 
}

async function openInNewTab(tab:any){
  // check layout have more than one panel
  const sourceData = tab;
  if(layout.value.length === 1){
    const targetData = layout.value[0] as TabPanel
    console.log("openInNewTab", targetData, layout.value)
    addMenuItemToPanel(sourceData, targetData, 'right')
    return
  }
  // if not check current focus panel index
  const panelIndex = layout.value.findIndex(panel => panel.id === hightLightPanel.value)
  if(panelIndex === -1) throw new Error('panel not found')
  const targetTab =  panelIndex === 0 ? layout.value[1]: layout.value[panelIndex -1] as any
  console.log("openInNewTab", targetTab, sourceData)
  addTabToPanel(targetTab.id, sourceData)
}

function focusExistingTab(tab:TabItem){
    const existingTab = allComponents.value.find(item => item.name === tab.name)
    if(existingTab){
        const panelIndex = layout.value.findIndex(panel => panel.id === existingTab.parent)
        const panel = layout.value[panelIndex]
        if (panelIndex !== -1 && panel && Array.isArray(panel.tabs)) {
            const tabIndex = panel.tabs.findIndex(item => item.name === existingTab.name)
            panel.showingTabIndex = tabIndex
            console.log("focusExistingTab", panel.showingTabIndex)
            // if panel is not initized, set it to initized
            if (
                tabIndex !== -1 &&
                panel.tabs[tabIndex] &&
                !panel.tabs[tabIndex].initized
            ) {
                panel.tabs[tabIndex].initized = true
            }
            // Fix: add null checks and ensure showingTabIndex is a number
            const panelId = layout.value[panelIndex]?.id
            const showingTabIndex = layout.value[panelIndex]?.showingTabIndex
            if (typeof panelId !== 'undefined' && typeof showingTabIndex === 'number') {
                panelTabFocus(panelId, showingTabIndex)
                return Promise.resolve()
            } else {
                return Promise.reject(new Error("can not find index"))
            }
        }
    }else{
        return Promise.reject(new Error("no existingTab"))
    }
}

async function openInCurrentTab(tab:TabItem){
    try{
        await focusExistingTab(tab)
    }catch(error){
        let panel = layout.value.find( panel => panel.id === hightLightPanel.value) as any
        if(!panel) {
            panel = layout.value[0] as any
        }
        const tabIndex = panel.showingTabIndex as number
        const highLightItem = panel.tabs[tabIndex]
        if(highLightItem){
            const indexInAllComponent = allComponents.value.findIndex(item => item.id === highLightItem.id)
            const componentRef = allComponentRef.value[indexInAllComponent]
                if (componentRef && typeof (componentRef as any).navigateTo === 'function') {
                    (componentRef as any).navigateTo(tab)
                } else {
                    console.log("can not find component or navigateTo method")
                    // fallback to open in current tab
                    openTab(tab)
                }
        }
    }
    // const existingTab = allComponents.value.find(item => item.name === tab.name)
}

function setLayout(layout:any[]){
    loading.value = true;
    // console.log("setLayout", layout)
    initLayout(layout);
    loading.value = false

    // get tab from router
}

function setHightLightPanel(panelId:string){
    hightLightPanel.value = panelId
}

function toggleMenuStick(){
    menuStick.value = !menuStick.value
    if(!menuStick.value){
        localStorage.setItem('docpal-closeMenu', '1')
    }else{
        localStorage.removeItem('docpal-closeMenu')
    }
}

onMounted(() => {
    const LastMenuClosed = localStorage.getItem('docpal-closeMenu')
    // check if window is small screen, if small screen, set menuStick to false
    if(window.innerWidth <= 768){
        menuStick.value = false
    }else if(LastMenuClosed){
        menuStick.value = false
    }else{
        menuStick.value = true
    }
})

watch(hightLightPanel,(item) => {
    emits('highlightPanelChanged', item)
})

watch(layout, (newVal) => {
    emits('layoutChanged', newVal)
},{
    deep:true
})
const PasteDialogRef = ref();
const copyTabBus = useEventBus(GlobalPasteEvent.TAB_COPY_PATH)
copyTabBus.on((data:any) => {
    console.log("copy tab", data)
    PasteDialogRef.value?.open(data)
})

defineExpose({
    setLayout,
    setHightLightPanel,
    openInCurrentTab,
    openTab,
    openInNewTab
})
</script>

<template>
<TabWrapper>
        <template #sidebar>
            <AppMenu class="sideMenu" :admin="appPlatform === 'admin'">
                <template #header>
                    <div class="logo">
                        <img src="/logo.png" alt="logo">
                    </div>
                </template>
                <template #footer>

                    <AuthUser />
                </template>
            </AppMenu>
            
        </template>
        <template #default>
            <template  v-if="loading">
                <LoadingBg />
            </template>
            <template v-else>
                <TabLayout :layout="layout" @ready="$emit('ready')" />
                <div class="hiddenAllComponent">
                    <template v-for="component in allComponents" :key="component.id">
                        
                        
                        <Teleport defer :to="`#${component.parent}_${component.id}`">
                                <TabRouter ref="allComponentRef" :tab="component" />
                            </Teleport>
                        
                    </template>
                </div>
            </template>
        </template>
    </TabWrapper>
    <!-- <TabPastePathDialog ref="PasteDialogRef"  @openInNewTab="(data:any) => openTab(data, true)" /> -->
</template>


<style lang="scss" scoped>
.logo{
    height: 40px;
    position: relative;
    img{
        height: 100%;
        width: auto;
    }
}

</style>
