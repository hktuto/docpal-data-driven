<template>
  <AppPageContainer>
    <VxeGrid ref="tableRef" v-bind="tableConfig"  v-on="tableEvent" >
      <template #toolbar_buttons>
        <div class="actions">
          <VxeButton @click="handleCreate">Create</VxeButton>
        </div>
      </template>
    </VxeGrid>
  </AppPageContainer>
</template>

<script lang="ts" setup>
import {useVxeTable } from '#imports'
import { apiClient} from 'api-client'

function handleCreate() {
  console.log('handleCreate')
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
      field: "name",
      title: "Name"
    },
    {
      field: "id",
      title: "ID"
    }
  ]
})
</script>

