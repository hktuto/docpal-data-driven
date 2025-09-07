<script lang="ts" setup >
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {TabManagerKey, useDropable} from '#imports'
import type {TabPanel, TabItem} from '#imports'

const tabManger = inject(TabManagerKey)
if(!tabManger) {
    throw createError('no '+ TabManagerKey.toString + "provided")
}
const elRef = ref()
const {panel} = defineProps<{panel:TabPanel}>()

function isTabData(
  data: Record<string | symbol, unknown>,
):boolean {
  return data.key === (tabManger as any).tabDataKey;
}

const { setupDropable } = useDropable({
    key: tabManger?.tabDataKey,
    canMonitor:({ source }) => isTabData(source.data),
    onDropHandler:({ location, source, target }:any) => {
            // if drop target is not this panel , return
            if (!target || (target as any).data.data.parent !== panel.id) {
                return
            }
            
            const sourceData = source.data as any
            const targetData = target.data as any
            
            if (!isTabData(sourceData) || !isTabData(targetData)) {
                // if source or target 不是 Symbol tab
                return
            }
            const closestEdgeOfTarget = extractClosestEdge(targetData)
            if(!closestEdgeOfTarget) return
            console.log({
                sourceData,
                targetData,
            })
            moveTabBetweenPanel({...sourceData.data}, {...targetData.data}, closestEdgeOfTarget as any )
    },
    detectDrop:false,
})
let cleanup = () => {}
onMounted(() => {
    setupDropable(elRef.value)
})

onUnmounted(() => {
    cleanup()
})

function newTab() {
    const config = useRuntimeConfig()
    const newDate = new Date().getTime()
    if(config.public.defaultTab){
        const newItem:any = {...config.public.defaultTab}
        newItem.parent = panel.id
        newItem.id = 'tabpanel-' + newDate
        addTabToPanel(panel.id, newItem)
    }
   
}


</script>

<template>
    <div ref="elRef" class="tabHeaderContainer">
        <slot name="prefix" />
        <TabHeaderTab v-for="(tab,index) in panel.tabs" :key="tab.id" :tab="tab" :panel="panel" :index="index" :selected="index === panel.showingTabIndex" />
        <div class="newTabButtonContainer">
            <Icon name="lucide:plus" @click="newTab" />
        </div>
    </div>
</template>

<style lang="scss" scoped>
.tabWrapper + .tabWrapper{
    border-left: 1px solid var(--app-grey-850);
}
.tabHeaderContainer{
    
    display: flex;
    flex-flow: row nowrap;
    overflow: auto;
    overflow-y:hidden ;
    isolation: isolate;
    position: relative;
    background: var(--app-grey-950);
    justify-content: flex-start;
    align-items: center;
    &:after {
        content: '';
        height: 1px;
        background: var(--app-grey-850);
        width:100%;
        display: block;
        z-index: -1;
        position: absolute;
        left: 0;
        bottom: 0;
    }
}
.newTabButtonContainer{
    padding-left: var(--app-space-xs);
}
</style>
