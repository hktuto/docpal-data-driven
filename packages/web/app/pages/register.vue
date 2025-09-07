<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { apiClient } from 'api-client'

definePageMeta({
  public: true,
  layout: 'blank'
})

type Form = {
  company: {
    name: string,
    slug: string,
    description?: string,
    settings?: object
  },
  adminUser: {
    email: string,
    password: string,
    profile: {
      name: string,
      email: string,
      phone: string,
      address?: string,
      city?: string,
      preferences?: object
    }
  },
  confirmPassword: string
}

const isLoading = ref(false)
const errorMessage = ref('')
const formRef = ref<FormInstance>()
const router = useRouter()

const form = ref<Form>({
  company: {
    name: "",
    slug: "",
    description: "",
    settings: {}
  },
  adminUser: {
    email: "",
    password: "",
    profile: {
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      preferences: {}
    }
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

// Custom validator for company slug
const validateCompanySlug = (rule: any, value: string, callback: any) => {
  if (value === '') {
    callback(new Error('Please input company slug'))
  } else if (value.length < 1 || value.length > 100) {
    callback(new Error('Company slug must be between 1 and 100 characters'))
  } else if (!/^[a-z0-9-]+$/.test(value)) {
    callback(new Error('Company slug can only contain lowercase letters, numbers, and hyphens'))
  } else {
    callback()
  }
}

// Custom validator for admin user name
const validateUserName = (rule: any, value: string, callback: any) => {
  if (value === '') {
    callback(new Error('Please input admin user name'))
  } else if (value.length < 1 || value.length > 128) {
    callback(new Error('Name must be between 1 and 128 characters'))
  } else {
    callback()
  }
}

// Custom validator for phone number
const validatePhone = (rule: any, value: string, callback: any) => {
  if (value && value.length > 128) {
    callback(new Error('Phone number must not exceed 128 characters'))
  } else {
    callback()
  }
}

const rules = ref<FormRules>({
  'company.name': [
    { validator: validateCompanyName, trigger: 'blur' }
  ],
  'company.slug': [
    { validator: validateCompanySlug, trigger: 'blur' }
  ],
  'company.description': [
    { max: 1000, message: 'Description must not exceed 1000 characters', trigger: 'blur' }
  ],
  'adminUser.profile.name': [
    { validator: validateUserName, trigger: 'blur' }
  ],
  'adminUser.email': [
    { required: true, message: 'Please input email', trigger: 'blur' },
    { type: 'email', message: 'Please input a valid email', trigger: ['blur', 'change'] },
    { max: 128, message: 'Email must not exceed 128 characters', trigger: 'blur' }
  ],
  'adminUser.profile.email': [
    { required: true, message: 'Please input profile email', trigger: 'blur' },
    { type: 'email', message: 'Please input a valid email', trigger: ['blur', 'change'] },
    { max: 128, message: 'Email must not exceed 128 characters', trigger: 'blur' }
  ],
  'adminUser.profile.phone': [
    { validator: validatePhone, trigger: 'blur' }
  ],
  'adminUser.profile.address': [
    { max: 256, message: 'Address must not exceed 256 characters', trigger: 'blur' }
  ],
  'adminUser.profile.city': [
    { max: 128, message: 'City must not exceed 128 characters', trigger: 'blur' }
  ],
  'adminUser.password': [
    { required: true, message: 'Please input password', trigger: 'blur' },
    { min: 8, max: 128, message: 'Password must be between 8 and 128 characters', trigger: 'blur' }
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
      name: form.value.company.name,
      slug: form.value.company.slug,
      description: form.value.company.description,
      settings: form.value.company.settings,
      admin: {
        email: form.value.adminUser.email,
        password: form.value.adminUser.password,
        profile: {
          name: form.value.adminUser.profile.name,
          email: form.value.adminUser.profile.email,
          phone: form.value.adminUser.profile.phone,
          address: form.value.adminUser.profile.address,
          city: form.value.adminUser.profile.city,
          preferences: form.value.adminUser.profile.preferences
        }
      }
    }
    
    const response = await apiClient.companies.post(registrationData)

    if (response && response.company) {
      // Registration successful, redirect to login page
      router.push('/')
    } else {
      errorMessage.value = 'Registration failed. Please try again.'
    }
  } catch (error: any) {
    const errorBody = error?.response?.data
    if (errorBody?.error) {
      errorMessage.value = errorBody.error
    } else if (error?.message) {
      errorMessage.value = error.message
    } else {
      errorMessage.value = 'Registration failed. Please try again.'
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

// Auto-generate slug from company name (always update when name changes)
watch(
  () => form.value.company.name,
  (newName) => {
    if (newName) {
      form.value.company.slug = newName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 100)
    } else {
      form.value.company.slug = ''
    }
  }
)

// Auto-sync profile email with login email (always sync when admin email changes)
watch(
  () => form.value.adminUser.email,
  (newEmail) => {
    form.value.adminUser.profile.email = newEmail
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
          <ElFormItem label="Company Name" prop="company.name">
            <ElInput 
              v-model="form.company.name" 
              placeholder="Enter your company name"
              :disabled="isLoading"
              maxlength="255"
              show-word-limit
            />
          </ElFormItem>
          
          <ElFormItem label="Company Slug" prop="company.slug">
            <ElInput 
              v-model="form.company.slug" 
              placeholder="Enter company slug (e.g., my-company)"
              :disabled="isLoading"
              maxlength="100"
              show-word-limit
            />
            <template #extra>
              <span style="font-size: 12px; color: var(--el-text-color-secondary);">
                Only lowercase letters, numbers, and hyphens allowed
              </span>
            </template>
          </ElFormItem>
          
          <ElFormItem label="Description (Optional)" prop="company.description">
            <ElInput 
              v-model="form.company.description" 
              type="textarea"
              placeholder="Enter company description"
              :disabled="isLoading"
              maxlength="1000"
              show-word-limit
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </ElFormItem>
        </div>
        
        <!-- Admin User Information Section -->
        <div class="form-section">
          <h3>Admin User Credentials</h3>
          <ElFormItem label="Login Email" prop="adminUser.email">
            <ElInput 
              v-model="form.adminUser.email" 
              type="email"
              placeholder="Enter admin login email"
              :disabled="isLoading"
              maxlength="128"
              autocomplete="email"
            />
          </ElFormItem>
          
          <ElFormItem label="Password" prop="adminUser.password">
            <ElInput 
              v-model="form.adminUser.password" 
              type="password" 
              placeholder="Enter password (8-128 characters)"
              :disabled="isLoading"
              maxlength="128"
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
        
        <!-- Admin Profile Information Section -->
        <div class="form-section">
          <h3>Admin Profile Information</h3>
          <ElFormItem label="Full Name" prop="adminUser.profile.name">
            <ElInput 
              v-model="form.adminUser.profile.name" 
              placeholder="Enter admin user full name"
              :disabled="isLoading"
              maxlength="128"
              show-word-limit
            />
          </ElFormItem>
          
          <ElFormItem label="Profile Email" prop="adminUser.profile.email">
            <ElInput 
              v-model="form.adminUser.profile.email" 
              type="email"
              placeholder="Enter profile email (can be same as login email)"
              :disabled="isLoading"
              maxlength="128"
              autocomplete="email"
            />
          </ElFormItem>
          
          <ElFormItem label="Phone Number" prop="adminUser.profile.phone">
            <ElInput 
              v-model="form.adminUser.profile.phone" 
              placeholder="Enter phone number"
              :disabled="isLoading"
              maxlength="128"
            />
          </ElFormItem>
          
          <ElFormItem label="Address (Optional)" prop="adminUser.profile.address">
            <ElInput 
              v-model="form.adminUser.profile.address" 
              placeholder="Enter address"
              :disabled="isLoading"
              maxlength="256"
            />
          </ElFormItem>
          
          <ElFormItem label="City (Optional)" prop="adminUser.profile.city">
            <ElInput 
              v-model="form.adminUser.profile.city" 
              placeholder="Enter city"
              :disabled="isLoading"
              maxlength="128"
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