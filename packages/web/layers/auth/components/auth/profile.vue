<template>
  <div class="user-profile">
    <div class="avatar-container" :class="{ 'editable': editable }">
      <img 
        v-if="userProfile?.avatar" 
        :src="apiUrl + '/companies/file/download/' + userProfile.avatar" 
        :alt="userProfile?.first_name + ' ' + userProfile?.last_name || 'User Avatar'"
        class="avatar-image"
        @click="handleAvatarClick"
      />
      <div v-else class="avatar-placeholder" @click="handleAvatarClick">
        <ElIcon size="large">
          <User />
        </ElIcon>
      </div>
      
      <input 
        v-if="editable"
        ref="fileInput"
        type="file" 
        accept="image/*"
        class="file-input"
        @change="handleFileChange"
      />
      
      <div v-if="editable" class="edit-overlay">
        <ElIcon>
          <Camera />
        </ElIcon>
      </div>
    </div>
    
    <div v-if="userProfile?.first_name && userProfile?.last_name" class="user-info">
      <h3 class="user-name">{{ userProfile.first_name + ' ' + userProfile.last_name }}</h3>
    </div>
  </div>
</template>

<script setup lang="ts">
import {useRuntimeConfig} from '#imports'
import { ref } from 'vue'
import { apiClient } from 'api-client'

const {public:{apiUrl}} = useRuntimeConfig()
interface UserProfile {
  id: string
  first_name?: string
  last_name?: string
  phone_number?: string
  locale?: string
  avatar?: string
}

interface Props {
  userProfile: UserProfile
  editable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  editable: false
})

const emit = defineEmits(['avatarUpdate'])

const fileInput = ref<HTMLInputElement>()

const handleAvatarClick = () => {
  if (props.editable && fileInput.value) {
    fileInput.value.click()
  }
}

async function handleFileChange (event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (file) {
    emit('avatarUpdate', file)

    const res = await apiClient.companies.postFileUpload({
      file: file,
      table: 'user_profiles',
      row: props.userProfile.id,
      column: 'avatar'
    })
    // Reset the input value to allow selecting the same file again
    
  }
}
</script>

<style scoped lang="scss">
.user-profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--app-space-m);
  padding: var(--app-space-m);
}

.avatar-container {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--app-grey-300);
  transition: all 0.3s ease;
  
  &.editable {
    cursor: pointer;
    
    &:hover {
      border-color: var(--el-color-primary);
      transform: scale(1.05);
      
      .edit-overlay {
        opacity: 1;
      }
    }
  }
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--app-grey-100);
  color: var(--app-grey-500);
}

.file-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 2;
}

.edit-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 1;
  
  .el-icon {
    color: white;
    font-size: 24px;
  }
}

.user-info {
  text-align: center;
}

.user-name {
  margin: 0 0 var(--app-space-xs) 0;
  font-size: var(--app-font-size-l);
  font-weight: 600;
  color: var(--app-text-primary);
}

.user-email {
  margin: 0;
  font-size: var(--app-font-size-s);
  color: var(--app-text-secondary);
}
</style>