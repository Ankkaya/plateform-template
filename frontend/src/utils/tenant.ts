const TENANT_ID_STORAGE_KEY = 'tenant_id'
const DEFAULT_TENANT_ID = import.meta.env.VITE_TENANT_ID || '1'

export function getTenantId() {
  if (typeof window === 'undefined') {
    return DEFAULT_TENANT_ID
  }

  return localStorage.getItem(TENANT_ID_STORAGE_KEY) || DEFAULT_TENANT_ID
}

export function setTenantId(tenantId: string) {
  localStorage.setItem(TENANT_ID_STORAGE_KEY, tenantId)
}

export function clearTenantId() {
  localStorage.removeItem(TENANT_ID_STORAGE_KEY)
}
