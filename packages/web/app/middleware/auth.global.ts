import { useIsAuthenticated, useAuthInit, getMe } from "~/composables/auth"
import { 
  useServerHealthy, 
  useServerHealthInit, 
  checkServerHealth,
  isHealthCheckStale 
} from "~/composables/serverHealth"

export default defineNuxtRouteMiddleware( async(to, from) => {
  // Skip health check for server-down page to prevent infinite redirects
  if (to.path === '/server-down') {
    return
  }
  
  // Check server health first
  const serverHealthy = useServerHealthy()
  const serverHealthInit = useServerHealthInit()
  
  // Perform health check if it's stale or hasn't been done yet
  if (!serverHealthInit.value || isHealthCheckStale()) {
    const isHealthy = await checkServerHealth()
    if (!isHealthy) {
      return navigateTo('/server-down')
    }
  } else if (!serverHealthy.value) {
    // If we know the server is unhealthy, redirect immediately
    return navigateTo('/server-down')
  }
  
  // Continue with authentication check only if server is healthy
  const isAuthenticated = useIsAuthenticated()
  const authInit = useAuthInit()
  
  if(!authInit.value){
    await getMe()
  }
  if(isAuthenticated.value && to.path === '/login'){
    return navigateTo('/')
  }
  if(!to.meta.public && !isAuthenticated.value) {
    return navigateTo('/login')
  }
})