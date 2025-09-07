import { useEventBus, EventType, emitBus } from 'eventbus'

import type { VxeGridProps, VxeGridListeners, VxeGridPropTypes, VxeTableDefines, VxeTablePropTypes, VxeGridInstance, VxeGridDefines } from 'vxe-table'

import type { TableMenuActions, TABLE_CONTEXT_PARAMS } from '../utils/tableType'

export interface UseVxeTableParams<R = any> {
  id: string
  height?: string // 'auto' | number
  api?: Function
  remoteSort?: boolean
  remoteFilter?: boolean
  customeToolBar?: boolean
  defaultSort?: { field: string; order: VxeTablePropTypes.SortOrder }[]
  columns: VxeGridPropTypes.Columns<R>
  saveColumnOrder?: boolean
  virtualScroll?: boolean
  pageSize?: number
  refresh?: boolean
  zoom?: boolean
  dblClickAction?: ({ row, column, event }: any) => void
  headerActions?: TableMenuActions[][]
  footerActions?: TableMenuActions[][]
  bodyActions?: TableMenuActions[][]
  permissionMethod?: (params: PermissionMethodParams) => { visible: boolean; disabled: boolean }
  optionalConfig?: VxeGridProps<R>
  selectChangeHander?: (selectedRows: any[], selectedRow?: any) => void
  optionalEvent?: VxeGridListeners<R>
  childChangeHandler?: (childRows: any[]) => void
  additionalPermission?: (params: any) => Promise<any>
}

export type PermissionMethodParams = { row: any; code?: string; rowIndex?: number; additionalData?: any }

interface Config extends VxeGridProps {
  proxyConfig: VxeGridPropTypes.ProxyConfig
  data: any[]
  menuConfig: {
    header: VxeTableDefines.MenuOptions
    body: VxeTableDefines.MenuOptions
    footer: VxeTableDefines.MenuOptions
  }
}

export const useVxeTable = (params: UseVxeTableParams) => {
  // set Defalut value for params
  const {
    optionalConfig = {},
    optionalEvent = {},
    saveColumnOrder = true,
    columns = [],
    zoom = true,
    refresh = true,
    permissionMethod = () => {
      return { visible: true, disabled: false }
    },
    bodyActions: actions = [],
    selectChangeHander = () => {
      console.log('defauilt selectChangeHander, please implement')
    }
  } = params

  const tableRef = ref<VxeGridInstance<any>>()

  const tableData = ref<any>([])
  const tablePageParams = ref<any>({
    currentPage: 1,
    pageSize: 20,
    total: 0
  })
  const init = ref(false)

  const tableConfig = reactive<any>({
    ...{
      id: params.id,
      border: true,
      round: true,
      stripe: true,
      showOverflow: true,
      showHeaderOverflow: true,
      height: params.height || 'auto',
      toolbarConfig: {
        custom: saveColumnOrder,
        zoom,
        refresh,
        slots: {
          buttons: 'toolbar_buttons'
        }
      },
      class: params.id,
      columns: (columns || []).map((col) => {
        if (!col.width && !col.minWidth) {
          col.minWidth = '200px'
        }
        return col
      }),
      columnConfig: {
        resizable: true,
        useKey: true,
        drag: true
      },
      scrollY: {
        enabled: params.virtualScroll || false
      },
      pagerConfig: {
        enabled: params.virtualScroll ? false : true,
        // pageSize : params.pageSize || 20
        pageSize: getPageSize(params.id)
      },
      customConfig: {
        enabled: saveColumnOrder,
        storage: saveColumnOrder,
        restoreStore({ id }) {
          // TODO : implement restoreStore
          // try {
          //   // @ts-ignore
          //   const perference = useUserPreference()
          //   if (perference.value && perference.value.tableSettings && perference.value.tableSettings[id]) {
          //     return perference.value.tableSettings[id]
          //   }
          // } catch (error) {}
        },
        updateStore({ id, storeData }) {
          // TODO : move useUserPreference to a composable to store and cache tabel config
          // try {
          //   // @ts-ignore
          //   const perference = useUserPreference()
          //   if (!perference.value.tableSettings) perference.value.tableSettings = {}
          //   perference.value.tableSettings[id] = storeData
          //   // save perference
          //   return clientApi.api.putUserSetting(perference.value)
          // } catch (error) {}
        }
      },
      sortConfig: {
        remote: params.remoteSort || false,
        defaultSort: params.defaultSort || []
      },
      proxyConfig: {
        enabled: !!params.api ? true : false,
        sort: params.remoteSort || false,
        filter: params.remoteFilter || false,
        ajax: {
          query: loadData
        }
      },
      menuConfig: {
        header: {
          options: params.headerActions || []
        },
        body: {
          options: actions || []
        },
        footer: {
          options: params.footerActions || []
        },
        className: 'contextMenuContainer',
        visibleMethod: async ({ options, column, row, rowIndex }: TableMenuValidateMethodParams) => {
          let additionalData: any
          if (params.additionalPermission) {
            additionalData = await params.additionalPermission({ column, row, rowIndex })
          }
          options.forEach((list) => {
            list.forEach((item) => {
              if (item.children) {
                // loop all children , and set visible and disabled
                // if all children are not visible , set iten.visible = false
                // if all children are disabled , set item.disabled = true

                item.children.forEach((child) => {
                  const { visible, disabled } = permissionMethod({ row, rowIndex, code: child.code, additionalData })
                  child.visible = visible
                  child.disabled = disabled
                })
                const allVisible = item.children.every((child) => child.visible)
                const allDisabled = item.children.every((child) => child.disabled)
                item.visible = allVisible
                item.disabled = allDisabled
              } else {
                const { visible, disabled } = permissionMethod({ row, rowIndex, code: item.code, additionalData })
                item.visible = visible
                item.disabled = disabled
              }
            })
          })
          return options
        }
      },
      rowConfig: {
        useKey: true
      },
      data: []
    },
    ...optionalConfig
  } as Config)
  const tableEvent = reactive<VxeGridListeners>({ ...optionalEvent })

  if (params.customeToolBar) {
    tableConfig.toolbarConfig.slots.tools = 'toolbarTools'
  }

  // #region handle actions column
  // Step 1: add actions to tableEvent
  if (params.dblClickAction) {
    tableEvent.cellDblclick = params.dblClickAction
  }
  tableEvent.zoom = ({ type }) => {
    if (type === 'max') {
      emitBus(EventType.TABLE_ZOOM_MAX)
    } else if (type === 'revert') {
      emitBus(EventType.TABLE_ZOOM_REVERT)
    }
  }
  // Step 2: handle body actions
  if (actions && actions.length > 0) {
    tableEvent.menuClick = ({ menu, row, column }: any) => {
      if (menu.action) {
        menu.action({ menu, row, column })
      }
    }
    tableConfig.menuConfig.body.options = actions
    // add column to tableConfig
    const actionsColumn: any = {
      title: 'dpTable_actions',
      fixed: 'right',
      width: 80,
      type: 'html',
      formatter: ({ row }: any) => {
        return `<img src="/icons/dots.svg" style="width: 1.2rem; height: 1.2rem; cursor: pointer;" />`
      }
    }
    if (!tableConfig.columns || tableConfig.columns.length === 0) {
      tableConfig.columns = [actionsColumn]
    } else {
      tableConfig.columns.push(actionsColumn)
    }
    // add click event to action column
    tableEvent.cellClick = async ({
      row,
      rowIndex,
      $rowIndex,
      column,
      columnIndex,
      $columnIndex,
      triggerRadio,
      triggerCheckbox,
      triggerTreeNode,
      triggerExpandNode,
      $event,
      $grid,
      $table,
      cell
    }: any) => {
      if (column.type === actionsColumn.type && column.title === actionsColumn.title) {
        if (!actions) {
          throw new Error('bodyActions is required')
        }
        if (!columns) {
          throw new Error('columns is required')
        }
        const bus = useEventBus(EventType.TABLE_CONTEXT_MENU_OPEN)
        let additionalData: any
        if (params.additionalPermission) {
          additionalData = await params.additionalPermission({ column, row, rowIndex })
        }
        const options = actions.map((list) => {
          return list.map((item) => {
            if (item.children) {
              // loop all children , and set visible and disabled
              // if all children are not visible , set iten.visible = false
              // if all children are disabled , set item.disabled = true
              item.children.forEach((child) => {
                const { visible, disabled } = permissionMethod({ row, rowIndex, code: child.code, additionalData })
                child.visible = visible
                child.disabled = disabled
              })
              const allVisible = item.children.every((child) => child.visible)
              const allDisabled = item.children.every((child) => child.disabled)
              item.visible = allVisible
              item.disabled = allDisabled
            } else {
              const { visible, disabled } = permissionMethod({ row, rowIndex, code: item.code, additionalData })
              item.visible = visible
              item.disabled = disabled
            }
            return item
          })
        })
        const evtParams: TABLE_CONTEXT_PARAMS = {
          row,
          column,
          rowIndex,
          options,
          event: $event
        }
        bus.emit(evtParams)
      }
      if (optionalEvent?.cellClick && typeof optionalEvent.cellClick === 'function') {
        optionalEvent.cellClick({
          row,
          rowIndex,
          $rowIndex,
          column,
          columnIndex,
          $columnIndex,
          triggerRadio,
          triggerCheckbox,
          triggerTreeNode,
          triggerExpandNode,
          $event,
          $grid,
          $table,
          cell,
          $gantt: undefined
        }) as any
      }
    }
    tableEvent.scroll = (scrollParams: VxeGridDefines.ScrollEventParams) => {
      const bus = useEventBus(EventType.TABLE_CONTEXT_MENU_CLOSE)
      bus.emit()
    }
  }
  // Step 3: handle header actions
  if (params.headerActions && params.headerActions.length > 0) {
    tableConfig.menuConfig.header.options = params.headerActions
  }
  // Step 4: handle footer actions
  if (params.footerActions && params.footerActions.length > 0) {
    tableConfig.menuConfig.footer.options = params.footerActions
  }

  // #endregion

  // #region handle checkbox column
  if (columns.find((item) => item.type === 'checkbox')) {
    const item = columns.find((item) => item.type === 'checkbox')
    if (item && !tableConfig.checkboxConfig) {
      tableConfig.checkboxConfig = {
        labelField: item.field,
        highlight: true,
        range: true
      }
    }

    tableEvent.checkboxChange = ({ checked, row, rowIndex, $rowIndex, column, columnIndex, $columnIndex, $event }: any) => {
      const selectedRows = tableRef.value?.getCheckboxRecords() || []
      console.log('checkboxChange', selectedRows)
      selectChangeHander(selectedRows, { checked, row, rowIndex })
    }
    tableEvent.checkboxRangeChange = ({ $event }: any) => {
      const selectedRows = tableRef.value?.getCheckboxRecords() || []
      selectChangeHander(selectedRows)
    }
    tableEvent.checkboxAll = ({ $event, checked }: any) => {
      const selectedRows = tableRef.value?.getCheckboxRecords() || []
      selectChangeHander(selectedRows)
    }
  }

  function cleanSelectedRows() {
    tableRef.value?.clearCheckboxRow()
    selectChangeHander([])
  }
  // #endregion

  async function loadData(args: any) {
    if (!params?.api) {
      throw new Error('params.api is required')
    }
    if (params.virtualScroll) {
      init.value = true
      return await params?.api(args)
    }
    const { page, sorts, filters } = args
    // 默认接收 Promise<{ result: [], page: { total: 100 } }>
    let pageParams: any = {
      pageSize: page.pageSize,
      pageNum: page.currentPage - 1
    }
    if (sorts && sorts.length > 0) {
      pageParams.orderBy = sorts[0].property
      pageParams.isDesc = sorts[0].order === 'desc'
    }
    if (filters && filters.length > 0) {
      if (!pageParams.filter) pageParams.filter = {}
      filters.forEach((filter: any) => {
        pageParams.filter[filter.property] = filter.datas.join(',')
      })
    }
    const { data } = await params?.api(pageParams)
    init.value = true
    return {
      result: Array.isArray(data) ? data : data.entryList,
      page: {
        total: data.totalSize
      }
    }
  }
  async function responsiveScrollHandler({ scrollTop, direction }: VxeGridDefines.ScrollEventParams) {
    if (params.virtualScroll || !params.api ) {
      return
    }
    // 不是 virtualScroll 或者 api 或者 大于 mobile 的时候不处理 scroll
    if (direction === 'bottom') {
      // 向下滚动
      await lazyLoad()
    }
  }

  async function lazyLoad() {
    console.log('lazyLoad')
    if (tablePageParams.value.total && tablePageParams.value.total === tableConfig.data.length) {
      console.log('no more data')
      return
    }
    tableConfig.loading = true
    const data = await loadData({
      page: tablePageParams.value,
      sorts: [], // TODO : get sorts from config
      filters: [] // TODO : get filters from config
    })
    tableConfig.data.push(...data.result)
    tablePageParams.value.total = data.page.total
    tablePageParams.value.currentPage += 1
    tableConfig.loading = false
    console.log('data', tablePageParams)
  }

  function setupPagingnation() {
    tableConfig.pagerConfig = {
      enabled: params.virtualScroll ? false : true,
      pageSize: params.pageSize || 20
    }
    // tableConfig.proxyConfig.enabled = true;
  }
  function setupLazyLoad() {
    tableConfig.pagerConfig = {
      enabled: false
    }
    tableConfig.proxyConfig.enabled = false
    if (!tableEvent.scrollBoundary) {
      tableEvent.scrollBoundary = (scrollParams: VxeGridDefines.ScrollEventParams) => {
        responsiveScrollHandler(scrollParams)
      }
    }
    // @ts-ignore
    tableConfig.scrollY = {
      enabled: true,
      threshold: params.pageSize || 20
    }
    tableConfig.data = []
    tablePageParams.value.pageNum = 0
    tablePageParams.value.total = undefined
    tablePageParams.value.pageSize = params.pageSize || 20
    lazyLoad()
  }

  // watch(viewport.breakpoint, (newBreakpoint, oldBreakpoint) => {
  //     if(viewport.isLessThan('tablet')){
  //         // 如果不是 virtualScroll,
  //         if(!params.virtualScroll && params.api) {
  //             setupLazyLoad()
  //         }
  //         // mobile setting for table
  //         return
  //     }
  //     if(viewport.isGreaterThan('mobile')){
  //         // desktop setting for table
  //         setupPagingnation()
  //         tablePageParams.value = {
  //             currentPage: 1,
  //             pageSize: params.pageSize || 20,
  //             total:undefined,
  //         }
  //         // reload()
  //         return
  //     }
  // }, {
  //     immediate: true
  // })

  function reload() {
    // if virtualScroll is true, then reload the table
    if (!params.virtualScroll) {
      tableRef.value?.commitProxy('reload')
      return
    } else {
      tableRef.value?.loadData([]);
      nextTick(() => {
        tableRef.value?.commitProxy('reload')
      })
    }
  }

  function query(params: any) {
    tableRef.value?.commitProxy('query', params)
  }
  let observer: any
  function tableActivated() {
    if (init.value) {
      reload()
    }
    if (params.childChangeHandler) {
      if (observer && observer.disconnect) {
        observer.disconnect()
      }
      observer = new MutationObserver(params.childChangeHandler)
      if (tableRef.value && tableRef.value.$el) {
        observer.observe(tableRef.value.$el, {
          childList: true,
          subtree: true
        })
      }
      nextTick(() => {
        console.log('init table observer')
        if (typeof params.childChangeHandler === 'function') {
          params.childChangeHandler(observer);
        }
      })
    }
  }
  onMounted(tableActivated)
  onActivated(tableActivated)
  onUnmounted(() => {
    if (observer && observer.disconnect) {
      observer.disconnect()
    }
  })
  onDeactivated(() => {
    if (observer && observer.disconnect) {
      observer.disconnect()
    }
  })
  //
  if (!params.virtualScroll) {
    tableEvent.pageChange = ({ pageSize }) => {
      // TODO : implement getPageSize from user preference
      // try {
      //   if (!params.id) {
      //     throw new Error('table Id is null')
      //   }
      //   const tableSetting = (useUserPreference().value.tableSettings[params.id] ||= {})
      //   tableSetting.tablePageSize = pageSize
      //   const data = {
      //     id: params.id,
      //     storeData: tableSetting
      //   }
      //   tableConfig.customConfig.updateStore(data)
      // } catch (e) {
      //   console.error(e)
      // }
    }
  }

  return {
    tableConfig,
    tableEvent,
    tableRef,
    cleanSelectedRows,
    reload,
    query
  }
}

function getPageSize(id: string) {
  try {
    // TODO : implement getPageSize from user preference
    return 20
  } catch (error) {
    console.error(error)
    return 20
  }
}
