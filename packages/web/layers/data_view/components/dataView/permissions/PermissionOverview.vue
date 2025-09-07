<template>
  <div class="permission-overview">
    <div v-if="loading" class="loading-container">
      <el-skeleton :rows="5" animated />
    </div>
    
    <div v-else class="overview-content">
      <el-alert
        title="Permission Overview"
        type="info"
        description="Visual overview of all table permissions with charts and statistics will be implemented here."
        show-icon
        :closable="false"
      />
      
      <!-- Mock overview cards -->
      <div class="overview-cards">
        <el-card class="overview-card">
          <div class="card-content">
            <div class="card-icon">
              <el-icon size="24"><User /></el-icon>
            </div>
            <div class="card-info">
              <div class="card-number">{{ allPermissions.filter(p => p.subject_type === 'user').length }}</div>
              <div class="card-label">User Permissions</div>
            </div>
          </div>
        </el-card>
        
        <el-card class="overview-card">
          <div class="card-content">
            <div class="card-icon">
              <el-icon size="24"><UserFilled /></el-icon>
            </div>
            <div class="card-info">
              <div class="card-number">{{ allPermissions.filter(p => p.subject_type === 'role').length }}</div>
              <div class="card-label">Role Permissions</div>
            </div>
          </div>
        </el-card>
        
        <el-card class="overview-card">
          <div class="card-content">
            <div class="card-icon">
              <el-icon size="24"><Postcard /></el-icon>
            </div>
            <div class="card-info">
              <div class="card-number">{{ allPermissions.filter(p => p.subject_type === 'group').length }}</div>
              <div class="card-label">Group Permissions</div>
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { User, UserFilled, Postcard } from '@element-plus/icons-vue';

interface Props {
  tableName: string;
  allPermissions: any[];
  loading: boolean;
}

const props = defineProps<Props>();
</script>

<style scoped>
.permission-overview {
  height: 100%;
  padding: 20px;
}

.loading-container {
  padding: 20px;
}

.overview-content {
  height: 100%;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 24px;
}

.overview-card {
  border: 1px solid var(--el-border-color-light);
}

.card-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
  color: var(--el-color-primary);
}

.card-info {
  flex: 1;
}

.card-number {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1;
}

.card-label {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin-top: 4px;
}
</style>
