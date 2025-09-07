<script setup lang="ts">
import {TabManagerKey, useDropable, menuKey, createError, inject} from '#imports'
import { useEventBus, EventType } from 'eventbus'
import { useCurrentTargetPanel } from '../../composables/useTab'
import type { TabPanel, TabItem } from '../../utils/tabType';
const hightLightPanel = useCurrentTargetPanel()
const tabManager = inject(TabManagerKey)
if(!tabManager) {
    throw createError('no '+ TabManagerKey.toString + "provided")
}

function isTabData(
  data: Record<string | symbol, unknown>,
):boolean {
  return data.key === (tabManager as any).tabDataKey;
}

const {panel, index} = defineProps<{
    panel: TabPanel,
    index: number
}>()

const elRef = ref()
const { dragState, setupDropable, extractClosestEdge } = useDropable({
    key: (tabManager as any).tabDataKey,
    canMonitor: () => {return true},
    canDrop: ({source}:any) => {
        const acceptTypes = ['menu', 'tab']
        return acceptTypes.includes(source.data.type)
    },
    onDropHandler :({ location, source, target}:any) => {
        const isTab = isTabData(source.data)
        // 如果不是本 panel 下 drop 的，不用做什麼
        if(!target || !target.data || !target.data.data || target.data.data.id !== panel.id) return;
        if(isTab){
            const sourceData = source.data as any
            const targetData = target.data as any

            const mouse = location.current.input;
            const targetRect = target.element.getBoundingClientRect();
            const isCenter = (Math.abs(mouse.clientX - targetRect.left) > targetRect.width / 3) && (Math.abs(mouse.clientX - targetRect.right) > targetRect.width / 3);
            if(isCenter) {
                splitViewToDirection(sourceData.data, targetData.data, 'center')
                return;
            }else{
                const closestEdgeOfTarget = extractClosestEdge(targetData) as any
                if(!closestEdgeOfTarget) return
                splitViewToDirection(sourceData.data, targetData.data, closestEdgeOfTarget)
            }
            return;
        }
        const isMenu = source.data.key === menuKey
        if(isMenu) {
            const sourceData = source.data as any
            const targetData = target.data as any
            const mouse = location.current.input;
            const targetRect = target.element.getBoundingClientRect();
            const isCenter = (Math.abs(mouse.clientX - targetRect.left) > targetRect.width / 3) && (Math.abs(mouse.clientX - targetRect.right) > targetRect.width / 3);
            if(isCenter) {
                addMenuItemToPanel(sourceData.data, targetData.data, 'center')
                return;
            }else{
                const closestEdgeOfTarget = extractClosestEdge(targetData) as any
                if(!closestEdgeOfTarget) return
                addMenuItemToPanel(sourceData.data, targetData.data, closestEdgeOfTarget)
            }
            return
        }
    },
    detectDrop: true,
    dragData: {
        key: (tabManager as any).tabDataKey,
        data: panel as any,
    },
    allowedEdges: ['left', 'right'],
    // dropExternal: true
})

onMounted(() => {
    if(!elRef.value) return
    setupDropable(elRef.value)
    
})

function backdropClick(index:number){
    panelTabFocus(panel.id, index);
}

const isTabNormal = ref(true)

const zoomBus = useEventBus(EventType.TABLE_ZOOM_MAX)
zoomBus.on((type) => {
    isTabNormal.value = false
})
const zoomRevertBus = useEventBus(EventType.TABLE_ZOOM_REVERT)
zoomRevertBus.on((type) => {
    isTabNormal.value = true
})


</script>

<template>
    <div :class="{tabContainer:true, activePanel: hightLightPanel === panel.id}">
        
        <TabHeaderList :panel="panel">
            <template #prefix>
                
                <div v-if="index === 0 " >
                    <div class="menuToggleInHeaderContainer">

                        <AppMenuToggle />
                    </div>
                </div>
            </template>
        </TabHeaderList>
        
        <div ref="elRef" :data-tab-id="panel.id"  :class="{
                tabBody:true, [dragState.type]:true, [(dragState as any).closestEdge as string]:true, isTabNormal
            }">
            <div v-for="(tab,index) in panel.tabs" :key="tab.id" :id="panel.id + '_' + tab.id" class="tabContent" :hidden="index !== panel.showingTabIndex" @click="backdropClick(index)">

            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">

.menuToggleInHeaderContainer{
    padding-inline: var(--app-space-xs);
}
.tabContainer{
    height: 100%;
    width:100%;
    position: relative;
    display: grid;
    grid-template-rows: min-content 1fr;
    overflow: hidden;
    opacity: 1;
    --tab-item-border-color: rgba(255,255,255,0);
    background: var(--app-grey-1000);
    
    &.activePanel{
        :deep(.tabItem.showing) {
            --tab-item-border-color: var(--app-accent-color);
            // color: var(--app-primary-color);
            font-size: calc(var(--app-font-size-l) * 0.9);
            font-weight: bold;
            line-height: 1;
        }
        
    }
}
.tabBody, .tabContent{
    width:100%;
    height:100%;
    overflow: hidden;
    position: relative;
    
    &.normal{
        transform: scale(1);
    }
}
.tabContent {
    container-type: inline-size;
    overflow: hidden;
}
.tabBody{
    overflow: hidden;
    &.is-dragging-over{
        --side-width: 40%;
        .tabContent{
            pointer-events: none;
            opacity: 0.4;
        }
        &.center{
            &:after{
                height:100%;
                top: 0;
                left:15%;
                width:70%;
            } 
        }
        &.top{
            &:after{
                height:var(--side-width);
                top: 0;
                left:0;
                width:100%;
            }
        }
        &.bottom{
            &:after{
                height:var(--side-width);
                bottom: 0;
                left:0;
                width:100%;
            }
        }
        &.left{
            &:after{
                width:var(--side-width);
                top: 0;
                left:0;
                height:100%;
            }
        }
        &.right{
            &:after{
                width:var(--side-width);
                top: 0;
                left: calc(100% - var(--side-width));
                height:100%;
            }
        }
        &:after{
            content: "";
            position: absolute;
            display: block;
            z-index: 1;
            background: rgba(0,0,0,0.3);
            transition: all .2s ease-in-out;
        }
    }
}

</style>