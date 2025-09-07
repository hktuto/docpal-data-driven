export { useEventBus } from "@vueuse/core";
import { useEventBus } from "@vueuse/core";
export enum EventType {

  // auth related
  USER_LOGIN__SUCCESS = 'user-login--success',
  USER_LOGIN__EXPIRE = 'user-login--expire',
  // user related
  USER_PREFERENCE_CHANGE__TIME = 'user-preference-change--time', // user preference changed
  // table related
  TABLE_CONTEXT_MENU_OPEN = 'table-context-menu-open', // open table action column dialog
  TABLE_CONTEXT_MENU_CLOSE = 'table-context-menu-close', // close table action column dialog
  TABLE_ZOOM_MAX = 'table-zoom-max', // zoom max
  TABLE_ZOOM_REVERT = 'table-zoom-revert', // zoom in

  // UI Related
  OPEN_SETTINGS = 'open-settings',
  CLOSE_SETTINGS = 'close-settings',
  // page refreshwe
  FILE_NEED_REFRESH = 'file-need-refresh',
  FILE_DELETED = 'FILE_DELETED',
  FILE_PREVIEW_OPEN = 'file-preview-open',
  FILE_PREVIEW_CLOSE = 'file-preview-close',
  CASE_NEED_REFRESH = 'case-need-refresh',
  FILE_CLEAN_SELECTED_ROWS = 'file-clean-selected-rows'
}

export enum GlobalPasteEvent {
  TAB_COPY_PATH = 'tab-copy-path',
  TAB_PASTE_PATH = 'tab-paste-path',
}

export type GlobalPasteItem = {
  type: GlobalPasteEvent,
  data: any;
};


export function emitBus(key: EventType, ...args: any) {
  const bus = useEventBus(key);
  bus.emit(...args);
}
