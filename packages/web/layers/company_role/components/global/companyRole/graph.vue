<template>
  <AppPageContainer>
      {{ graphData }}    
  </AppPageContainer>
</template>

<script lang="ts" setup>
import { ref, onMounted } from '#imports';
import { apiClient } from 'api-client';
const graphData = ref<any[]>([])

async function getGraph() {
  const data = await apiClient.companies.postDataRecordsTablenameQuerytree("roles",{
    select: ['id', "name", "parent_id"],
    parentColumn: "parent_id",
    includeChildren: true,
    maxDepth: 5
  })
  if(!data) {
    throw new Error('No data')
  }
  graphData.value = data.data
}

onMounted(() => {
  getGraph()
})

</script>

