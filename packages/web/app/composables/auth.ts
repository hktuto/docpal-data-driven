import { apiClient } from 'api-client'
import { EventType, emitBus } from 'eventbus'

export const useIsAuthenticated = () => useState('isAuthenticated', () => false)
export const useUser = () => useState<any>('user', () => null)
export const useAuthInit = () => useState('authInit', () => false)


export async function getMe() { 
  const isAuthenticated = useIsAuthenticated()
  const authInit = useAuthInit()
  const user = useUser()
  
  if (isAuthenticated.value && user.value) {
    return true;
  }
  
  try {
    const response = await apiClient.auth.getSession()
    
    if (response) {
      isAuthenticated.value = true
      user.value = response.user
      
      // If this is a new login detection, emit user login event
      if (!authInit.value) {
        emitBus(EventType.USER_LOGIN__SUCCESS, {
          user: {
            id: response?.user?.id || 'unknown',
            email: response?.user?.email || 'unknown',
            name: response?.user?.first_name || response?.user?.last_name ? 
              `${response?.user?.first_name || ''} ${response?.user?.last_name || ''}`.trim() : undefined,
          },
          timestamp: Date.now(),
          loginMethod: 'session'
        })
      }
    }
  } catch(e) {
    console.log(e)
  } finally {
    authInit.value = true
  }
} 
export async function loginApi(email: string, password: string, companyId?: string) {
  const isAuthenticated = useIsAuthenticated()
  const user = useUser()
  const authInit = useAuthInit()
  
  try {
    const loginData: any = {
      email,
      password
    }
    
    // Add companyId if provided (required by current API)
    if (companyId) {
      loginData.companyId = companyId
    }
    
    const response = await apiClient.auth.postLogin(loginData)
    
    if (response) {
      isAuthenticated.value = true
      user.value = response
      authInit.value = true
      await nextTick(async() => {
        await getMe()
      })
      // Emit user login event
      emitBus(EventType.USER_LOGIN__SUCCESS, {
        user: {
          id: response?.user?.id || 'unknown',
          email: response?.user?.email || email,
        },
        timestamp: Date.now(),
        loginMethod: 'email'
      })
    }
    
    return response
  } catch(error) {
    console.log(error)
    throw error
  }
}
export async function logout(reason: 'manual' | 'timeout' | 'force' | 'token_expired' = 'manual') {
  const isAuthenticated = useIsAuthenticated()
  const user = useUser()
  const currentUser = user.value
  const router = useRouter()
  // Emit logout event before clearing state
  if (currentUser) {
    emitBus(EventType.USER_LOGIN__EXPIRE, {
      userId: currentUser.id || currentUser.userId || 'unknown',
      timestamp: Date.now(),
      reason
    })
  }
  
  try {
    await apiClient.auth.postLogout()
  } catch(error) {
    console.error(error);
  } finally {
    isAuthenticated.value = false
    user.value = null
    router.push('/login')
  }
}

