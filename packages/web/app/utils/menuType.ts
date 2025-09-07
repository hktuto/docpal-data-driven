import type { InjectionKey } from "vue"
import type { DroppableItem } from './DragType'


export interface MenuItem extends DroppableItem {
    icon: string, // 如果是 inlineRender 會忽略
    hoverIcon?: string, // 如果是 inlineRender 會忽略
    isList?:boolean, // 如果是 true 則直接在 menu 中渲染component, 多用於 children 裡的列表
    inlineRender?:boolean, // 如果是 true 則直接在 menu 中渲染component, 多用於 children 裡的列表
    children?: MenuItem[], 
    canDrop: (args:any) => boolean,
    onDropItself?:(args:any) => void,
    // 如果 isList 是 true 時必填
}

export interface RouterParams extends DroppableItem {
    menuKey?:symbol,
}


interface MenuProvider {
    navigateTo: (param:any, openInNewTab?:boolean, ignoreExist?:boolean) => void,
    updateProps(newProps:any):void
    updateTabName(newName:string):void
    routerContainer: Ref<HTMLElement | null>,
    back: (fallbackItem?:TabItem) => void,
    getHistory:() => RouterParams[],
    refeshActions: Ref<Function[]>,
    addToHistory:(param:RouterParams) => void,
    message:{
        success: (...args: any[]) => void,
        error: (...args: any[]) => void,
        warning: (...args: any[]) => void,
        info: (...args: any[]) => void,
        loading: (...args: any[]) => void
    },
    notification:{
        success: (...args: any[]) => void,
        error: (...args: any[]) => void,
        warning: (...args: any[]) => void,
        info: (...args: any[]) => void,
        loading: (...args: any[]) => void
    },
    tabData: Ref<TabItem>
}

export const menuSymbol = Symbol('menu')
export const menuKey = Symbol('menu');
export const MenuRouterKey: InjectionKey<MenuProvider> = menuSymbol;


export type PageSetting = {
    id: string, // id with unique time stamp
    name: string, // name to check if tag is exist
    label: string, // label to show in menu
    icon: string, // icon to show in menu
    hoverIcon?: string, // hover icon to show in menu
    component: string, // component to show in menu
    props: {
        [key:string]:any
    }, // props to pass to component
    createRouterParams: (params:any) => RouterParams
}
