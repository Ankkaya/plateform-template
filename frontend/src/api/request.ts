import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import type { ApiResponse, AuthResponse } from '@/types/api/index.ts'
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
  shouldRefreshAccessToken,
} from '@/utils/auth-refresh'
import { getTenantId } from '@/utils/tenant'
import { clearPlatformAuthToken, getPlatformAuthToken } from '@/utils/platform-auth'

// ==================== 自定义 Axios 实例类型 ====================
/**
 * 自定义 API 客户端接口
 * 
 * 后端返回标准格式: ApiResponse<T> = { code, message, data }
 * 响应拦截器会自动解包，返回 data 部分
 * 因此泛型参数 T 直接对应 data 的类型
 */
export interface ApiClient {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T>
}

// ==================== 创建 Axios 实例 ====================
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const instance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

const refreshInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

const platformInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

let refreshRequest: Promise<AuthResponse> | null = null

function attachTenantHeader(config: InternalAxiosRequestConfig) {
  const tenantId = getTenantId()
  if (tenantId) {
    config.headers.tenant_id = tenantId
  }
  return config
}

function redirectToLogin() {
  clearAuthTokens()
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}

function redirectToPlatformLogin() {
  clearPlatformAuthToken()
  if (typeof window !== 'undefined') {
    window.location.href = '/platform/login'
  }
}

function unwrapApiData(responseData: unknown) {
  const data = responseData as ApiResponse<unknown>

  if (data && typeof data === 'object' && 'data' in data) {
    return data.data
  }

  return data
}

function getResponseMessage(data: unknown) {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message
    return typeof message === 'string' ? message : ''
  }

  return ''
}

function getHttpErrorMessage(error: unknown) {
  const response = (error as { response?: { status?: number; data?: unknown } }).response
  if (!response) {
    return '网络连接异常'
  }

  const responseMessage = getResponseMessage(response.data)
  switch (response.status) {
    case 401:
      return responseMessage || '登录已过期'
    case 403:
      return responseMessage || '没有权限'
    case 404:
      return responseMessage || '请求的资源不存在'
    case 500:
      return responseMessage || '服务器错误'
    default:
      return responseMessage || '请求失败'
  }
}

async function requestFreshTokens() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    throw new Error('Missing refresh token')
  }

  if (!refreshRequest) {
    refreshRequest = refreshInstance
      .post<ApiResponse<AuthResponse>>('/auth/refresh', { refreshToken })
      .then((response) => {
        const tokens = response.data.data
        if (!tokens?.token || !tokens.refreshToken) {
          throw new Error('Invalid refresh token response')
        }
        setAuthTokens(tokens)
        return tokens
      })
      .finally(() => {
        refreshRequest = null
      })
  }

  return refreshRequest
}

// ==================== 请求拦截器 ====================
instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    attachTenantHeader(config)
    const token = getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

refreshInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    attachTenantHeader(config)
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

platformInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getPlatformAuthToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// ==================== 响应拦截器 ====================
instance.interceptors.response.use(
  (response): any => {
    return unwrapApiData(response.data)
  },
  async (error) => {
    const { response, config } = error
    const requestConfig = config as RetriableRequestConfig | undefined
    const refreshToken = getRefreshToken()

    if (
      response &&
      requestConfig &&
      shouldRefreshAccessToken({
        status: response.status,
        url: requestConfig.url,
        retry: requestConfig._retry,
        hasRefreshToken: !!refreshToken,
      })
    ) {
      requestConfig._retry = true

      try {
        const tokens = await requestFreshTokens()
        requestConfig.headers.Authorization = `Bearer ${tokens.token}`
        return instance.request(requestConfig)
      } catch (refreshError) {
        redirectToLogin()
        return Promise.reject({ message: '登录已过期', originalError: refreshError })
      }
    }
    
    if (response?.status === 401) {
      redirectToLogin()
    }
    
    return Promise.reject({ message: getHttpErrorMessage(error), originalError: error })
  }
)

platformInstance.interceptors.response.use(
  (response): any => {
    return unwrapApiData(response.data)
  },
  (error) => {
    const response = (error as { response?: { status?: number } }).response
    if (response?.status === 401) {
      redirectToPlatformLogin()
    }

    return Promise.reject({ message: getHttpErrorMessage(error), originalError: error })
  }
)

// ==================== 导出带类型的 API 客户端 ====================
export const tenantApi = instance as unknown as ApiClient
export const platformApi = platformInstance as unknown as ApiClient
const api = tenantApi
export default api
