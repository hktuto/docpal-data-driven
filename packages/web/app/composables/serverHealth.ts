import { apiClient } from 'api-client'

// Global state for server health
export const useServerHealthy = () => useState('serverHealthy', () => true)
export const useServerHealthInit = () => useState('serverHealthInit', () => false)
export const useLastHealthCheck = () => useState('lastHealthCheck', () => 0)

// Configuration
const HEALTH_CHECK_INTERVAL = 5 * 30 * 1000 // 5 minutes
const HEALTH_CHECK_TIMEOUT = 5000 // 5 seconds
const MAX_RETRY_ATTEMPTS = 3

let healthCheckInterval: NodeJS.Timeout | null = null

/**
 * Check server health by calling /health endpoint
 */
export async function checkServerHealth(): Promise<boolean> {
  const serverHealthy = useServerHealthy()
  const serverHealthInit = useServerHealthInit()
  const lastHealthCheck = useLastHealthCheck()
  
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT)
    })
    
    // Race between the API call and timeout
    const healthResponse = await Promise.race([
      apiClient.health.get(),
      timeoutPromise
    ]) as any
    
    // Check if response exists and has expected structure
    if (healthResponse && (healthResponse.status === 'ok' || healthResponse.status === 'healthy')) {
      serverHealthy.value = true
      lastHealthCheck.value = Date.now()
      return true
    } else {
      throw new Error('Health check failed - invalid response')
    }
  } catch (error) {
    console.warn('Server health check failed:', error)
    serverHealthy.value = false
    lastHealthCheck.value = Date.now()
    return false
  } finally {
    serverHealthInit.value = true
  }
}

/**
 * Check server health with retry mechanism
 */
export async function checkServerHealthWithRetry(retryAttempts = MAX_RETRY_ATTEMPTS): Promise<boolean> {
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    const isHealthy = await checkServerHealth()
    
    if (isHealthy) {
      return true
    }
    
    // Wait before retry (exponential backoff)
    if (attempt < retryAttempts) {
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
  
  return false
}

/**
 * Start periodic health checks
 */
export function startHealthCheck() {
  if (healthCheckInterval) {
    return // Already started
  }
  
  // Initial health check
  checkServerHealth()
  
  // Set up periodic checks
  healthCheckInterval = setInterval(() => {
    checkServerHealth()
  }, HEALTH_CHECK_INTERVAL)
}

/**
 * Stop periodic health checks
 */
export function stopHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval)
    healthCheckInterval = null
  }
}

/**
 * Force an immediate health check
 */
export async function refreshServerHealth(): Promise<boolean> {
  return await checkServerHealthWithRetry()
}

/**
 * Get time since last health check
 */
export function getTimeSinceLastCheck(): number {
  const lastHealthCheck = useLastHealthCheck()
  return Date.now() - lastHealthCheck.value
}

/**
 * Check if health check is stale (hasn't been done recently)
 */
export function isHealthCheckStale(): boolean {
  const serverHealthInit = useServerHealthInit()
  return !serverHealthInit.value || getTimeSinceLastCheck() > HEALTH_CHECK_INTERVAL * 2
}