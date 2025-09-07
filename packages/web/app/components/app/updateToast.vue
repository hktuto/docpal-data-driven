<script setup lang="ts">
import { ElNotification } from 'element-plus'
const nuxtApp = useNuxtApp()
const { t } = useI18n()
const config = useRuntimeConfig()
const toastShow = ref(false);
// app:manifest:update'
nuxtApp.hooks.hookOnce('app:manifest:update', () => {
  setTimeout(() => {
    showUpdateToast()
  }, (config?.public?.updateInterval as number) || 300000)
})


function showUpdateToast() {
  if (toastShow.value) return;
  toastShow.value = true;
  ElNotification({
    title: t('appVersionUpdate.title'),
    dangerouslyUseHTMLString: true,
    message: `<strong>${t('appVersionUpdate.title')}</strong><br/><button class="el-button el-button--primary" onclick="window.location.reload()">${t('appVersionUpdate.button')}</button>`,
    duration: 0,
  })
}




</script>

<template>
</template>
