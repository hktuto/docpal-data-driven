
<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'

definePageMeta({
  public: true,
  layout: 'blank'
})

const isLoading = ref(false)
const errorMessage = ref('')
const formRef = ref<FormInstance>()

const form = ref({
  email: '',
  password: ''
})

const rules = ref<FormRules>({
  email: [
    { required: true, message: 'Please input email', trigger: 'blur' },
    { type: 'email', message: 'Please input a valid email', trigger: ['blur', 'change'] }
  ],
  password: [
    { required: true, message: 'Please input password', trigger: 'blur' },
    { min: 6, message: 'Password must be at least 6 characters', trigger: 'blur' }
  ]
})
const router = useRouter()
const handleLogin = async () => {
  if (!formRef.value) return
  
  try {
    // Validate form before submission
    const isValid = await formRef.value.validate()
    if (!isValid) return
    
    isLoading.value = true
    errorMessage.value = ''
    
    const response = await loginApi(form.value.email, form.value.password)
    if (response?.data) {
      router.push('/')
    } else {
      errorMessage.value = 'Login failed. Please check your credentials.'
    }
  } catch (error: any) {
    const errorBody = error?.response?.data
    if(errorBody) {
      errorMessage.value = errorBody.message || 'Login failed. Please try again.'
    }else{
      errorMessage.value = error.message || 'Login failed. Please try again.'
    }
    
  } finally {
    isLoading.value = false
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    handleLogin()
  }
}
</script>

<template>
  <div class="container"> 
    
    <ElCard class="cardContainer">
      <div class="logo">
        <img src="/logo.png" alt="Logo">
      </div>
      <ElForm 
        ref="formRef"
        :model="form" 
        :rules="rules" 
        label-position="top"
        @keydown="handleKeydown"
      >
        <ElFormItem label="Email" prop="email">
          <ElInput 
            v-model="form.email" 
            type="email"
            placeholder="Enter your email"
            :disabled="isLoading"
            autocomplete="email"
          />
        </ElFormItem>
        <ElFormItem label="Password" prop="password">
          <ElInput 
            v-model="form.password" 
            type="password" 
            placeholder="Enter your password"
            :disabled="isLoading"
            autocomplete="current-password"
            show-password
          />
        </ElFormItem>
        
        <!-- Error message display -->
        <ElFormItem v-if="errorMessage">
          <ElAlert
            :title="errorMessage"
            type="error"
            :closable="false"
            show-icon
          />
        </ElFormItem>
      </ElForm>
      
      <template #footer>
        <ElButton 
          type="primary" 
          :loading="isLoading"
          :disabled="isLoading"
          @click="handleLogin"
          style="width: 100%;"
        >
          {{ isLoading ? 'Logging in...' : 'Login' }}
        </ElButton>
        <div class="login-hint">
          Press Enter to submit the form
        </div>
      </template>
    </ElCard>
    <LoadingBg />
  </div>
</template>


<style scoped>
.logo{
  width: 100%;
  height: 100px;
  padding-block: var(--app-space-m);
  position: relative;
  img {
    height: 100%;
  }
}
.container {
  width: 100vw;
  height: 100vh;
  position: relative;
  display: grid;
  place-items: center;
}

.cardContainer {
  min-width: 260px;
  max-width: 600px;
  width: 100%;
}

.login-hint {
  margin-top: 8px;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>