<template>
<div class="dp-drawer">
    <div class="flex-y">
        <SvgIcon :src="_src" />
        <el-button @click="dialogVisible = true">
            {{$t('selectSvg')}}
        </el-button>
    </div>
    <el-dialog v-model="dialogVisible" :title="$t('selectSvg')" 
        class="scroll-dialog svg-selector__dialog"
        append-to-body>
        
        <SvgIconList ref="svgIconListRef" v-model:selectedSrc="_src"></SvgIconList>
        <template #footer>
            <div class="flex-x-between">
                <div class="flex-x-start">{{$t('selectedSvg')}}:<SvgIcon class="el-icon--right" :src="_src" /></div>
                <div>
                    <el-button @click="dialogVisible = false">{{$t('cancelText')}}</el-button>
                    <el-button type="primary" @click="handleConfirm">{{$t('dpButtom_confirm')}}</el-button>
                </div>
            </div>
        </template>
    </el-dialog>
</div>
</template>
<script lang="ts" setup>
const props = defineProps<{
    src: string
}>()
const dialogVisible = ref(false)
const _src = ref()
const svgIconListRef = ref()
const emit = defineEmits(['update:src'])
function handleConfirm () {
    svgIconListRef.value.getSvg()
    dialogVisible.value = false
    emit('update:src', _src.value)
}
watch(()=> props.src, (newValue) => {
    _src.value = newValue
}, {
    immediate: true
})
</script>

<style lang="scss" scoped>
:deep(.el-dialog__footer) {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.svg-selector__dialog {
    .el-dialog__body {
        max-height: 60vh;
        overflow: auto;
        padding-top: 0;
        padding-bottom: 0;
    }
}
.flex-y {
    display: flex;
    align-items: center;
    gap: var(--app-space-xs);
}
</style>
