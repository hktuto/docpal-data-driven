
<script setup lang="ts">
import { useGlobalSetting } from "#imports";
import { TabApp } from "#components";
const tabAppRef = useTemplateRef<typeof TabApp>('tabAppRef');
const emits = defineEmits(["ready"]); 

const config = useAppConfig()

const emptyTab = {
  id: "new-tab-001",
  label: "New Tab",
  name: "new-tab-001",
  parent: "dummy-tab-container",
  component: "LazyTabEmpty",
};

const defaultTab = computed(() => {
  const configTab = config.defaultTab as string;
  console.log("configTab", config, config.appMenu)
  if(!configTab) return emptyTab;
  if(config.appMenu && (config as any).appMenu[configTab]) {
    return (config as any).appMenu[configTab]
  }
  return emptyTab;
})
const inited = ref(false)
async function getTabsFromServer() {
  // check if new tab
  if(inited.value) return
  let storageTabs = localStorage.getItem('docpal-app-tab');

  sessionStorage.removeItem('temp-path')
  // storageTabs = null
  try {
    if (storageTabs) {
      const newLayout = JSON.parse(storageTabs);
      // check and set layout
      newLayout.forEach((item:any) => {
        const tabId = item.id;
        item.tabs.forEach((child:any) => {
          child.parent = tabId
        })
      })
      // TODO : check if storageTabs is array, and handle restore other tabs
      tabAppRef.value?.setLayout(newLayout);
    } else {
      // init a basic layout
      tabAppRef.value?.setHightLightPanel("dummy-tab-container");
      const _defaultTab = JSON.parse(JSON.stringify(defaultTab.value))
      _defaultTab.parent = "dummy-tab-container";
      tabAppRef.value?.setLayout([
        {
          id: "dummy-tab-container",
          parent: "root",
          showingTabIndex: 0,
          size: 100,
          tabs: [_defaultTab],
        },
      ]);
    }
  } catch (error) {
    console.log("error", error)
    tabAppRef.value?.setLayout([
      {
        id: "dummy-tab-container",
        parent: "root",
        showingTabIndex: 0,
        size: 100,
        tabs: [defaultTab.value],
      },
    ]);
    console.log("getTabsFromServer", error);
  }finally {

    inited.value = true;
    const router = useRouter();

    router.push({
      hash: "",
      query: {},
    });
  };
  
}

function saveHighlightPanel(panelID: string) {
  localStorage.setItem("docpal-tab-hightLightPanel", panelID);
}

async function saveTabsToLocalStorage(layout: TabPanel[]) {
  const saveData = JSON.parse(JSON.stringify(layout));
  // loop all panel and tabs to reset all initized to false
  saveData.forEach((panel: any) => {
    panel.tabs.forEach((tab: any) => {
      tab.initized = false;
    });
  });
  localStorage.setItem('docpal-app-tab', JSON.stringify(saveData));
}
const { t } = useI18n();

// const { globalSlots } = useGlobalSetting();

</script>


<template>
  <TabApp 
    ref="tabAppRef"
    @ready="getTabsFromServer"
    @layoutChanged="saveTabsToLocalStorage"
     @highlightPanelChanged="saveHighlightPanel"
  >
    <!-- <template #sidebar>
        <slot name="sidebar" />
        <component
          v-for="s in globalSlots"
          v-show="s.show"
          :key="s.name"
          :is="s.component"
          v-bind="$props"
        /> 
      </template>-->
    </TabApp>
    <AppContextmenu />
</template>
