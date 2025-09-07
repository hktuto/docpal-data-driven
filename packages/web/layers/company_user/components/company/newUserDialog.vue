<template>
  <el-dialog 
    v-model="dialogVisible" 
    title="Add New User" 
    width="600px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form 
      ref="formRef" 
      :model="form" 
      :rules="rules" 
      label-position="top"
      @submit.prevent="handleSubmit"
    >
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="First Name" prop="first_name">
            <el-input 
              v-model="form.first_name" 
              placeholder="Enter first name"
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="Last Name" prop="last_name">
            <el-input 
              v-model="form.last_name" 
              placeholder="Enter last name"
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="Email Address" prop="email">
        <el-input 
          v-model="form.email" 
          placeholder="Enter email address"
          type="email"
          clearable
        />
      </el-form-item>

      <el-form-item label="Password" prop="password">
        <el-input 
          v-model="form.password" 
          placeholder="Enter password"
          type="password"
          show-password
          clearable
        />
      </el-form-item>

      <el-form-item label="Phone Number" prop="phone_number">
        <el-input 
          v-model="form.phone_number" 
          placeholder="Enter phone number"
          clearable
        />
      </el-form-item>

      <el-form-item label="Locale" prop="locale">
        <el-select 
          v-model="form.locale" 
          placeholder="Select locale"
          style="width: 100%"
        >
          <el-option label="English (US)" value="en-US" />
          <el-option label="Chinese (Simplified)" value="zh-CN" />
          <el-option label="Chinese (Hong Kong)" value="zh-HK" />
        </el-select>
      </el-form-item>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item>
            <el-checkbox v-model="form.isActive">
              Active User
            </el-checkbox>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item>
            <el-checkbox v-model="form.isCompanyAdmin">
              Company Administrator
            </el-checkbox>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">Cancel</el-button>
        <el-button 
          type="primary" 
          @click="handleSubmit"
          :loading="loading"
        >
          Create User
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { apiClient } from 'api-client'
interface UserForm {
  name: string
  email: string
  password: string
  isActive: boolean
  isCompanyAdmin: boolean
  first_name: string
  last_name: string
  phone_number: string
  locale: string
}

const dialogVisible = ref(false)
const loading = ref(false)
const formRef = ref<FormInstance>()

const form = ref<UserForm>({
  name: '',
  email: '',
  password: '',
  isActive: true,
  isCompanyAdmin: false,
  first_name: '',
  last_name: '',
  phone_number: '',
  locale: 'en-US'
})

// Auto-generate full name from first and last name
const fullName = computed(() => {
  const firstName = form.value.first_name.trim()
  const lastName = form.value.last_name.trim()
  
  if (firstName && lastName) {
    return `${firstName} ${lastName}`
  } else if (firstName) {
    return firstName
  } else if (lastName) {
    return lastName
  }
  return ''
})

// Watch for changes in first_name and last_name to update the name field
watch([() => form.value.first_name, () => form.value.last_name], () => {
  form.value.name = fullName.value
})

const rules: FormRules = {
  first_name: [
    { required: true, message: 'First name is required', trigger: 'blur' },
    { min: 2, max: 50, message: 'First name must be between 2 and 50 characters', trigger: 'blur' }
  ],
  last_name: [
    { required: true, message: 'Last name is required', trigger: 'blur' },
    { min: 2, max: 50, message: 'Last name must be between 2 and 50 characters', trigger: 'blur' }
  ],
  name: [
    { min: 2, max: 100, message: 'Full name must be between 2 and 100 characters', trigger: 'blur' }
  ],
  email: [
    { required: true, message: 'Email is required', trigger: 'blur' },
    { type: 'email', message: 'Please enter a valid email address', trigger: 'blur' }
  ],
  password: [
    { required: true, message: 'Password is required', trigger: 'blur' },
    { min: 8, message: 'Password must be at least 8 characters long', trigger: 'blur' },
    { 
      pattern: /^(?=.*[a-z])(?=.*[A-Z])/,
      message: 'Password must contain at least one uppercase letter and one lowercase letter',
      trigger: 'blur'
    }
  ],
  phone_number: [
    { required: true, message: 'Phone number is required', trigger: 'blur' },
    { 
      pattern: /^[\+]?[1-9][\d]{0,15}$/,
      message: 'Please enter a valid phone number',
      trigger: 'blur'
    }
  ],
  locale: [
    { required: true, message: 'Locale is required', trigger: 'change' }
  ]
}

const emit = defineEmits<{
  userCreated: [user: UserForm]
  dialogClosed: []
}>()

function open() {
  dialogVisible.value = true
  resetForm()
}

function handleClose() {
  dialogVisible.value = false
  resetForm()
  emit('dialogClosed')
}

function resetForm() {
  if (formRef.value) {
    formRef.value.resetFields()
  }
  form.value = {
    name: '',
    email: '',
    password: '',
    isActive: true,
    isCompanyAdmin: false,
    first_name: '',
    last_name: '',
    phone_number: '',
    locale: 'en-US'
  }
  // Reset the computed name field
  form.value.name = ''
}

async function handleSubmit() {
  if (!formRef.value) return
  
  try {
    const valid = await formRef.value.validate()
    if (!valid) return
    
    loading.value = true
    const user = useUser()
    const response = await apiClient.companies.postUser({
      ...form.value
    })
    console.log(response)

    emit('userCreated', { ...form.value })
    
    ElMessage.success('User created successfully')
    handleClose()
    
  } catch (error) {
    console.error('Form validation failed:', error)
  } finally {
    loading.value = false
  }
}

defineExpose({
  open
})
</script>

<style lang="scss" scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

:deep(.el-input__wrapper) {
  border-radius: 6px;
}

:deep(.el-select) {
  width: 100%;
}
</style>