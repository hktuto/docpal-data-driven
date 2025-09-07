
export function getActionMaxWidth(actions:TableMenuActions[]):number{
    return actions.reduce((max:number, curr:TableMenuActions) => {
        if(curr.visible === false) return max
        const itemWidth = curr.name.length * 6 + 12 // 16 is the width of each character
        if(itemWidth > max) return itemWidth
        return max
    }, 0)
}

export function getRootActionMaxHeight(actions:TableMenuActions[][], menuItemHeight:number):number{
    return actions.reduce((total:number, curr:TableMenuActions[]) => {
        // NOTED : if all actions are disabled, the total height will be 0
        return total + curr.filter(item => !item.disabled).length * menuItemHeight
    },0)
}


export function getChildActionMaxHeight(actions:TableMenuActions[], menuItemHeight:number):number{
    return actions.reduce((total:number, curr:TableMenuActions) => {
        if(!curr.children || curr.children.length === 0 || curr.disabled) return total
        return total + curr.children.length * menuItemHeight
    },0)
}


interface ContextmenuList {
    selectedItem: Ref<TableMenuActions | undefined>
    selectItem: (item?:TableMenuActions) => void
}

export const ContextmenuListKey : InjectionKey<ContextmenuList> = Symbol('contextmenuList')