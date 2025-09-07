<script setup lang="ts" generic="T extends MenuItem">
const  { userMenu, appMenu } = useAppConfig()
const mode = ref<'collapse' | 'expand'>('collapse')
const props = defineProps<{
    admin?: boolean
}>()
const layout = useTabLayout()
const hightLightPanel = useCurrentTargetPanel()
const tabProvider = inject(TabManagerKey)
if(!tabProvider) {
    throw createError('tab manger not found on menu')
}
const { t } = useI18n()
const displayMenu = ref<any[]>([])

function generateMenu(){
    let result = []
    
    const _appMenu = deepCopy(userMenu) // menu list
    const _menu = deepCopy(appMenu) // menu对象映射
    
    for(let i = 0; i < _appMenu.length; i++) {
        let item = _appMenu[i];
        let menuItem = item;
        
        // step 1 check if item has name, if so get it from menu
        if((item.name && _menu[item.name])) {
            // TODO : check if menu[item.name] has license
            menuItem = _menu[item.name];
            if(checkVisible(menuItem)) {
                result.push(menuItem)
            }
            continue;
        }
        let hasVisibleChildren = false;
        if(item.children) {
            for(let j = 0; j < item.children.length; j++) {
                if(item.children[j].name && _menu[item.children[j].name] && checkVisible(_menu[item.children[j].name])) {
                    item.children[j] = _menu[item.children[j].name];
                    hasVisibleChildren = true
                }else{
                    item.children.splice(j, 1);
                    j--;
                }
            }
            if(item.children.length === 0) {
                item.children = undefined
            }
        }
        if(hasVisibleChildren && checkVisible(menuItem)) {
            result.push(menuItem)
        }
    }

    displayMenu.value = result;
}
function checkVisible(row: any) {
    if(row.feature && row.feature !== 'CORE') {
        // return allowFeature(row.feature)
        // TODO : check if feature is allowed
        return true
    }
    return true
}
const selectedMenuItem = ref<TabItem>()

function setSelectedMenuItem() {
    const panelIndex = layout.value.findIndex(panel => panel?.id === hightLightPanel.value)
    if (panelIndex !== -1) {
        const panel = layout.value[panelIndex]
        if (panel && Array.isArray(panel.tabs)) {
            const tabIndex = typeof panel.showingTabIndex === 'number' ? panel.showingTabIndex : 0
            const selected = panel.tabs[tabIndex] || panel.tabs[0]
            if (selected) {
                selectedMenuItem.value = selected
            }
        }
    }
}


watch(() => [layout, hightLightPanel], () => {
    // get hightLightPanel
    setSelectedMenuItem()
},{
    deep:true,
    immediate: true
})

onMounted(() => {
    // const menuState = localStorage.getItem('app-menu-mode')
    // if(menuState === 'expand'){
    //     mode.value = 'expand'
    // }
    generateMenu()
})

</script>

<template>
    <div class="appWrapper">
        <div class="menuContainer">
            <div class="menuHeader">
                <slot name="header" />
                <!-- <AppMenuToggle /> -->
            </div>
            <div class="menuBody">
                <AppMenuSearch />
    
                <AppMenuItem 
                    v-for="(item, index) in displayMenu" 
                    :key="index" 
                    :item="item" 
                    :selectedMenuItem="selectedMenuItem"  />
            </div>

            <div class="menuFooter">
                <slot name="footer"></slot>
            </div>
        </div>
        <!-- <div class="menuToggleer" @click="toggleMenuMode">
            <Icon class="menuToggleIcon" :name="mode === 'collapse' ? 'lucide:chevron-right' : 'lucide:chevron-left'" />
        </div> -->
    </div>
</template> 

<style scoped lang="scss">                                                    
.levelTwoMenuContainer{
    padding: var(--app-space-s);
    border-left: 1px solid var(--app-grey-800);
    height: 100%;
    min-width: 220px;
    margin-left: var(--app-space-xs);
    display: flex;
    flex-flow: column nowrap;
    justify-content: flex-start;
    align-items: flex-start;
    gap:0;
    > * {
        width:100%;
        flex: 0 0 auto;
    }
    .subMenuItem + .subMenuItem {
        border-top: 1px solid var(--app-grey-800);
    }
}
.menuToggleIcon{
    font-size: var(--toggler-width);
    color: var(--app-grey-100);
}
.menuExpaneBody{
    width: 220px;
}
.menuHeader{
    display: flex;
    flex-flow: row wrap;
    justify-content: flex-start;
    align-items: center;
}
.appWrapper{
    height: 100%;
    width: 100%;
    display: flex;
    flex-flow: row nowrap;
    justify-content: flex-start;
    align-items: flex-start;
    --menu-gap: var(--app-space-xxs);
    --icon-font-size: calc(var(--app-font-size-m) * 1.2);
    --menu-item-padding: var(--app-space-xs);
    --menu-item-radius: var(--app-border-radius-m);
    --menu-item-normal-bg: rgba(0,0,0,0);
    --menu-item-active-bg: var(--app-grey-1000);
    --menu-item-normal-color: var(--app-grey-100);
    --menu-item-hover-color: var(--app-accent-color);
    --menu-item-active-color: var(--app-main-color);
    position: relative;
}
.menuContainer{
    width:100%;
    height: 100%;
    display: grid;
    grid-template-rows: min-content 1fr min-content;
    gap: var(--app-space-s);
}
.menuBody{
    width: 100%;
    display: flex;
    flex-flow: column nowrap;
    justify-content: flex-start;
    align-items: flex-start;
    gap: var(--app-space-xs);
    font-size: var(--icon-font-size);
    position: relative;
    overflow: auto;
    padding-block: var(--app-space-s);
}
.menuFooter{
    font-size: var(--icon-font-size);

}
</style>
