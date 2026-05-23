import { platformApi } from './request'
import type { PlatformAuthApi, PlatformLoginParams } from '@/types/api/index.ts'

export const login = (data: PlatformLoginParams) => {
  return platformApi.post<PlatformAuthApi.Login>('/platform/auth/login', data)
}

export const getCurrentPlatformUser = () => {
  return platformApi.get<PlatformAuthApi.GetCurrentUser>('/platform/auth/me')
}

export const logout = () => {
  return platformApi.post<PlatformAuthApi.Logout>('/platform/auth/logout')
}
