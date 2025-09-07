<template>
  <div class="server-down-container">
    <div class="server-down-content">
      <div class="icon-container">
        <Icon name="mdi:server-off" size="80" />
      </div>
      
      <h1 class="title">{{ $t('serverDown.title') }}</h1>
      <p class="message">{{ $t('serverDown.message') }}</p>
      
      <div class="status-info">
        <p class="last-check">
          {{ $t('serverDown.lastCheck') }}: 
          <span class="timestamp">{{ formatLastCheck }}</span>
        </p>
        
        <div class="retry-info" v-if="retryAttempts > 0">
          <p>{{ $t('serverDown.retryAttempts', { count: retryAttempts }) }}</p>
          <div class="retry-progress" v-if="isRetrying">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${retryProgress}%` }"></div>
            </div>
            <p class="retry-text">{{ $t('serverDown.retrying') }}</p>
          </div>
        </div>
      </div>
      
      <div class="actions">
        <button 
          class="retry-button" 
          @click="handleRetry" 
          :disabled="isRetrying"
        >
          <Icon v-if="isRetrying" name="mdi:loading" class="spinning" />
          <Icon v-else name="mdi:refresh" />
          {{ isRetrying ? $t('serverDown.checking') : $t('serverDown.retry') }}
        </button>
        
        <button class="home-button" @click="goHome">
          <Icon name="mdi:home" />
          {{ $t('serverDown.goHome') }}
        </button>
      </div>
      
      <div class="help-info">
        <p class="help-text">{{ $t('serverDown.helpText') }}</p>
        <ul class="help-tips">
          <li>{{ $t('serverDown.tip1') }}</li>
          <li>{{ $t('serverDown.tip2') }}</li>
          <li>{{ $t('serverDown.tip3') }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { 
  useServerHealthy, 
  useLastHealthCheck, 
  refreshServerHealth,
  getTimeSinceLastCheck,
  startHealthCheck
} from '~/composables/serverHealth'

// Define page metadata
definePageMeta({
  layout: 'blank',
  public: true
})

// Reactive data
const serverHealthy = useServerHealthy()
const lastHealthCheck = useLastHealthCheck()
const isRetrying = ref(false)
const retryAttempts = ref(0)
const retryProgress = ref(0)
const autoRetryInterval = ref(null)

const router = useRouter()

// Computed properties
const formatLastCheck = computed(() => {
  if (!lastHealthCheck.value) return 'Never'
  return new Date(lastHealthCheck.value).toLocaleString()
})

// Methods
const handleRetry = async () => {
  if (isRetrying.value) return
  
  isRetrying.value = true
  retryAttempts.value++
  retryProgress.value = 0
  
  // Animate progress bar
  const progressInterval = setInterval(() => {
    retryProgress.value += 2
    if (retryProgress.value >= 100) {
      clearInterval(progressInterval)
    }
  }, 50)
  
  try {
    const isHealthy = await refreshServerHealth()
    
    if (isHealthy) {
      // Server is back online, redirect to home
      goHome()
    }
  } catch (error) {
    console.error('Retry failed:', error)
  } finally {
    clearInterval(progressInterval)
    isRetrying.value = false
    retryProgress.value = 0
  }
}

const goHome = () => {
  router.replace('/')
}

const startAutoRetry = () => {
  // Auto retry every 30 seconds
  autoRetryInterval.value = setInterval(async () => {
    if (!isRetrying.value) {
      const isHealthy = await refreshServerHealth()
      if (isHealthy) {
        goHome()
      }
    }
  }, 30000)
}

const stopAutoRetry = () => {
  if (autoRetryInterval.value) {
    clearInterval(autoRetryInterval.value)
    autoRetryInterval.value = null
  }
}

// Lifecycle
onMounted(() => {
  // Start auto retry when component mounts
  startAutoRetry()
  // Ensure health check is running
  startHealthCheck()
})

onUnmounted(() => {
  stopAutoRetry()
})

// Watch for server health changes
watch(serverHealthy, (isHealthy) => {
  if (isHealthy) {
    // Server is back online, redirect to home
    goHome()
  }
})
</script>

<style scoped lang="scss">
.server-down-container {
width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.server-down-content {
  background: white;
  border-radius: 12px;
  padding: 3rem;
  max-width: 500px;
  width: 100%;
  text-align: center;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

.icon-container {
  margin-bottom: 2rem;
  color: #ef4444;
}

.title {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 1rem;
}

.message {
  font-size: 1.125rem;
  color: #6b7280;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.status-info {
  background: #f9fafb;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  text-align: left;
}

.last-check {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 1rem;
}

.timestamp {
  font-weight: 600;
  color: #374151;
}

.retry-info p {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.retry-progress {
  margin-top: 1rem;
}

.progress-bar {
  background: #e5e7eb;
  border-radius: 4px;
  height: 8px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  height: 100%;
  transition: width 0.1s ease;
  border-radius: 4px;
}

.retry-text {
  font-size: 0.75rem;
  color: #3b82f6;
  font-weight: 500;
}

.actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.retry-button,
.home-button {
  flex: 1;
  min-width: 120px;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
  cursor: pointer;
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.retry-button {
  background: #3b82f6;
  color: white;
  border: none;
  
  &:hover:not(:disabled) {
    background: #2563eb;
    transform: translateY(-1px);
  }
}

.home-button {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  
  &:hover {
    background: #e5e7eb;
    transform: translateY(-1px);
  }
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.help-info {
  border-top: 1px solid #e5e7eb;
  padding-top: 1.5rem;
  text-align: left;
}

.help-text {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 1rem;
  font-weight: 600;
}

.help-tips {
  list-style: none;
  padding: 0;
  margin: 0;
  
  li {
    font-size: 0.8rem;
    color: #6b7280;
    margin-bottom: 0.5rem;
    position: relative;
    padding-left: 1.5rem;
    
    &:before {
      content: '•';
      color: #3b82f6;
      font-weight: bold;
      position: absolute;
      left: 0;
    }
  }
}

@media (max-width: 640px) {
  .server-down-content {
    padding: 2rem;
  }
  
  .actions {
    flex-direction: column;
  }
  
  .retry-button,
  .home-button {
    min-width: unset;
  }
}
</style>