<template>
  <div class="permissions-manager">
    <!-- Permissions Header -->
    <div class="permissions-header">
      <div class="header-info">
        <h3>Table Permissions</h3>
        <p>Manage access control for this table</p>
      </div>
      <div class="header-actions">
        <el-button 
          type="primary" 
          @click="handleAddPermission"
          :icon="Plus"
        >
          Add Permission
        </el-button>
      </div>
    </div>

    <!-- Permission Types Tabs -->
    <el-tabs v-model="activePermissionTab" class="permission-tabs">
      <!-- User Permissions -->
      <el-tab-pane label="Users" name="users">
        <template #label>
          <div class="tab-label">
            <el-icon><User /></el-icon>
            <span>Users</span>
          </div>
        </template>
        
        <UserPermissionsTable 
          :table-name="tableName"
          :permissions="userPermissions"
          :loading="loading"
          @refresh="loadPermissions"
          @update="handleUpdatePermission"
          @delete="handleDeletePermission"
        />
      </el-tab-pane>

      <!-- Role Permissions -->
      <el-tab-pane label="Roles" name="roles">
        <template #label>
          <div class="tab-label">
            <el-icon><UserFilled /></el-icon>
            <span>Roles</span>
          </div>
        </template>
        
        <RolePermissionsTable 
          :table-name="tableName"
          :permissions="rolePermissions"
          :loading="loading"
          @refresh="loadPermissions"
          @update="handleUpdatePermission"
          @delete="handleDeletePermission"
        />
      </el-tab-pane>

      <!-- Group Permissions -->
      <el-tab-pane label="Groups" name="groups">
        <template #label>
          <div class="tab-label">
            <el-icon><Postcard /></el-icon>
            <span>Groups</span>
          </div>
        </template>
        
        <GroupPermissionsTable 
          :table-name="tableName"
          :permissions="groupPermissions"
          :loading="loading"
          @refresh="loadPermissions"
          @update="handleUpdatePermission"
          @delete="handleDeletePermission"
        />
      </el-tab-pane>

      <!-- Permission Overview -->
      <el-tab-pane label="Overview" name="overview">
        <template #label>
          <div class="tab-label">
            <el-icon><DataAnalysis /></el-icon>
            <span>Overview</span>
          </div>
        </template>
        
        <PermissionOverview 
          :table-name="tableName"
          :all-permissions="allPermissions"
          :loading="loading"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- Add Permission Dialog -->
    <AddPermissionDialog 
      ref="addPermissionRef"
      :table-name="tableName"
      @created="handlePermissionCreated"
    />

    <!-- Edit Permission Dialog -->
    <EditPermissionDialog 
      ref="editPermissionRef"
      :table-name="tableName"
      :permission="selectedPermission"
      @updated="handlePermissionUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { 
  Plus, User, UserFilled, Postcard, DataAnalysis 
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { apiClient } from 'api-client';
import UserPermissionsTable from './permissions/UserPermissionsTable.vue';
import RolePermissionsTable from './permissions/RolePermissionsTable.vue';
import GroupPermissionsTable from './permissions/GroupPermissionsTable.vue';
import PermissionOverview from './permissions/PermissionOverview.vue';
import AddPermissionDialog from './permissions/AddPermissionDialog.vue';
import EditPermissionDialog from './permissions/EditPermissionDialog.vue';

interface Props {
  tableName: string;
  columns: any[];
  permission: any;
  loading: boolean;
}

const props = defineProps<Props>();

// Refs
const addPermissionRef = ref();
const editPermissionRef = ref();
const selectedPermission = ref(null);

// State
const activePermissionTab = ref('users');
const allPermissions = ref<any[]>([]);
const loading = ref(false);

// Computed permissions by type
const userPermissions = computed(() => 
  allPermissions.value.filter(p => p.subject_type === 'user')
);

const rolePermissions = computed(() => 
  allPermissions.value.filter(p => p.subject_type === 'role')
);

const groupPermissions = computed(() => 
  allPermissions.value.filter(p => p.subject_type === 'group')
);

// Load all permissions
const loadPermissions = async () => {
  loading.value = true;
  try {
    // TODO: Replace with actual API endpoint
    const response = await apiClient.companies.getDataPermissionTableName(props.tableName);
    allPermissions.value = response.data || [];
  } catch (error) {
    console.error('Error loading permissions:', error);
    ElMessage.error('Failed to load permissions');
    allPermissions.value = [];
  } finally {
    loading.value = false;
  }
};

// Permission actions
const handleAddPermission = () => {
  addPermissionRef.value?.open();
};

const handleUpdatePermission = (permission: any) => {
  selectedPermission.value = permission;
  editPermissionRef.value?.open();
};

const handleDeletePermission = async (permission: any) => {
  try {
    await apiClient.companies.deleteDataRecordsTablenamePermissionsPermissionid(
      props.tableName,
      permission.id
    );
    ElMessage.success('Permission deleted successfully');
    loadPermissions();
  } catch (error) {
    console.error('Error deleting permission:', error);
    ElMessage.error('Failed to delete permission');
  }
};

// Event handlers
const handlePermissionCreated = () => {
  loadPermissions();
};

const handlePermissionUpdated = () => {
  loadPermissions();
};

// Initialize
onMounted(() => {
  loadPermissions();
});
</script>

<style scoped>
.permissions-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.permissions-header {
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

.permission-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.permission-tabs :deep(.el-tabs__content) {
  flex: 1;
  padding: 16px 0;
}

.permission-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-label .el-icon {
  font-size: 16px;
}

/* Responsive design */
@media (max-width: 768px) {
  .permissions-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .tab-label span {
    display: none;
  }
}
</style>
