<template>
  <el-dialog
    v-model="visible"
    title="Create Company Group"
    width="500px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <el-form 
      :model="form" 
      :rules="rules" 
      ref="formRef"
      label-width="120px"
      @submit.prevent="handleSubmit"
    >
      <el-form-item label="Group Name" prop="name">
        <el-input 
          v-model="form.name" 
          placeholder="Enter group name"
          :disabled="loading"
        />
      </el-form-item>
      
      <el-form-item label="Description" prop="description">
        <el-input 
          v-model="form.description" 
          type="textarea"
          :rows="3"
          placeholder="Enter group description (optional)"
          :disabled="loading"
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
          Create Group
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { apiClient } from 'api-client'
import { ElMessage } from 'element-plus'

interface FormData {
  name: string
  description: string
}

const visible = ref(false)
const loading = ref(false)
const formRef = ref()

const form = ref<FormData>({
  name: '',
  description: ''
})

const rules = {
  name: [
    { required: true, message: 'Group name is required', trigger: 'blur' },
    { min: 2, max: 50, message: 'Group name must be between 2 and 50 characters', trigger: 'blur' }
  ],
  description: [
    { max: 200, message: 'Description cannot exceed 200 characters', trigger: 'blur' }
  ]
}

const emit = defineEmits<{
  created: [groupId: string]
  cancelled: []
}>()

const resetForm = () => {
  form.value = {
    name: '',
    description: ''
  }
  formRef.value?.clearValidate()
}

const open = () => {
  visible.value = true
  resetForm()
}

const close = () => {
  visible.value = false
  resetForm()
}

const handleCancel = () => {
  emit('cancelled')
  close()
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    const valid = await formRef.value.validate()
    if (!valid) return
    
    loading.value = true
    
    // Call API to create the group
    const response = await apiClient.companies.postDataRecordsTablenameRecords("groups", {
      name: form.value.name,
      description: form.value.description
    })
    
    if (response && response.data) {
      ElMessage.success('Group created successfully')
      emit('created', response.data.id || '')
      close()
    } else {
      throw new Error('Failed to create group')
    }
    
  } catch (error) {
    console.error('Error creating group:', error)
    ElMessage.error('Failed to create group. Please try again.')
  } finally {
    loading.value = false
  }
}

defineExpose({
  open,
  close
})
</script>

<style lang="scss" scoped>
.dialog-footer {
  text-align: right;
  
  .el-button + .el-button {
    margin-left: 12px;
  }
}
</style>