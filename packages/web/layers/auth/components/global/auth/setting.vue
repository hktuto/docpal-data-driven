<script lang="ts" setup>
import { apiClient } from 'api-client';
import { ElMessage } from 'element-plus';
const { t, setLocale } = useI18n()
const user = useUser()

// Initialize form with reactive data matching new schema
const form = ref<any>({})

async function initForm(){
  // Initialize form with new schema structure
  await getMe()
  const userProfile = user.value.userProfile
  // normalize perferences
   if(!userProfile.preferences || Object.keys(userProfile.preferences).length === 0) {
    userProfile.preferences = {
      avatar: "",
      locale: "en-US"
    }
   }
  form.value = Object.assign({},userProfile)
}


// Watch for locale changes and apply immediately
watch(() => form.value.preferences?.locale, (newLocale) => {
  if (newLocale && newLocale !== user.value.userProfile.preferences?.locale) {
    setLocale(newLocale)
  }
})

const loading = ref(false)

// Handle avatar file upload
function handleAvatarUpdate(file: File) {
  // The AuthProfile component handles the upload,
  // we just need to refresh the form data
  nextTick(() => {
    initForm()
  })
}

async function handleSave(){
  const data = JSON.parse(JSON.stringify(form.value))
  delete data.createdAt
  delete data.updatedAt
  delete data.created_at
  delete data.updated_at
  
  try{
    loading.value = true
    await apiClient.users.putUserid(user.value.userProfile.id, data)
    ElMessage.success('Save success')
    
    // Update user profile with saved data
    user.value.userProfile = { ...user.value.userProfile, ...data }
  }catch(error){
    console.error(error)
    ElMessage.error('Save failed')
  }finally{
    loading.value = false
  }
}

onMounted(() => {
  initForm()
})
</script>


<template>
<AppPageContainer>
  <div class="settings-container">
    <AuthProfile :user-profile="form" :editable="true" @avatarUpdate="handleAvatarUpdate" />

    <el-form :model="form" label-position="top" class="user-settings-form">
      <el-form-item label="Name">
        <el-input v-model="form.name" placeholder="Enter your full name" />
      </el-form-item>
      
      <el-form-item label="Email">
        <el-input v-model="form.email" type="email" placeholder="Enter your email" />
      </el-form-item>
      
      <el-form-item label="Phone">
        <el-input v-model="form.phone" placeholder="Enter your phone number" />
      </el-form-item>
      
      <el-form-item label="Address">
        <el-input v-model="form.address" placeholder="Enter your address" />
      </el-form-item>
      
      <el-form-item label="City">
        <el-input v-model="form.city" placeholder="Enter your city" />
      </el-form-item>
      
      <el-form-item v-if="form.preferences && form.preferences.locale" label="Language">
        <el-select v-model="form.preferences.locale" placeholder="Select language">
          <el-option label="English" value="en-US" />
          <el-option label="Traditional Chinese" value="zh-HK" />
          <el-option label="Simplified Chinese" value="zh-CN" />
        </el-select>
      </el-form-item>
      
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="handleSave">Save Changes</el-button>
      </el-form-item>
    </el-form>
  </div>
</AppPageContainer>
</template>

<style scoped lang="scss">
.settings-container {
  max-width: 600px;
  margin: 0 auto;
  padding: var(--app-space-l);
}

.user-settings-form {
  margin-top: var(--app-space-xl);
  
  .el-form-item {
    margin-bottom: var(--app-space-l);
  }
  
  .el-input, .el-select {
    width: 100%;
  }
  
  .el-button {
    width: 100%;
    margin-top: var(--app-space-m);
  }
}
</style>
