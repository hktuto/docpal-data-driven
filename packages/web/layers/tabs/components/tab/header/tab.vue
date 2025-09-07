<script lang="ts" setup generic="T extends TabItem, B extends boolean, I extends number">
import { useEventBus, EventType, type GlobalPasteItem, GlobalPasteEvent  } from 'eventbus'
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';

import {TabManagerKey, useDragable} from '#imports'
import type { TabItem, TabPanel } from '../../../utils/tabType';
import { ElNotification } from 'element-plus'

const { tab, selected, index, panel } = defineProps<{tab: T, selected:B, index:I , panel:TabPanel}>()
const tabManger = inject(TabManagerKey)
if(!tabManger) {
    throw createError('no '+ TabManagerKey.toString + "provided")
}
const elRef = ref()



const { t } = useI18n()
function isTabData(
  data: Record<string | symbol, unknown>,
):boolean {
  return data.key === (tabManger as any).tabDataKey;
}
const {dragState ,setupDrag} = useDragable({
    key: (tabManger as any).tabDataKey,
    dragData: {
        [(tabManger as any).tabDataKey]: true,
        key : (tabManger as any).tabDataKey,
        type: 'tab',
        data: tab
    },
    detectDrop: true,
    canDrag(args) {
      const layout = useTabLayout()
      // if layout has only one panel and one tab, then can not drag
      if(layout.value.length === 1 && layout.value[0].tabs.length === 1) return false
      return true
    },
    allowedEdges: ['left', 'right'],
    onDropFromExternal:({source, self}:any) => {
            const layout = useTabLayout()
            const allComponents = useTabComponent()
            const data = source.getStringData('text/plain');
            const sourceData = JSON.parse(data).data as any
            const targetData = self.data as any
            
            const closestEdgeOfTarget = extractClosestEdge(self.data)
            console.log("closestEdgeOfTarget", closestEdgeOfTarget)
            if(!closestEdgeOfTarget) return
            const parentId = layout.value.findIndex(tab => tab.id === targetData.data.parent);
            const targetIndex = layout.value[parentId].tabs.findIndex((tabItem) => tabItem.id === targetData.data.id);
            const newItemIndex = closestEdgeOfTarget === 'left' ? targetIndex  : targetIndex + 1
            const newData = {
                ...sourceData,
                id: "newtab-" + new Date().getTime(),
                parent: targetData.data.parent,
                initilized: false,
            }
            layout.value[parentId].tabs.splice(newItemIndex, 0, newData)
            allComponents.value.push(newData)
            panelTabFocus(targetData.data.parent, newItemIndex)
    },
    onDropItself:(args:any) => {
    },
    canDragToExternal: true
})

function openInFocusMode() {
    tabManger?.openFocusMode(tab)
}

onMounted(() => {
    setupDrag(elRef.value)
})
const bus = useEventBus(EventType.TABLE_CONTEXT_MENU_OPEN)
const stopBus = useEventBus(EventType.TABLE_CONTEXT_MENU_CLOSE)
async function openContextmenu(ev:any){
    ev.preventDefault()
    ev.stopPropagation()

    const evtParams:TABLE_CONTEXT_PARAMS = {
        row: null,
        column: null,
        rowIndex: 0,
        options: [
            [
                {
                    name: "Copy Url",
                    label: "Copy Url",
                    visible: true,
                    action:({row}) => {
                        copyToClipboard(tab)
                        stopBus.emit()
                    }
                },
                // {
                //     name: "Open in focus mode",
                //     visible:true,
                //     action:({row}) => {
                //         openInFocusMode()
                //         stopBus.emit()
                //     }
                // },
                {
                    name: "Open in New Window",
                    visible:true,
                    action:({row}) => {
                        openInNewTab()
                        stopBus.emit()
                    }
                },
                {
                    name: "Close Tab",
                    visible:true,
                    action:({row}) => {
                        closeTab()
                        stopBus.emit()
                    }
                }
            ]

        ],
        event:ev,
    }

    bus.emit(evtParams)
   
}

async function copyToClipboard(tab:TabItem) {
    const evtObj: GlobalPasteItem = {
        type : GlobalPasteEvent.TAB_COPY_PATH,
        data: tab
    }
    const url = location.origin + '/?actions=' + btoa(JSON.stringify(evtObj))
    const lastClipboard = useLastClipboard()
    lastClipboard.value = url
    navigator.clipboard.writeText(url)
    ElNotification.success(t('common_copySuccess'))
}

function openInNewTab() {
    if((window as any).isDesktopMode) {
        const ev = new CustomEvent('dragTagToWindow', {
            detail: {
                url: '/tab',
                data: tab,
            }
        })
        window.dispatchEvent(ev)
    } else {
        const args = btoa(encodeURIComponent(JSON.stringify({data:tab})))
        console.log(tab)
        window.open(`/tab?arg=${args}`, '_blank')
    }
    closePanelTab(tab.parent as string, index, true)
}

function tabFocus() {
    panelTabFocus(tab.parent as string, index)
}

function closeTab(){
    closePanelTab(tab.parent as string, index, true)
}

const canDelete = computed(() => {
  const layout = useTabLayout()
  // if layout has only one panel and one tab, then can not delete
  if(layout.value.length === 1 && layout.value[0].tabs.length === 1) return false
  return true
})

</script>

<template>
    <div class="tabWrapper" @click="tabFocus">

        <div ref="elRef" 
            :data-tab-id="tab.id" 
            :id="`tab-header-${tab.parent}-${tab.id}`"
            :class="{tabItem:true, showing:selected, [dragState.type]:true, [(dragState as any).closestEdge] :true}" 
            @contextmenu.stop="openContextmenu"
        >

            <div :class="{tabLeftTeleportContainer:true, selected}" >

            </div>
            <div class="icon"></div>
            <div class="label">
            </div>
            <!-- <Icon class="closeIcon" name="lucide:share-2" @click="copyToClipboard(tab)" /> -->
            <!-- <Icon class="closeIcon" name="lucide:fullscreen" @click="openInFocusMode" /> -->
            <!-- <Icon class="closeIcon" name="lucide:screen-share" @click="openInNewTab" /> -->
            <Icon class="closeIcon alwaysShow" v-if="canDelete" name="ic:round-close" @click.stop="closeTab" />
        </div>

        <Teleport v-if="dragState.type === 'preview'" :to="dragState.container">
            <div class="dragPreview">
                {{ tab.label }}
            </div>
        </Teleport>
</div>

</template>

<style lang="scss" scoped>

.tabLeftTeleportContainer{
    display: none;
    &.selected{
        display: block;
    }
}
.dragPreview{
    --item-radius: calc(var(--container-radius) - var(--container-padding) );
    padding: var(--app-space-xs) var(--app-space-s);
    border-radius: var(--item-radius);
    color: var(--app-grey-200);
    background: var(--app-grey-950);
}
.tabItem{
    --item-radius: calc(var(--container-radius) - var(--container-padding) );
    padding: var(--app-space-xs) var(--app-space-s);
    font-size: var(--app-font-size-m);
    color: var(--app-grey-400);
    border-bottom: 2px solid var(--tab-item-border-color);
    cursor: pointer;
    display: flex;
    justify-content: flex-start;
    // align-items: center;
    flex-flow: row nowrap;
    gap: var(--app-space-xxs);
    position: relative;
    max-width: 100%;
    min-width: 60px;
    background: var(--app-grey-950);
    &.is-dragging {
        opacity: 0.4;
    }
    .closeIcon{
        &.alwaysShow{
            display: block;
        }
    }
    &:hover {
        background: rgba(255,255,255,0.7);
        .gripIcon{
            display: block;
        }
        .closeIcon{
            display: block;
            opacity: 1;
        }
    }
    &.showing{
        background: var(--app-grey-1000);
        color: var(--app-grey-100);
    }
    &.is-dragging-over {
        &:before {
            content: "";
            position: absolute;
            height: 100%;
            width: 2px;
            top:0;
            background:  var(--app-accent-color);
        }
        &.left {
            &:before{
                left:0
            }
        }
        &.right {
            &:before{
                right:0
            }
        }
    }

}
.gripIcon{
    font-size: var(--app-font-size-l);
    display: none;
    position: absolute;
    left:0;
    height: 100%;
    width: 30%;
    top: calc( var(--app-space-s) / 2);
    cursor:grab;
}
.label{
    white-space: nowrap;
    text-overflow: ellipsis;
}
</style>
