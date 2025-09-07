<script lang="ts" setup>
import { EventType, useEventBus } from 'eventbus';



const {items, menuItemHeight , isChild = false, rowData} = defineProps<{
    items:TableMenuActions[],
    menuItemHeight:number,
    isChild?:boolean
    rowData?:any
}>();
const contextMenuListRef = ref<HTMLElement>()
const postion = ref<any>({x:0, y:0, left:0, top:0})

const selectedItem = ref<TableMenuActions>()

function selectItem(item?:TableMenuActions){
    if(!item) {
        selectedItem.value = undefined
        return;
    }
    if(!item.children || item.children.length === 0) return
    selectedItem.value = item;
}

function openMenu(){
    // TODO : item height may be too high to display.
    const itemTotalHeight = getChildActionMaxHeight(items, menuItemHeight)
    const itemMaxWidth = getActionMaxWidth(items)
    // get parent postion 
    const { top,  width, height, left} = contextMenuListRef.value?.getBoundingClientRect() as DOMRect
    // calculate the postion of submenu
    postion.value = {
        x: left - itemMaxWidth,
        y: top + height,
        left: - itemMaxWidth,
        top: 0
    }
    console.log("openMenu", postion.value, items)
}

function reset(){
    selectedItem.value = undefined
}

const contextMenuBus = useEventBus<TABLE_CONTEXT_PARAMS>(EventType.TABLE_CONTEXT_MENU_OPEN)
contextMenuBus.on(reset)


onUnmounted(() => {
    contextMenuBus.off(reset)
})

provide(ContextmenuListKey,{
    selectedItem,
    selectItem
})

defineExpose({
    openMenu
})


</script>

<template>
    <ul ref="contextMenuListRef" :class="{['vxe-context-menu--option-wrapper'] : !isChild, ['vxe-table--context-menu-clild-wrapper']:isChild}" :style="{left: postion.left + 'px', top: postion.top + 'px', ['--context-item-height']: menuItemHeight + 'px'}">
        <template v-for="(item, index) in items" :key="index">
            <AppContextmenuItem v-if="item.visible" :item="item" :menuItemHeight="menuItemHeight" :selected="selectedItem === item" :rowData="rowData" />
        </template>
    </ul>
</template>