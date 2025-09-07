import { startHealthCheck } from '~/composables/serverHealth'

export default defineNuxtPlugin(() => {
  // Start health check monitoring when the app initializes
  if (process.client) {
    // Only run on client side
    startHealthCheck()
  }
})