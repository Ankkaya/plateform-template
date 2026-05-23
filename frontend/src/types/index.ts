// 标准响应格式
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

// 响应数据结构（兼容旧接口）
export interface ResponseData<T> {
  data: T
  message?: string
  statusCode?: number
}

// 分页数据
export interface PageData<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// 登录请求
export interface LoginDto {
  username: string
  password: string
}

// 注册请求
export interface RegisterDto {
  username: string
  password: string
  email?: string
  name?: string
}

// 登录/注册响应
export interface AuthResponse {
  user: User
  token: string
  refreshToken: string
}

export type TenantStatus = 'ACTIVE' | 'DISABLED'
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELED'

export interface PlatformUser {
  id: number
  username: string
  name?: string | null
  email?: string | null
  isEnabled: boolean
  isSuperAdmin: boolean
  permissions: string[]
  createdAt?: string
  updatedAt?: string
}

export interface SaasPlan {
  id: number
  name: string
  code: string
  description?: string | null
  priceCents: number
  userLimit?: number | null
  storageLimitBytes?: string | null
  storageLimitMb?: number | null
  durationDays: number
  isEnabled: boolean
  sort: number
  createdAt: string
  updatedAt: string
}

export interface TenantSubscription {
  id: number
  tenantId: number
  planId: number
  status: SubscriptionStatus
  startsAt: string
  expiresAt?: string | null
  canceledAt?: string | null
  createdAt: string
  updatedAt: string
  tenant?: Tenant
  plan?: SaasPlan
}

export interface Tenant {
  id: number
  name: string
  code: string
  status: TenantStatus
  isEnabled: boolean
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  logoUrl?: string | null
  domain?: string | null
  remark?: string | null
  createdAt: string
  updatedAt: string
  subscription?: TenantSubscription | null
}

export interface CreateSaasPlanDto {
  name: string
  code?: string
  description?: string | null
  priceCents?: number
  userLimit?: number | null
  storageLimitMb?: number | null
  durationDays: number
  isEnabled?: boolean
  sort?: number
}

export interface UpdateSaasPlanDto extends Partial<CreateSaasPlanDto> {}

export interface CreateTenantDto {
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  remark?: string
  planId: number
  adminUsername: string
  adminPassword: string
  adminName?: string
  adminEmail?: string
}

export interface UpdateTenantDto {
  name?: string
  isEnabled?: boolean
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  remark?: string | null
}

// 用户
export interface User {
  id: number
  username: string
  email?: string
  avatar?: string
  avatarUrl?: string
  name?: string
  createdAt: string
  updatedAt: string
  roles?: Role[]
}

// 创建用户
export interface CreateUserDto {
  username: string
  password: string
  email?: string
  avatarUrl?: string | null
  name?: string
}

// 更新用户
export interface UpdateUserDto {
  email?: string
  avatarUrl?: string | null
  password?: string
  name?: string
}

export interface ResetUserPasswordDto {
  password: string
}

// 角色
export interface Role {
  id: number
  name: string
  code: string
  description?: string
  createdAt: string
  updatedAt: string
}

// 字典类型
export interface DictionaryType {
  id: number
  name: string
  code: string
  description: string | null
  isEnabled: boolean
  sort: number
  itemCount?: number
  createdAt: string
  updatedAt: string
}

// 字典项
export interface DictionaryItem {
  id: number
  typeId: number
  label: string
  value: string
  color: string | null
  isEnabled: boolean
  sort: number
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateDictionaryTypeDto {
  name: string
  code: string
  description?: string
  isEnabled?: boolean
  sort?: number
}

export interface UpdateDictionaryTypeDto extends Partial<CreateDictionaryTypeDto> {}

export interface CreateDictionaryItemDto {
  typeId: number
  label: string
  value: string
  color?: string
  isEnabled?: boolean
  sort?: number
  remark?: string
}

export interface UpdateDictionaryItemDto extends Partial<CreateDictionaryItemDto> {}

// 菜单
export interface Menu {
  id: number
  name: string
  path?: string
  icon?: string
  iconUrl?: string
  component?: string
  redirect?: string
  permission?: string
  parentId?: number
  order: number
  hidden: boolean
  isTenantGranted: boolean
  type: 'menu' | 'button' | 'iframe'
  createdAt: string
  updatedAt: string
  children?: Menu[]
}

// 创建菜单
export interface CreateMenuDto {
  name: string
  path?: string
  icon?: string
  iconUrl?: string
  component?: string
  redirect?: string
  permission?: string
  parentId?: number
  order?: number
  hidden?: boolean
  type?: 'menu' | 'button' | 'iframe'
}

// 更新菜单
export interface UpdateMenuDto extends Partial<CreateMenuDto> {}
