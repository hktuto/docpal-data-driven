<template>
  <AppPageContainer>
    detail
  </AppPageContainer>
</template>


<script lang="ts" setup>

const props = defineProps<{
  slug: string // table slug
}>()

async function initViews(){
  if(!props.slug) {
    throw new Error('slug is required')
  }

  // get column from api
  // get views from api

}

onMounted(() => {
  initViews()
})


</script>