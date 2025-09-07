<template>
  <div class="forms-manager">
    <!-- Forms List Header -->
    <div class="forms-header">
      <div class="header-info">
        <h3>Table Forms</h3>
        <p>Manage forms for data entry and editing</p>
      </div>
      <div class="header-actions">
        <el-button 
          v-if="canCreateForms"
          type="primary" 
          @click="handleCreateForm"
          :icon="Plus"
        >
          Create Form
        </el-button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <el-skeleton :rows="3" animated />
    </div>

    <!-- Forms List -->
    <div v-else-if="forms.length > 0" class="forms-list">
      <div 
        v-for="form in forms" 
        :key="form.id"
        class="form-card"
      >
        <div class="form-info">
          <div class="form-header">
            <h4 class="form-name">{{ form.name }}</h4>
            <div class="form-badges">
              <el-tag 
                :type="form.is_active ? 'success' : 'info'"
                size="small"
              >
                {{ form.is_active ? 'Active' : 'Inactive' }}
              </el-tag>
              <el-tag 
                v-if="form.is_default"
                type="primary"
                size="small"
              >
                Default
              </el-tag>
            </div>
          </div>
          
          <p v-if="form.description" class="form-description">
            {{ form.description }}
          </p>
          
          <div class="form-meta">
            <span class="meta-item">
              <el-icon><Calendar /></el-icon>
              Created: {{ formatDate(form.created_at) }}
            </span>
            <span class="meta-item">
              <el-icon><User /></el-icon>
              By: {{ form.creator?.name || 'Unknown' }}
            </span>
            <span class="meta-item">
              <el-icon><Document /></el-icon>
              {{ form.field_count || 0 }} fields
            </span>
          </div>
        </div>

        <div class="form-actions">
          <el-dropdown trigger="click" placement="bottom-end">
            <el-button :icon="MoreFilled" circle />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="handleEditForm(form)">
                  <el-icon><Edit /></el-icon>
                  Edit Form
                </el-dropdown-item>
                <el-dropdown-item @click="handlePreviewForm(form)">
                  <el-icon><View /></el-icon>
                  Preview
                </el-dropdown-item>
                <el-dropdown-item 
                  v-if="!form.is_default"
                  @click="handleSetDefault(form)"
                >
                  <el-icon><Star /></el-icon>
                  Set as Default
                </el-dropdown-item>
                <el-dropdown-item 
                  @click="handleToggleActive(form)"
                  :divided="true"
                >
                  <el-icon><Switch /></el-icon>
                  {{ form.is_active ? 'Deactivate' : 'Activate' }}
                </el-dropdown-item>
                <el-dropdown-item 
                  v-if="canDeleteForms && !form.is_default"
                  @click="handleDeleteForm(form)"
                  class="danger-item"
                >
                  <el-icon><Delete /></el-icon>
                  Delete
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <el-empty description="No forms created yet">
        <el-button 
          v-if="canCreateForms"
          type="primary" 
          @click="handleCreateForm"
        >
          Create First Form
        </el-button>
      </el-empty>
    </div>

    <!-- Form Builder Dialog -->
    <FormBuilderDialog 
      ref="formBuilderRef"
      :table-name="tableName"
      @created="handleFormCreated"
      @updated="handleFormUpdated"
    />

    <!-- Form Preview Dialog -->
    <FormPreviewDialog 
      ref="formPreviewRef"
      :form="selectedForm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { 
  Plus, Calendar, User, Document, MoreFilled, 
  Edit, View, Star, Switch, Delete 
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { apiClient } from 'api-client';

import FormBuilderDialog from './FormBuilderDialog.vue';
import FormPreviewDialog from './FormPreviewDialog.vue';

interface Props {
  tableName: string;
  columns: any[];
  permission: any;
  loading: boolean;
}

const props = defineProps<Props>();

// Refs
const formBuilderRef = ref();
const formPreviewRef = ref();
const selectedForm = ref(null);

// State
const forms = ref<any[]>([]);
const loading = ref(false);

// Permission checks
const canCreateForms = computed(() => {
  return props.permission?.permissionMap?.can_manage === true;
});

const canDeleteForms = computed(() => {
  return props.permission?.permissionMap?.can_manage === true;
});

const user = useUser()

// Load forms
const loadForms = async () => {
  loading.value = true;
  try {
    // TODO: Replace with actual API endpoint
    
    const response = await apiClient.companies.getForms({table_name: props.tableName});
    forms.value = response.data || [];
  } catch (error) {
    console.error('Error loading forms:', error);
    ElMessage.error('Failed to load forms');
    forms.value = [];
  } finally {
    loading.value = false;
  }
};

// Form actions
const handleCreateForm = () => {
  formBuilderRef.value?.open();
};

const handleEditForm = (form: any) => {
  formBuilderRef.value?.open(form);
};

const handlePreviewForm = (form: any) => {
  selectedForm.value = form;
  formPreviewRef.value?.open();
};

const handleSetDefault = async (form: any) => {
  try {
    await apiClient.companies.putDataSchemaTablenameFormsFormidDefault(
      props.tableName, 
      form.id
    );
    ElMessage.success('Form set as default');
    loadForms();
  } catch (error) {
    console.error('Error setting default form:', error);
    ElMessage.error('Failed to set default form');
  }
};

const handleToggleActive = async (form: any) => {
  try {
    await apiClient.companies.putDataSchemaTablenameFormsFormidToggle(
      props.tableName, 
      form.id
    );
    ElMessage.success(`Form ${form.is_active ? 'deactivated' : 'activated'}`);
    loadForms();
  } catch (error) {
    console.error('Error toggling form status:', error);
    ElMessage.error('Failed to update form status');
  }
};

const handleDeleteForm = async (form: any) => {
  try {
    await ElMessageBox.confirm(
      `Are you sure you want to delete the form "${form.name}"? This action cannot be undone.`,
      'Delete Form',
      {
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    );

    await apiClient.companies.deleteDataSchemaTablenameFormsFormid(
      props.tableName, 
      form.id
    );
    ElMessage.success('Form deleted successfully');
    loadForms();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Error deleting form:', error);
      ElMessage.error('Failed to delete form');
    }
  }
};

// Event handlers
const handleFormCreated = () => {
  loadForms();
};

const handleFormUpdated = () => {
  loadForms();
};

// Utility functions
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

// Initialize
onMounted(() => {
  loadForms();
});
</script>

<style scoped>
.forms-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.forms-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.header-info h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.header-info p {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.loading-container {
  padding: 20px;
}

.forms-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.form-card {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  transition: all 0.2s ease;
}

.form-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.form-info {
  flex: 1;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.form-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.form-badges {
  display: flex;
  gap: 8px;
}

.form-description {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 1.4;
}

.form-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.meta-item .el-icon {
  font-size: 14px;
}

.form-actions {
  margin-left: 16px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 300px;
}

.danger-item {
  color: var(--el-color-danger);
}

/* Responsive design */
@media (max-width: 768px) {
  .forms-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .form-card {
    flex-direction: column;
    gap: 16px;
  }
  
  .form-actions {
    margin-left: 0;
    align-self: flex-end;
  }
  
  .form-meta {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
