<script lang="ts" setup>
import { apiClient } from 'api-client';
import { ElMessage } from 'element-plus';
const { t, setLocale } = useI18n()
const user = useUser()

const form = ref<any>({

})

function initForm(){
  form.value = user.value.userProfile
}
const loading = ref(false)
async function handleSave(){
  const data = JSON.parse(JSON.stringify(form.value))
  delete data.createdAt
  delete data.updatedAt
  try{
    loading.value = true
    await apiClient.companies.putUserId(user.value.userProfile.id, data)
    ElMessage.success('Save success')
    await apiClient.auth.getSession()
    // check if form.locale is 
    setLocale(data.locale)
  }catch(error){
    console.error(error)
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
  <AuthProfile :user-profile="user.userProfile" :editable="true" />
  <el-form :model="form" label-position="top">
    <el-form-item label="First Name">
      <el-input v-model="form.first_name" />
    </el-form-item>
    <el-form-item label="Last Name">
      <el-input v-model="form.last_name" />
    </el-form-item>
    <el-form-item label="Phone">
      <el-input v-model="form.phone_number" />
    </el-form-item>
    <el-form-item label="Language">
      <el-select v-model="form.locale" >
        <el-option label="English" value="en-US" />
        <el-option label="Traditional Chinese" value="zh-HK" />
        <el-option label="Simplified Chinese" value="zh-CN" />
      </el-select>
    </el-form-item>
    <el-form-item>
      <el-button type="primary" :loading="loading" @click="handleSave">Save</el-button>
    </el-form-item>
  </el-form>
</AppPageContainer>
</template>
