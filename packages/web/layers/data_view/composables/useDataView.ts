import { onMounted, ref } from 'vue'
import { apiClient } from 'api-client'


export type tableSetting = {
  table_name: string,
 
}

export type Column = {
  column_name: string,
  display_name: string,
  data_type: string,
  column_type: string,
  can_sort: boolean,
  can_filter: boolean,
  filter_type: string,
  is_system: boolean,
  is_relation: boolean,
  relation_config: {
    relation_name: string,
    relation_type: string,
    target_table: string,
    target_column: string,
    display_columns: string[],
    display_template: string
  }
}

export const useDataView = (table_name: string) => {
  const columns = ref<Column[]>([])
  const permission  = ref();

  async function getTablePermission(){
    const userPermission = await apiClient.companies.getDataRecordPermissionTableName(table_name);
    permission.value = userPermission.data;
  }

  async function getTableColumns(){
    const tableColumns = await apiClient.companies.getDataSchemaTableName(table_name);
    columns.value = tableColumns.data?.columns || [];
  }

  const loading = ref(false);
  async function initSettings(){
    loading.value = true;
    await Promise.all([getTablePermission(), getTableColumns()]);
    loading.value = false;
  }

  onMounted(() => {
    initSettings();
  })

  return {
    columns,
    permission,
    loading,
    initSettings
  }
}