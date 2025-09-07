
import {GlobalPasteEvent, useEventBus, EventType} from 'eventbus';

type AppSlot = {
    name: string,
    order: number,
    show?: boolean,
    component: any
}
export const useDesktopMode = () => useState<boolean>('is-desktop')
export const useDisplayTimeFormat = () => useState('display-time-format', () => 'YYYY-MM-DD')

export const useGlobalComponents = () => useState('global-components', () => shallowRef<AppSlot[]>([]))

export const useLastClipboard = () => useState('last-clipboard', () => '')

export const useGlobalSetting = () => {
    const lastClipboard = useLastClipboard()
    const globalSlots = useGlobalComponents()
    const isDesktopMode = useDesktopMode()
        // global bus event 
    const fontSizeBus = useEventBus<string>(EventType.USER_PREFERENCE_CHANGE__TIME)

    function handleDocumentFocus() {
        checkClicpBoard()
    }
    async function checkClicpBoard(){
        // check document is focused
        if(!document.hasFocus()) return
        const clipboardText = await navigator.clipboard.readText()
        // make sure clipboard function only run once on each clipboard text
        if(clipboardText === lastClipboard.value) {
            return
        }
        lastClipboard.value = clipboardText
        // check clipboardText is valid json
        try {
            // check if clipboardText is a url and the origin is same as current page
            // if url is not valid, throw error
            await decodeUrlActions(clipboardText)
            //  check if url is same as current page
            
        } catch (error) {
            // do nothing
        }
    }

    async function decodeUrlActions(url:string) {
        const newUrl = new URL(url)
        if(newUrl.origin !== location.origin) {
            throw new Error('Invalid URL')
        }
        // get actions from query string
        const actions = newUrl.searchParams.get('actions')
        if(!actions) return
        const clipboardData = JSON.parse(atob(actions))
        // check clipboardData.type is include in GlobalPasteEvent
        if(Object.values(GlobalPasteEvent).includes(clipboardData.type)){
            console.log(clipboardData.type)
            const bus = useEventBus(clipboardData.type)
            navigator.clipboard.writeText("")
            bus.emit(clipboardData.data)
        }
        // clean up url
        const route = useRoute()
        route.query = {}
    }

    function handleTimeSettingChange(newValue:string) {
        if(!newValue) {
            newValue = 'YYYY-MM-DD'
        }
        const displayTimeFormat = useDisplayTimeFormat()
        displayTimeFormat.value = newValue
    }
    fontSizeBus.on(handleTimeSettingChange)

    onUnmounted(() => {
        fontSizeBus.off(handleTimeSettingChange)
        // document.removeEventListener('focus', handleDocumentFocus, true);
    })

    onMounted(() => {
        window.onfocus = handleDocumentFocus;
        isDesktopMode.value = !(!window || !window.navigator || !window.navigator.userAgent || !window.navigator.userAgent.toLowerCase().includes('electron'))
        checkClicpBoard();
    } )

    return {
        globalSlots
    }

}



