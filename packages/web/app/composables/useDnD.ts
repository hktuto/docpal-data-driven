import type {DragState, DroppableItemParam, DropTargtParams} from "#imports";
import {draggable, dropTargetForElements, monitorForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview'
import { pointerOutsideOfPreview } from '@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview'
import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types'
import type { CleanupFn } from "@atlaskit/pragmatic-drag-and-drop/dist/types/internal-types";
import { dropTargetForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter';
import { containsFiles, getFiles } from '@atlaskit/pragmatic-drag-and-drop/external/file';
import { containsText, getText } from '@atlaskit/pragmatic-drag-and-drop/external/text';


export type UseDraggableParam = {
    key:symbol,  
    dragData: DragData,
    detectDrop:boolean, 
    allowedEdges?:string[],
    onDragStart?:Function, 
    canDrag?:(args:any) => boolean,
    onDropItself?:(args:any) => void,
    canDrop?:({ source }:any) => boolean, 
    isSticky?:() => boolean, 
    onDragEnter?:Function, 
    onDragOver?:Function, 
    onDragLeave?:Function,
    onDropToOther?: Function,
    canDragToExternal?:boolean
    onDropFromExternal?: Function
}

export const useDragable = ({
    key,
    dragData,
    detectDrop,
    allowedEdges = ['left', 'right'],
    onDragStart,
    onDropItself,
    canDrop,
    canDrag,
    isSticky,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDropToOther,
    canDragToExternal = false,
    onDropFromExternal,
}:UseDraggableParam ) => {
    const idle: DragState = { type: "idle" };
    const dragState = ref<DragState>(idle)

    let cleanup = () => {}

    function setupDrag(element:HTMLElement) {
        if(!element) return; 
        cleanup = draggable({
            element,
            canDrag(args) {
              if(canDrag) return canDrag(args)
              return true
            },
            getInitialData(){
                return dragData
            },
            getInitialDataForExternal() {
                if((window as any).isDesktopMode) {
                    const dataAsString = JSON.stringify(dragData)
                    return {
                        ['text/plain']: dataAsString,
                    }
                } else {
                    return {
                        ['text/plain']: JSON.stringify(dragData),
                    }
                }
            },
            onGenerateDragPreview({ nativeSetDragImage }) {
                setCustomNativeDragPreview({
                    nativeSetDragImage,
                    getOffset: pointerOutsideOfPreview({
                        x: '16px',
                        y: '8px',
                    }),
                    render({ container }) {
                        dragState.value = { type: 'preview', container }
                    },
                })
            },
            onDragStart() {
                if(onDragStart) onDragStart()
                    console.log("onDragStart", element)
                    dragState.value = { type: 'is-dragging' }
            },
            onDrop(args) {
                if(onDropItself) onDropItself(args)
                dragState.value = idle
            },
        })
        if(detectDrop) {
            cleanup = combine(
                cleanup,
                createDropTargetForElements({
                    element,
                    dragData,
                    canDrop,
                    dragState,
                    allowedEdges,
                    isSticky,
                    onDragEnter,
                    onDragOver,
                    onDragLeave,
                    onDropToOther
                })
            )
        }
        if(canDragToExternal) {
            cleanup = combine(
                cleanup,
                dropTargetForExternal({
                    element,
                    canDrop({ source }) {
                        if(canDrop) return canDrop({ source })
                            return true
                    },
                    getIsSticky: () => true,
                    getData({input}) {
                        const edge = allowedEdges as Edge[]
                        return attachClosestEdge((dragData as any), {
                            element,
                            input,
                            allowedEdges:edge,
                        })
                    },
                    onDragEnter({self, location,source}) {
                        if(onDragEnter) onDragEnter()
                            // get mouse location in "location.current"
                        
                            // if mouse is near the top of the target, then we're dragging over the target
                        const closestEdge = extractClosestEdge(self.data)
                        dragState.value = { type: 'is-dragging-over', closestEdge }
                    },
                    onDrag({self, location,source}) {
                        if(onDragOver) onDragOver()
                        const mouse = location.current.input;
                        const targetRect = self.element.getBoundingClientRect();
                        const isCenter = (Math.abs(mouse.clientX - targetRect.left) > targetRect.width / 3) && (Math.abs(mouse.clientX - targetRect.right) > targetRect.width / 3);
                        if(isCenter) {
                            dragState.value = { type: 'is-dragging-over', closestEdge:'center' }
                            return;
                        }
                        
                        const closestEdge = extractClosestEdge(self.data)
                        // Only need to update react state if nothing has changed.
                        if (dragState.value.type !== 'is-dragging-over' || dragState.value.closestEdge !== closestEdge) {
                            dragState.value = { type: 'is-dragging-over', closestEdge }
                        }
                    },
                    onDragLeave(args) {
                        if(onDragLeave) onDragLeave()
                            console.log("external onDragLeave", args)
                        dragState.value = { type: "idle" }
                    },
                    onDrop(args) {
                        if(onDropFromExternal) onDropFromExternal(args)
                        const data = args.source.getStringData('text/plain')
                        dragState.value = { type: "idle" }
                    },
                })
            )
        }
    }
    onUnmounted(() => {
        cleanup()
    })

    return {
        extractClosestEdge,
        setupDrag,
        dragState
    }
}


export const useDropable = ({
    key,
    canMonitor = (arg:any) => true,
    onDropHandler,
    detectDrop = false,
    dragData,
    allowedEdges = ['left', 'right'],
    canDrop,
    isSticky,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDropToOther,
    dropExternal = false
}:DroppableItemParam) => {

    const idle: DragState = { type: "idle" };
    const dragState = ref<DragState>(idle)


    let cleanup = () => {}

    function setupDropable(element: HTMLElement) {
        
        cleanup = monitorForElements({
            canMonitor(arg:any) {
                return canMonitor(arg)
            },
            onDrop({ location, source }){
                const target:any = location.current.dropTargets[0]
                return onDropHandler({ location, source, target })
            }
        })
        if(detectDrop) {
            if(!element) return
            if(!dragData) {
                throw new Error('when detectDrop is true, dragData is required')
            }
            cleanup = combine(
                cleanup,
                createDropTargetForElements({
                    element,
                    dragData,
                    canDrop,
                    dragState,
                    allowedEdges,
                    isSticky,
                    onDragEnter,
                    onDragOver,
                    onDragLeave,
                    onDropToOther
                })
            )
        }
        if(dropExternal) {
            cleanup = combine(
                cleanup,
                dropTargetForExternal({
                    element,
                    getDropEffect: () => 'move',
                    canDrop({ source }) {
                        const data = source.getStringData('text/plain');
                        if(!data) return false
                        // TODO: check if data follow the format
                        return !!JSON.parse(data)
                    },
                    getData(data){
                        return {
                            data,
                            [key]:true
                        }
                    },
                    getIsSticky() {
                        if(isSticky) return isSticky()
                        return true
                    },
                    onDragEnter({self, location,source}) {
                        if(onDragEnter) onDragEnter()
                            // get mouse location in "location.current"
                        
                            // if mouse is near the top of the target, then we're dragging over the target
                        const closestEdge = extractClosestEdge(self.data)
                        dragState.value = { type: 'is-dragging-over', closestEdge }
                    },
                    onDrag({self, location,source}) {
                        if(onDragOver) onDragOver()
                        const mouse = location.current.input;
                        const targetRect = self.element.getBoundingClientRect();
                        const isCenter = (Math.abs(mouse.clientX - targetRect.left) > targetRect.width / 3) && (Math.abs(mouse.clientX - targetRect.right) > targetRect.width / 3);
                        if(isCenter) {
                            dragState.value = { type: 'is-dragging-over', closestEdge:'center' }
                            return;
                        }
                        console.log("External Drag")
                        const closestEdge = extractClosestEdge(self.data)
                        // Only need to update react state if nothing has changed.
                        if (dragState.value.type !== 'is-dragging-over' || dragState.value.closestEdge !== closestEdge) {
                            dragState.value = { type: 'is-dragging-over', closestEdge }
                        }
                    },
                    onDragLeave() {
                        if(onDragLeave) onDragLeave()
                        dragState.value = { type: "idle" }
                    },
                    onDrop() {
                        console.log('onDrop')
                        if(onDropToOther) onDropToOther()
                        dragState.value = { type: "idle" }
                    },
                })
            )
        }
    }

    onUnmounted(() => {
        cleanup()
    })
    return {
        extractClosestEdge,
        dragState,
        setupDropable
    }
}


function createDropTargetForElements({
    element,
    dragState,
    dragData,
    canDrop,
    allowedEdges = ['left', 'right'],
    isSticky,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDropToOther
}:DropTargtParams):CleanupFn{
    return dropTargetForElements({
        element,
        canDrop(args) {
            if (args.source.element === element) {
                return false
            }
            if(canDrop) return canDrop(args)
            return true
        },
        getData({input}) {
            const edges = allowedEdges as Edge[]
            return attachClosestEdge((dragData as any), {
                element,
                input,
                allowedEdges:edges,
            })
        },
        getIsSticky() {
            if(isSticky) return isSticky()
            return true
        },
        onDragEnter({self, location,source}) {
            if(onDragEnter) onDragEnter()
            console.log("drag enter", source)
                // get mouse location in "location.current"
            
                // if mouse is near the top of the target, then we're dragging over the target
            const closestEdge = extractClosestEdge(self.data)
            dragState.value = { type: 'is-dragging-over', closestEdge }
        },
        onDrag({self, location,source}) {
            if(onDragOver) onDragOver()
            const mouse = location.current.input;
            const targetRect = self.element.getBoundingClientRect();
            const isCenter = (Math.abs(mouse.clientX - targetRect.left) > targetRect.width / 3) && (Math.abs(mouse.clientX - targetRect.right) > targetRect.width / 3);
            if(isCenter) {
                dragState.value = { type: 'is-dragging-over', closestEdge:'center' }
                return;
            }
            
            const closestEdge = extractClosestEdge(self.data)
            // Only need to update react state if nothing has changed.
            if (dragState.value.type !== 'is-dragging-over' || dragState.value.closestEdge !== closestEdge) {
                dragState.value = { type: 'is-dragging-over', closestEdge }
            }
        },
        onDragLeave() {
            if(onDragLeave) onDragLeave()
            dragState.value = { type: "idle" }
        },
        onDrop(args) {
            if(onDropToOther) onDropToOther(args)
            dragState.value = { type: "idle" }
        },
    })
}
