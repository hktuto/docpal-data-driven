import type { VxeGridProps, VxeGridListeners, VxeGridPropTypes, VxeTableDefines, VxeTablePropTypes, VxeGridInstance, VxeGridDefines } from 'vxe-table'


export type TABLE_CONTEXT_PARAMS = {
  row:any,
  column:any,
  rowIndex:number,
  options:TableMenuActions[][],
  event:MouseEvent
}

export type TableActionsParams = {
  row: any
}
export interface TableMenuActions extends VxeTableDefines.MenuChildOption {
  name: string
  children?: TableMenuActions[]
  action?: (params: TableActionsParams) => void
}
export type TableMenuValidateMethodParams = {
  type?: string
  options: TableMenuActions[][]
  columns: VxeGridPropTypes.Columns
  row?: any
  rowIndex?: number
  column?: VxeTableDefines.ColumnInfo
  columnIndex?: number
  event?: MouseEvent
}
export type TableMenuValidataMethod = (params: TableMenuValidateMethodParams) => TableMenuActions[][]
