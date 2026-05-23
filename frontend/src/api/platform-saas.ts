import { platformApi } from './request'
import type { PlatformSaasApi } from '@/types/api/index.ts'

export const getPlatformTenants = () => {
  return platformApi.get<PlatformSaasApi.TenantList>('/platform/tenants')
}

export const getPlatformTenant = (id: number) => {
  return platformApi.get<PlatformSaasApi.TenantDetail>(`/platform/tenants/${id}`)
}

export const createPlatformTenant = (data: PlatformSaasApi.CreateTenantParams) => {
  return platformApi.post<PlatformSaasApi.CreateTenant>('/platform/tenants', data)
}

export const updatePlatformTenant = (id: number, data: PlatformSaasApi.UpdateTenantParams) => {
  return platformApi.patch<PlatformSaasApi.UpdateTenant>(`/platform/tenants/${id}`, data)
}

export const deletePlatformTenant = (id: number) => {
  return platformApi.delete<PlatformSaasApi.DeleteTenant>(`/platform/tenants/${id}`)
}

export const getPlatformTenantMenus = (id: number) => {
  return platformApi.get<PlatformSaasApi.TenantMenuList>(`/platform/tenants/${id}/menus`)
}

export const updatePlatformTenantMenuGrants = (
  id: number,
  data: PlatformSaasApi.UpdateTenantMenuGrantsParams,
) => {
  return platformApi.patch<PlatformSaasApi.UpdateTenantMenuGrants>(`/platform/tenants/${id}/menus`, data)
}

export const getPlatformMenus = (format?: 'tree' | 'flat') => {
  return platformApi.get<PlatformSaasApi.MenuList>('/platform/menus', {
    params: { format },
  })
}

export const getPlatformMenu = (id: number) => {
  return platformApi.get<PlatformSaasApi.MenuDetail>(`/platform/menus/${id}`)
}

export const createPlatformMenu = (data: PlatformSaasApi.CreateMenuParams) => {
  return platformApi.post<PlatformSaasApi.CreateMenu>('/platform/menus', data)
}

export const updatePlatformMenu = (id: number, data: PlatformSaasApi.UpdateMenuParams) => {
  return platformApi.patch<PlatformSaasApi.UpdateMenu>(`/platform/menus/${id}`, data)
}

export const deletePlatformMenu = (id: number) => {
  return platformApi.delete<PlatformSaasApi.DeleteMenu>(`/platform/menus/${id}`)
}

export const batchDeletePlatformMenus = (ids: number[]) => {
  const data: PlatformSaasApi.BatchDeleteMenusParams = { ids }
  return platformApi.delete<PlatformSaasApi.BatchDeleteMenus>('/platform/menus/batch', { data })
}

export const getPlatformPlans = () => {
  return platformApi.get<PlatformSaasApi.PlanList>('/platform/plans')
}

export const getPlatformPlan = (id: number) => {
  return platformApi.get<PlatformSaasApi.PlanDetail>(`/platform/plans/${id}`)
}

export const createPlatformPlan = (data: PlatformSaasApi.CreatePlanParams) => {
  return platformApi.post<PlatformSaasApi.CreatePlan>('/platform/plans', data)
}

export const updatePlatformPlan = (id: number, data: PlatformSaasApi.UpdatePlanParams) => {
  return platformApi.patch<PlatformSaasApi.UpdatePlan>(`/platform/plans/${id}`, data)
}

export const deletePlatformPlan = (id: number) => {
  return platformApi.delete<PlatformSaasApi.DeletePlan>(`/platform/plans/${id}`)
}

export const getPlatformSubscriptions = () => {
  return platformApi.get<PlatformSaasApi.SubscriptionList>('/platform/subscriptions')
}

export const cancelPlatformSubscription = (id: number) => {
  return platformApi.patch<PlatformSaasApi.CancelSubscription>(`/platform/subscriptions/${id}/cancel`)
}
