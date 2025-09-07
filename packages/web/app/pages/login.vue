
<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import {apiClient } from 'api-client'

definePageMeta({
  public: true,
  layout: 'blank'
})

const isLoading = ref(false)
const errorMessage = ref('')
const formRef = ref<FormInstance>()
const showCompanySelection = ref(false)
const companies = ref<any[]>([])
const selectedCompany = ref('')

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
    
    // Step 1: Get user companies
    const companiesResponse = await apiClient.auth.postCompanies({
      email: form.value.email,
      password: form.value.password
    })
    
    if (companiesResponse && companiesResponse.length > 0) {
      companies.value = companiesResponse
      
      // If only one company, login directly
      if (companiesResponse.length === 1 && companiesResponse[0]?.id) {
        const companyId = companiesResponse[0].id
        await loginWithCompany(companyId)
      } else {
        // Show company selection
        showCompanySelection.value = true
      }
    } else {
      errorMessage.value = 'No companies found for this user.'
    }
  } catch (error: any) {
    const errorBody = error?.response?.data
    if(errorBody) {
      errorMessage.value = errorBody.message || 'Login failed. Please try again.'
    } else {
      errorMessage.value = error.message || 'Login failed. Please try again.'
    }
  } finally {
    isLoading.value = false
  }
}

const loginWithCompany = async (companyId: string) => {
  try {
    isLoading.value = true
    errorMessage.value = ''
    
    // Step 2: Login with selected company
    const response = await loginApi(form.value.email, form.value.password, companyId)
    if (response?.user) {
      router.push('/')
    } else {
      errorMessage.value = 'Login failed. Please check your credentials.'
    }
  } catch (error: any) {
    const errorBody = error?.response?.data
    if(errorBody) {
      errorMessage.value = errorBody.message || 'Login failed. Please try again.'
    } else {
      errorMessage.value = error.message || 'Login failed. Please try again.'
    }
  } finally {
    isLoading.value = false
  }
}

const handleCompanySelection = async () => {
  if (!selectedCompany.value) {
    errorMessage.value = 'Please select a company.'
    return
  }
  
  await loginWithCompany(selectedCompany.value)
}

const goBackToLogin = () => {
  showCompanySelection.value = false
  selectedCompany.value = ''
  errorMessage.value = ''
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    if (showCompanySelection.value) {
      handleCompanySelection()
    } else {
      handleLogin()
    }
  }
}
</script>

<template>
  <div class="container"> 
    
    <ElCard class="cardContainer">
      <div class="logo">
        <img src="/logo.png" alt="Logo">
      </div>
      
      <!-- Step 1: Email/Password Form -->
      <div v-if="!showCompanySelection">
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
      </div>
      
      <!-- Step 2: Company Selection -->
      <div v-else>
        <h3 style="margin-bottom: 16px; text-align: center;">Select Company</h3>
        <p style="margin-bottom: 20px; text-align: center; color: var(--el-text-color-regular);">
          You have access to multiple companies. Please select one to continue.
        </p>
        
        <ElForm @keydown="handleKeydown">
          <ElFormItem label="Company">
            <ElSelect 
              v-model="selectedCompany" 
              placeholder="Select a company"
              style="width: 100%;"
              :disabled="isLoading"
            >
              <ElOption
                v-for="company in companies"
                :key="company.id"
                :label="company.name"
                :value="company.id"
              >
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>{{ company.name }}</span>
                  <span style="color: var(--el-text-color-secondary); font-size: 12px;">
                    {{ company.role }}
                  </span>
                </div>
              </ElOption>
            </ElSelect>
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
      </div>
      
      <!-- Footer -->
      <template #footer>
        <div v-if="!showCompanySelection">
          <ElButton 
            type="primary" 
            :loading="isLoading"
            :disabled="isLoading"
            @click="handleLogin"
            style="width: 100%;"
          >
            {{ isLoading ? 'Checking...' : 'Continue' }}
          </ElButton>
          <div class="login-hint">
            Press Enter to continue
          </div>
        </div>
        
        <div v-else>
          <div style="display: flex; gap: 12px;">
            <ElButton 
              @click="goBackToLogin"
              :disabled="isLoading"
              style="flex: 1;"
            >
              Back
            </ElButton>
            <ElButton 
              type="primary" 
              :loading="isLoading"
              :disabled="isLoading || !selectedCompany"
              @click="handleCompanySelection"
              style="flex: 2;"
            >
              {{ isLoading ? 'Logging in...' : 'Login' }}
            </ElButton>
          </div>
          <div class="login-hint">
            Press Enter to login with selected company
          </div>
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