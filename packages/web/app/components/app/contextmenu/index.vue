<script lang="ts" setup>
import { useEventBus, EventType } from 'eventbus'
import { onClickOutside } from '@vueuse/core'



const actions = ref<TableMenuActions[][]>([])
const visible = ref(false)
const rowData = ref<any>() 
const position = ref<any>({x:0, y:0, left:0, top:0})
const menuItemHeight = 26;
const contextmenuRef = ref<HTMLElement>()

onClickOutside(contextmenuRef, () => {
    contextMenuCloseHandler()
})

const contextMenuOpenHandler = (args:TABLE_CONTEXT_PARAMS)=>{
    actions.value = args.options
    visible.value = true
    rowData.value = args.row
    // container may not be ready to calculate the width
    nextTick(() => {

    
        const {clientX,layerX, layerY,clientY} = args.event
        const x = clientX
        const y = clientY
        
        const el = contextmenuRef.value
        const maxWidth = el?.getBoundingClientRect().width || 0;
        const left = x + maxWidth > window.innerWidth ? x - maxWidth : x
        // calculate the total height of actions
        const totoalActionHeight = getRootActionMaxHeight(actions.value, menuItemHeight)
        // check if the top position is out of the screen
        const top = y + totoalActionHeight > window.innerHeight ? y - totoalActionHeight : y

        position.value = {
            x,
            y,
            left,
            top
        }
    })
    
    
}

const contextMenuCloseHandler = () => {
    rowData.value = undefined
    visible.value = false

}


const displayActions = computed(() => actions.value.filter(item => item.some(i => i.visible !== false)))


const contextMenuBus = useEventBus<TABLE_CONTEXT_PARAMS>(EventType.TABLE_CONTEXT_MENU_OPEN)
const contextMenuCloseBus = useEventBus<void>(EventType.TABLE_CONTEXT_MENU_CLOSE)
contextMenuBus.on(contextMenuOpenHandler)
contextMenuCloseBus.on(contextMenuCloseHandler)
onUnmounted(() => {
    contextMenuBus.off(contextMenuOpenHandler)
    contextMenuCloseBus.off(contextMenuCloseHandler)
})
</script>

<template>
    <div ref="contextmenuRef" :class="{contextMenuContainer:true, visible}" :style="{left: position.left + 'px', top: position.top + 'px', ['--context-item-height']: menuItemHeight + 'px'}">
        <AppContextmenuList v-for="(action, index) in displayActions" :key="index" :items="action" :menuItemHeight="menuItemHeight" :rowData="rowData" />
    </div>
</template>
