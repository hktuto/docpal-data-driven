<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { apiClient } from 'api-client'

definePageMeta({
  public: true,
  layout: 'blank'
})

type Form = {
  companyName: string,
  adminUser: {
    name: string,
    email: string,
    password: string
  },
  confirmPassword: string
}

const isLoading = ref(false)
const errorMessage = ref('')
const formRef = ref<FormInstance>()
const router = useRouter()

const form = ref<Form>({
  companyName: "",
  adminUser: {
    name: "",
    email: "",
    password: ""
  },
  confirmPassword: ""
})

// Custom validator for password confirmation
const validatePasswordConfirmation = (rule: any, value: string, callback: any) => {
  if (value === '') {
    callback(new Error('Please confirm your password'))
  } else if (value !== form.value.adminUser.password) {
    callback(new Error('Passwords do not match'))
  } else {
    callback()
  }
}

// Custom validator for company name length
const validateCompanyName = (rule: any, value: string, callback: any) => {
  if (value === '') {
    callback(new Error('Please input company name'))
  } else if (value.length < 1 || value.length > 255) {
    callback(new Error('Company name must be between 1 and 255 characters'))
  } else {
    callback()
  }
}

// Custom validator for admin user name
const validateUserName = (rule: any, value: string, callback: any) => {
  if (value === '') {
    callback(new Error('Please input admin user name'))
  } else if (value.length < 1 || value.length > 255) {
    callback(new Error('Name must be between 1 and 255 characters'))
  } else {
    callback()
  }
}

const rules = ref<FormRules>({
  companyName: [
    { validator: validateCompanyName, trigger: 'blur' }
  ],
  'adminUser.name': [
    { validator: validateUserName, trigger: 'blur' }
  ],
  'adminUser.email': [
    { required: true, message: 'Please input email', trigger: 'blur' },
    { type: 'email', message: 'Please input a valid email', trigger: ['blur', 'change'] }
  ],
  'adminUser.password': [
    { required: true, message: 'Please input password', trigger: 'blur' },
    { min: 8, message: 'Password must be at least 8 characters', trigger: 'blur' }
  ],
  confirmPassword: [
    { validator: validatePasswordConfirmation, trigger: 'blur' }
  ]
})

const handleRegister = async () => {
  if (!formRef.value) return
  
  try {
    // Validate form before submission
    const isValid = await formRef.value.validate()
    if (!isValid) return
    
    isLoading.value = true
    errorMessage.value = ''
    
    const registrationData = {
      companyName: form.value.companyName,
      adminUser: {
        name: form.value.adminUser.name,
        email: form.value.adminUser.email,
        password: form.value.adminUser.password
      }
    }
    
    const response = await apiClient.companies.postRegister(registrationData)

    if (response?.data && response.data.company) {
      // Registration successful, redirect to login page
      router.push('/')
    } else {
      errorMessage.value = 'Registration failed. Please try again.'
    }
  } catch (error: any) {
    const errorBody = error?.response?.data
    if (errorBody) {
      errorMessage.value = errorBody.message || 'Registration failed. Please try again.'
    } else {
      errorMessage.value = error.message || 'Registration failed. Please try again.'
    }
  } finally {
    isLoading.value = false
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    handleRegister()
  }
}

// Watch password field to re-validate confirmation when password changes
watch(
  () => form.value.adminUser.password,
  () => {
    if (form.value.confirmPassword && formRef.value && typeof formRef.value.validateField === 'function') {
      formRef.value.validateField('confirmPassword')
    }
  }
)
</script>

<template>
  <div class="container"> 
    <ElCard class="cardContainer">
      <div class="logo">
        <img src="/logo.png" alt="Logo">
      </div>
      
      <div class="form-title">
        <h2>Create Your Company Account</h2>
        <p>Register your company and set up the admin account</p>
      </div>
      
      <ElForm 
        ref="formRef"
        :model="form" 
        :rules="rules" 
        label-position="top"
        @keydown="handleKeydown"
      >
        <!-- Company Information Section -->
        <div class="form-section">
          <h3>Company Information</h3>
          <ElFormItem label="Company Name" prop="companyName">
            <ElInput 
              v-model="form.companyName" 
              placeholder="Enter your company name"
              :disabled="isLoading"
              maxlength="255"
              show-word-limit
            />
          </ElFormItem>
        </div>
        
        <!-- Admin User Information Section -->
        <div class="form-section">
          <h3>Admin User Information</h3>
          <ElFormItem label="Full Name" prop="adminUser.name">
            <ElInput 
              v-model="form.adminUser.name" 
              placeholder="Enter admin user full name"
              :disabled="isLoading"
              maxlength="255"
              show-word-limit
            />
          </ElFormItem>
          
          <ElFormItem label="Email" prop="adminUser.email">
            <ElInput 
              v-model="form.adminUser.email" 
              type="email"
              placeholder="Enter admin user email"
              :disabled="isLoading"
              autocomplete="email"
            />
          </ElFormItem>
          
          <ElFormItem label="Password" prop="adminUser.password">
            <ElInput 
              v-model="form.adminUser.password" 
              type="password" 
              placeholder="Enter password (minimum 8 characters)"
              :disabled="isLoading"
              autocomplete="new-password"
              show-password
            />
          </ElFormItem>
          
          <ElFormItem label="Confirm Password" prop="confirmPassword">
            <ElInput 
              v-model="form.confirmPassword" 
              type="password" 
              placeholder="Confirm your password"
              :disabled="isLoading"
              autocomplete="new-password"
              show-password
            />
          </ElFormItem>
        </div>
        
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
          @click="handleRegister"
          style="width: 100%;"
        >
          {{ isLoading ? 'Creating Account...' : 'Create Account' }}
        </ElButton>
        
        <div class="form-actions">
          <div class="register-hint">
            Press Enter to submit the form
          </div>
          <ElButton 
            type="text" 
            @click="router.push('/login')"
            :disabled="isLoading"
          >
            Already have an account? Login
          </ElButton>
        </div>
      </template>
    </ElCard>
    <LoadingBg />
  </div>  
</template>

<style scoped>
.logo {
  width: 100%;
  height: 100px;
  padding-block: var(--app-space-m);
  position: relative;
}

.logo img {
  height: 100%;
}

.container {
  width: 100vw;
  height: 100vh;
  position: relative;
  display: grid;
  place-items: center;
  padding: 20px;
  box-sizing: border-box;
}

.cardContainer {
  min-width: 320px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.form-title {
  text-align: center;
  margin-bottom: 24px;
}

.form-title h2 {
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
  font-size: 24px;
  font-weight: 600;
}

.form-title p {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.form-section {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.form-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.form-section h3 {
  margin: 0 0 16px 0;
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 500;
}

.form-actions {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.register-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

/* Responsive design */
@media (max-width: 480px) {
  .container {
    padding: 10px;
  }
  
  .cardContainer {
    min-width: 280px;
  }
  
  .form-title h2 {
    font-size: 20px;
  }
}
</style>