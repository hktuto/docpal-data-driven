<script setup lang="ts">

const opened = ref(false)
const emits = defineEmits(['openInCurrentTab', 'openInNewTab'])
const tabData = ref<TabItem>()
const { t } = useI18n()
function open(item:TabItem) {
    opened.value = true
    tabData.value = item
}

function submit(openNew:boolean = false) {
    if(openNew) {
        emits('openInNewTab', tabData.value)
    }else{
        emits('openInCurrentTab', tabData.value)
    }
    opened.value = false
}

defineExpose({
    open
})


</script>

<template>
    <ElDialog v-model="opened" append-to-body>
        <div class="dialogContent">
            <div class="row">
                System has detected that you have copied a URL (  <Icon v-if="tabData.icon" :name="tabData.icon" class="icon" /> {{ t(tabData.label) }} ) to the clipboard. What would you like to do with the URL?
            </div>
       
        </div>
        <template #footer>
            <ElButton @click="opened = false">Cancel</ElButton>
            <ElButton type="primary" @click="submit(true)">Open</ElButton>
        </template>
    </ElDialog>

</template>

<style lang="scss" scoped>
.dialogContent{
    font-size: var(--app-font-size-l);
    display: flex;
    flex-flow: row nowrap;
    justify-content: flex-start;
    align-items: center;
    gap: var(--app-space-s);
    .icon{
        font-size: var(--app-font-size-l);
        display : inline-block;
        vertical-align: bottom;
    }
    .label{
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
    }
}

</style>