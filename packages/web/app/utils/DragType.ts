
/**
 * 所布可以 drop 物件的最小單位
 */
export interface DroppableItem {
    id:string, // unique id
    name:string, // usally the funcion name and params of the component , use this to check if the component is the same
    icon?:string,
    label:string,
    component: string,
    handleError?: boolean, // is true page not handout error
    props?: Record<string, any>
}

export interface DragData extends Record<string,any> {
    key: symbol,
    data: DroppableItem
}

export type DragState = | {
    type: "idle";
}
| {
    type: "preview";
    container: HTMLElement;
}
| {
    type: "is-dragging";
}
| {
    type: "is-dragging-over";
    closestEdge: string | null;
};



export type DroppableItemParam = {
    key:symbol,
    canMonitor:({ source }:any) => boolean,
    onDropHandler:({ location, source, target }:any) => void,
    allowDropKeys?: symbol[], // 那個 symbol 可以的 drop 事件可以 trigger
    detectDrop?:boolean,
    allowedEdges?:string[],
    dragData?: DragData
    canDrop?:({ source }:any) => boolean, 
    isSticky?:() => boolean, 
    onDragEnter?:Function, 
    onDragOver?:Function, 
    onDragLeave?:Function,
    onDropToOther?: Function
    dropExternal?:boolean
}

export type DropTargtParams =  {
    element:HTMLElement,
    dragState: any,
    canDrop?:({ source }:any) => boolean,
    dragData: DragData,
    allowedEdges: string[],
    isSticky?:() => boolean, 
    onDragEnter?:Function, 
    onDragOver?:Function, 
    onDragLeave?:Function,
    onDropToOther?: Function
}

