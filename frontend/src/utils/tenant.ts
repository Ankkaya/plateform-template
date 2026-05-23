const TENANT_ID_STORAGE_KEY = 'tenant_id'
const DEFAULT_TENANT_ID = (import.meta as ImportMeta & {
  env?: { VITE_TENANT_ID?: string }
}).env?.VITE_TENANT_ID || '1'

export function normalizeTenantId(value: string) {
  const tenantId = Number(value.trim())
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    return null
  }

  return String(tenantId)
}

function getStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage
}

export function getTenantId() {
  const storage = getStorage()
  if (!storage) {
    return normalizeTenantId(DEFAULT_TENANT_ID) || '1'
  }

  return normalizeTenantId(storage.getItem(TENANT_ID_STORAGE_KEY) || DEFAULT_TENANT_ID) || '1'
}

export function setTenantId(tenantId: string) {
  const storage = getStorage()
  if (!storage) return

  const normalizedTenantId = normalizeTenantId(tenantId)
  if (!normalizedTenantId) {
    throw new Error('Tenant ID must be a positive integer')
  }

  storage.setItem(TENANT_ID_STORAGE_KEY, normalizedTenantId)
}

export function clearTenantId() {
  getStorage()?.removeItem(TENANT_ID_STORAGE_KEY)
}
