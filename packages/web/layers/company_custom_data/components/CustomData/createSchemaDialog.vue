<template>
  <el-dialog
    v-model="visible"
    title="Create New Schema"
    width="600px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <el-form 
      :model="form" 
      :rules="rules" 
      ref="formRef"
      label-position="top"
      @submit.prevent="handleSubmit"
    >
      <el-form-item label="Schema Label" prop="label">
        <el-input 
          v-model="form.label" 
          placeholder="Enter schema label (e.g., Products, Customers)"
          :disabled="loading"
          maxlength="255"
          show-word-limit
        />
        <template #extra>
          <span style="font-size: 12px; color: var(--el-text-color-secondary);">
            A human-readable name for your schema
          </span>
        </template>
      </el-form-item>
      
      <el-form-item label="Schema Slug" prop="slug">
        <el-input 
          v-model="form.slug" 
          placeholder="Enter unique identifier (e.g., products, customers)"
          :disabled="loading"
          maxlength="100"
          show-word-limit
        />
        <template #extra>
          <span style="font-size: 12px; color: var(--el-text-color-secondary);">
            Only lowercase letters, numbers, and underscores allowed. Auto-generated from label.
          </span>
        </template>
      </el-form-item>
      
      <el-form-item label="Description" prop="description">
        <el-input 
          v-model="form.description" 
          type="textarea"
          :rows="4"
          placeholder="Describe what this schema will be used for"
          :disabled="loading"
          maxlength="1000"
          show-word-limit
        />
      </el-form-item>
    </el-form>
    
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel" :disabled="loading">
          Cancel
        </el-button>
        <el-button 
          type="primary" 
          @click="handleSubmit"
          :loading="loading"
        >
          Create Schema
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { apiClient } from 'api-client'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'

interface SchemaForm {
  label: string
  slug: string
  description: string
}

const visible = ref(false)
const loading = ref(false)
const formRef = ref<FormInstance>()

const form = ref<SchemaForm>({
  label: '',
  slug: '',
  description: ''
})

// Custom validator for schema label
const validateLabel = (rule: any, value: string, callback: any) => {
  if (value === '') {
    callback(new Error('Please input schema label'))
  } else if (value.length < 1 || value.length > 255) {
    callback(new Error('Label must be between 1 and 255 characters'))
  } else {
    callback()
  }
}

// Custom validator for schema slug
const validateSlug = (rule: any, value: string, callback: any) => {
  if (value === '') {
    callback(new Error('Please input schema slug'))
  } else if (value.length < 1 || value.length > 100) {
    callback(new Error('Slug must be between 1 and 100 characters'))
  } else if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    callback(new Error('Slug must start with a letter and contain only lowercase letters, numbers, and underscores'))
  } else {
    callback()
  }
}

// Custom validator for description
const validateDescription = (rule: any, value: string, callback: any) => {
  if (value === '') {
    callback(new Error('Please input schema description'))
  } else if (value.length < 1 || value.length > 1000) {
    callback(new Error('Description must be between 1 and 1000 characters'))
  } else {
    callback()
  }
}

const rules = ref<FormRules>({
  label: [
    { validator: validateLabel, trigger: 'blur' }
  ],
  slug: [
    { validator: validateSlug, trigger: 'blur' }
  ],
  description: [
    { validator: validateDescription, trigger: 'blur' }
  ]
})

// Auto-generate slug from label (always update when label changes)
watch(
  () => form.value.label,
  (newLabel) => {
    if (newLabel) {
      form.value.slug = newLabel
        .toLowerCase()
        .replace(/[^a-z0-9\s_]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 100)
        // Ensure it starts with a letter
        .replace(/^[^a-z]/, '')
    } else {
      form.value.slug = ''
    }
  }
)

const emit = defineEmits<{
  schemaCreated: [schema: any]
  dialogClosed: []
}>()

function open() {
  visible.value = true
  resetForm()
}

function handleCancel() {
  visible.value = false
  resetForm()
  emit('dialogClosed')
}

function resetForm() {
  if (formRef.value) {
    formRef.value.resetFields()
  }
  form.value = {
    label: '',
    slug: '',
    description: ''
  }
}

async function handleSubmit() {
  if (!formRef.value) return
  
  try {
    const valid = await formRef.value.validate()
    if (!valid) return
    
    loading.value = true
    
    // Create the schema using the API
    const response = await apiClient.schemas.post({
      slug: form.value.slug,
      label: form.value.label,
      description: form.value.description,
      columns: [] // You'll handle the API change to allow empty columns
    })
    
    emit('schemaCreated', response)
    
    ElMessage.success('Schema created successfully! You can now add columns to it.')
    handleCancel()
    
  } catch (error: any) {
    console.error('Schema creation failed:', error)
    
    const errorBody = error?.response?.data
    let errorMessage = 'Failed to create schema. Please try again.'
    
    if (errorBody?.error) {
      errorMessage = errorBody.error
    } else if (error?.message) {
      errorMessage = error.message
    }
    
    ElMessage.error(errorMessage)
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

:deep(.el-textarea .el-input__wrapper) {
  border-radius: 6px;
}
</style>