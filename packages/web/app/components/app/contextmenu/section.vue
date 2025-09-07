<script lang="ts" setup>

import { ContextMenuListKey } from '#imports';

const {sections} = defineProps<{
    sections:TableMenuActions[][]
}>();



const eventposition = ref<any>({x:0, y:0})
const visible = ref(false)
const menuItemHeight = 26;


const position = computed(() => {
    // contextMenu is 120px width , so we need to calculate the left and top position and check if it is out of the screen
    const {x, y} = eventposition.value
    
    const left = x + 120 > window.innerWidth ? x - 120 : x
    // calculate the total height of actions
    const totoalActionHeight = sections.length * menuItemHeight;// 40 is the height of each action
    // check if the top position is out of the screen
    const top = y + totoalActionHeight > window.innerHeight ? y - totoalActionHeight : y
    return {
        left,
        top
    }
})

function open({x, y}:any){
    eventposition.value = {x,y}
    visible.value = true
}

function close(){
    visible.value = false
}




const selectedItem = ref<TableMenuActions>()

function selectItem(item:TableMenuActions){
    selectedItem.value = item
}

provide(ContextMenuListKey,{
    selectedItem,
    selectItem
})

defineExpose({
    open,
    close
})
</script>

<template>
     <ul class="vxe-context-menu--option-wrapper" :style="{left: position.left + 'px', top: position.top + 'px', ['--context-item-height']: menuItemHeight + 'px'}">
        <AppContextmenuList v-for="(section, index) in sections" :key="`contextSection-${index}`" :items="section" />
     </ul>
</template>