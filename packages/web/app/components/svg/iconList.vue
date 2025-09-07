<template>
<div class="svg-list-container">
    <div v-for="list in svgIconList" :key="list.name" class="catergoryContainer">
        <div class="categoryTitle">{{list.name}}</div>
        <div class="svg-list">
            <div class="iconContainer" v-for="svg in list.children" :key="svg.src" :class="{'selectedSvg': svg.src === _selectSvg}" @click="handleSvgClick(svg)">
               <SvgIcon :src="svg.src" />
            </div>
        </div>
    </div>
</div>
</template>
<script lang="ts" setup>
const props = defineProps<{
    selectedSrc: string
}>()
import { svgIconList } from '~/utils/svg'
// const svgIconList = ref<{name:string, children:{name:string, src:string}[]}[]>([])
const value = ref()
import InlineSvg from 'vue-inline-svg';

const _selectSvg = ref(props.selectedSrc)
const emit = defineEmits(['svg-click', 'update:selectedSrc'])
const handleSvgClick = (item:{src:string})=>{
    _selectSvg.value = item.src
}
function getSvg () {
    emit('update:selectedSrc', _selectSvg.value)
}
defineExpose({ getSvg })
</script>

<style lang="scss" scoped>
.catergoryContainer{
        margin-block: var(--app-space-xs);
        .categoryTitle{
            font-size: var(--el-font-size-medium);
        }
    }
.svg-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
    gap: var(--app-space-xs);

    .iconContainer{
        aspect-ratio: 1 / 1;
        display: grid;
        place-items: center;
        border-radius: var(--app-space-xs);
        --icon-size:2rem;
    }
    .selectedSvg {
        background-color: var(--app-primary-2);
    }
    :deep(.el-card__body) {
        text-align: center;
    }
}
</style>
