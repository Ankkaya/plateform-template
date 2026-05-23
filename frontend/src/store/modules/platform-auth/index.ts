import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import router from '@/router'
import { getCurrentPlatformUser, login as loginApi, logout as logoutApi } from '@/api/platform-auth'
import type { PlatformUser } from '@/types'
import {
  clearPlatformAuthToken,
  getPlatformAuthToken,
  setPlatformAuthToken,
} from '@/utils/platform-auth'
import { hasPlatformPermission } from '@/utils/platform-permissions'

export const usePlatformAuthStore = defineStore('platform-auth', () => {
  const token = ref(getPlatformAuthToken())
  const user = ref<PlatformUser | null>(null)
  const loading = ref(false)

  const isLoggedIn = computed(() => !!token.value)

  const hasPermission = (permission?: string | string[]) => {
    return hasPlatformPermission(user.value, permission)
  }

  const login = async (username: string, password: string) => {
    loading.value = true
    try {
      const res = await loginApi({ username, password })
      token.value = res.token
      user.value = res.user
      setPlatformAuthToken(res.token)
      return true
    } catch {
      clearSession()
      return false
    } finally {
      loading.value = false
    }
  }

  const fetchUser = async () => {
    if (!token.value) return
    try {
      user.value = await getCurrentPlatformUser()
      token.value = getPlatformAuthToken()
    } catch {
      clearSession()
      throw new Error('Platform user initialization failed')
    }
  }

  const clearSession = () => {
    token.value = ''
    user.value = null
    clearPlatformAuthToken()
  }

  const logout = async () => {
    if (token.value) {
      await logoutApi().catch(() => undefined)
    }
    clearSession()
    router.push('/platform/login')
  }

  const init = async () => {
    if (token.value && !user.value) {
      await fetchUser()
    }
  }

  return {
    token,
    user,
    loading,
    isLoggedIn,
    hasPermission,
    login,
    fetchUser,
    clearSession,
    logout,
    init,
  }
})
