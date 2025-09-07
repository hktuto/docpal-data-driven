import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(nuxtApp => {
    nuxtApp.$i18n.onBeforeLanguageSwitch = (oldLocale, newLocale, isInitialSetup, nuxtApp) => {
      localStorage.setItem('v_form_locale', newLocale)
      const ev = new CustomEvent('localeChange', { detail: {
          locale: newLocale
      }})
      window.dispatchEvent(ev)
      console.log('localeChange', newLocale)
    }
})
