import type { InjectionKey } from '#imports';
// import type {DroppableItem} from './dragType'
export interface TabItem  {
    parent?:string
    initized?: boolean,
    [key:string]: any
}// tab panel container

export type TabPanel = {
    id: string
    size?: number,
    parent:string
    showingTabIndex?: number
    tabs: TabItem[]
}

interface TabManager {
    dialogOpened: Ref<boolean>,
    menuStick: Ref<boolean>
    closeDialog:() => void,
    openNewDialog:(args: any) => void
    openTab:(tab:TabItem) => void
    openInNewTab:(tab:TabItem) => void
    openInCurrentTab:(tab:TabItem) => void
    toggleMenuStick:() => void
}

interface TabComponentHelper {
    renameTab:(panelId:string, tabId:string, newName:string) => void
    
    tabDataKey:symbol
}

export const TabManagerKey: InjectionKey<TabManager> = Symbol('tabManager');
export const TabComponentKey: InjectionKey<TabComponentHelper> = Symbol('tabComponent');
