import type {
  CreateSaasPlanDto,
  CreateTenantDto,
  CreateMenuDto,
  Menu,
  PlatformUser,
  SaasPlan,
  Tenant,
  TenantSubscription,
  UpdateSaasPlanDto,
  UpdateMenuDto,
  UpdateTenantDto,
} from '@/types'

export interface PlatformLoginParams {
  username: string
  password: string
}

export interface PlatformAuthResponse {
  user: PlatformUser
  token: string
}

export namespace PlatformAuthApi {
  export type Login = PlatformAuthResponse
  export type GetCurrentUser = PlatformUser
  export type Logout = { success: boolean }
}

export namespace PlatformSaasApi {
  export type TenantList = Tenant[]
  export type TenantDetail = Tenant
  export type CreateTenant = Tenant
  export type UpdateTenant = Tenant
  export type DeleteTenant = { id: number }
  export type TenantMenuList = Menu[]
  export type UpdateTenantMenuGrants = Menu[]
  export type CreateTenantParams = CreateTenantDto
  export type UpdateTenantParams = UpdateTenantDto
  export type UpdateTenantMenuGrantsParams = { menuIds: number[] }

  export type MenuList = Menu[]
  export type MenuDetail = Menu
  export type CreateMenu = Menu
  export type UpdateMenu = Menu
  export type DeleteMenu = Menu
  export type BatchDeleteMenus = { count: number; ids: number[] }
  export type CreateMenuParams = CreateMenuDto
  export type UpdateMenuParams = UpdateMenuDto
  export type BatchDeleteMenusParams = { ids: number[] }

  export type PlanList = SaasPlan[]
  export type PlanDetail = SaasPlan
  export type CreatePlan = SaasPlan
  export type UpdatePlan = SaasPlan
  export type DeletePlan = { id: number }
  export type CreatePlanParams = CreateSaasPlanDto
  export type UpdatePlanParams = UpdateSaasPlanDto

  export type SubscriptionList = TenantSubscription[]
  export type CancelSubscription = TenantSubscription
}
