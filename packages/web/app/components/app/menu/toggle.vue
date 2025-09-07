<script lang="ts" setup>

import { TabManagerKey } from '#imports'
const tabProvider = inject(TabManagerKey)
if(!tabProvider) {
    throw createError('tab manger not found')
}
const icon = computed(() => {
    return tabProvider.menuStick.value ? 'tabler:layout-sidebar-left-collapse-filled' : 'tabler:layout-sidebar-left-expand-filled'
})
</script>

<template>
    <div class="toggleContainer">

        <Icon :name="icon" @click="tabProvider.toggleMenuStick"/>
    </div>

</template>

<style lang="scss" scoped>
.toggleContainer{
    font-size: var(--app-font-size-l);
    cursor: pointer;
    color: var(--app-grey-300);
    &:hover{
        color: var(--app-main-color);
    }
}
</style>