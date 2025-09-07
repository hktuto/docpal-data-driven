import { api } from './generate/client'
export * from './generate/client'
export const apiClient = new api({
  baseURL: 'http://localhost:3333',
  timeout: 50000,
  withCredentials: true
})

