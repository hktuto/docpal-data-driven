<template>
  <div class="user-profile">
    <div class="avatar-container" :class="{ 'editable': editable }">
      <img 
        v-if="userProfile?.preferences?.avatar" 
        :src="apiUrl + '/api/files/' + userProfile.preferences.avatar" 
        :alt="userProfile?.name || 'User Avatar'"
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
    
    <div v-if="userProfile?.name" class="user-info">
      <h3 class="user-name">{{ userProfile.name }}</h3>
      <p v-if="userProfile?.email" class="user-email">{{ userProfile.email }}</p>
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
  name: string
  email: string
  phone: string
  address: string
  city: string
  preferences: {
    avatar: string
    locale: string
  }
  created_at: Date
  updated_at: Date
  created_by: string
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
    
    // Create FormData for file upload
    const formData = new FormData()
    formData.append('file', file)
    formData.append('table', 'user_profile')
    formData.append('row', props.userProfile.id)
    formData.append('column', 'preferences.avatar')
    
    try {
      const response = await apiClient.files.postUpload({
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      console.log('Response:', response)
      if (response.ok) {
        const result = await response.json()
        console.log('Avatar uploaded successfully:', result)
        emit('avatarUpdate', result.data.id)
      } else {
        console.error('Avatar upload failed:', response.statusText)
      }
    } catch (error) {
      console.error('Avatar upload error:', error)
    }
    
    // Reset the input value to allow selecting the same file again
    target.value = ''
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