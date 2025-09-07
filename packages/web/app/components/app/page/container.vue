<template>
  <div class="pageContainer">
    <slot />
  </div>
</template>

<script setup lang="ts">

</script>

<style lang="scss" scoped>
.pageContainer{
  padding: var(--app-space-m);
  width: 100%;
  height: 100%;
  overflow: auto;
}

</style>