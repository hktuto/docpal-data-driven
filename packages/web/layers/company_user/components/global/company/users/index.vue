<template>
  <AppPageContainer>
    <DataViewTableManager ref="dataViewTableManagerRef" tableName="user_profiles" @create-entry="handleCreateEntry" />
    <NewUserDialog ref="newUserDialogRef" @userCreated="handleUserCreated" />
  </AppPageContainer>
</template>

<script lang="ts" setup>
import { apiClient } from 'api-client'
import { useVxeTable } from '@/composables/useVxeTable'
import NewUserDialog from '../../../company/newUserDialog.vue'
import type { DataViewTableManager } from '#components'
const newUserDialogRef = useTemplateRef<InstanceType<typeof NewUserDialog>>('newUserDialogRef')
const dataViewTableManagerRef = useTemplateRef<InstanceType<typeof DataViewTableManager>>('dataViewTableManagerRef')
function handleCreateEntry() {
  newUserDialogRef.value?.open();
}

function handleUserCreated() {
  dataViewTableManagerRef.value?.reloadData();
}

</script>

