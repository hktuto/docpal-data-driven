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
      user.value = response.data
      
      // If this is a new login detection, emit user login event
      if (!authInit.value) {
        emitBus(EventType.USER_LOGIN__SUCCESS, {
          user: {
            id: response.data?.id || 'unknown',
            email: response.data?.email || 'unknown',
            name: response.data?.name,
          },
          timestamp: Date.now(),
          loginMethod: 'session',
          sessionId: (response.data as any)?.sessionId
        })
      }
    }
  } catch(e) {
    console.log(e)
  } finally {
    authInit.value = true
  }
} 
export async function loginApi(email: string, password: string) {
  const isAuthenticated = useIsAuthenticated()
  const user = useUser()
  const authInit = useAuthInit()
  
  try {
    const response = await apiClient.auth.postLogin({
      email,
      password
    })
    
    if (response.data) {
      isAuthenticated.value = true
      user.value = response.data
      authInit.value = true
      
      // Emit user login event
      emitBus(EventType.USER_LOGIN__SUCCESS, {
        user: {
          id: response.data?.id || 'unknown',
          email: response.data?.email || email,
          name: response.data?.name,
        },
        timestamp: Date.now(),
        loginMethod: 'email',
        sessionId: (response.data as any)?.sessionId
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
      reason,
      sessionId: currentUser.sessionId
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

