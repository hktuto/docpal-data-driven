<template>
  <AppPageContainer>
    <VxeGrid ref="tableRef" v-bind="tableConfig"  v-on="tableEvent" >
      <template #toolbar_buttons>
        <div class="actions">
          <VxeButton @click="handleCreate">Create Schema</VxeButton>
        </div>
      </template>
    </VxeGrid>
    
    <!-- Create Schema Dialog -->
    <CustomDataCreateSchemaDialog 
      ref="createSchemaDialogRef" 
      @schema-created="handleSchemaCreated"
      @dialog-closed="handleDialogClosed"
    />
  </AppPageContainer>
</template>

<script lang="ts" setup>
import {useVxeTable, MenuRouterKey } from '#imports'
import { apiClient} from 'api-client'
import { ElMessage } from 'element-plus'

const createSchemaDialogRef = ref()
const routerProvider = inject(MenuRouterKey)
if(!routerProvider) {
  throw new Error('routerProvider is not provided')
}
function handleCreate() {
  createSchemaDialogRef.value?.open()
}

function handleSchemaCreated(schema: any) {
  console.log('Schema created:', schema)
  // Refresh the table to show the new schema
  // tableRef.value?.commitProxy('reload')
  ElMessage.success(`Schema "${schema.label}" created successfully!`)
  const detailRoute = {
    id: 'schema-detail' + schema.slug,
    label: schema.label,
    component: 'CustomDataDetail',
    props:{
      ...schema
    }
  }
  routerProvider?.navigateTo(detailRoute)
}

function handleDialogClosed() {
  console.log('Dialog closed')
}

const { tableConfig, tableEvent, tableRef} = useVxeTable({
  id: 'custom_data',
  api: async(params:any) => {
    const data = await apiClient.schemas.get()
    console.log(data)
    return data
  },
  virtualScroll: true,
  columns:[
    {
      field: "slug",
      title: "Slug",
      width: 200
    },
    {
      field: "label",
      title: "Label",
      minWidth: 150
    },
    {
      field: "description",
      title: "Description",
      minWidth: 200
    },
    {
      field: "created_at",
      title: "Created At",
      width: 180,
      formatter: 'formatDate'
    },
    {
      field: "updated_at",
      title: "Updated At",
      width: 180,
      formatter: 'formatDate'
    }
  ]
})
</script>

