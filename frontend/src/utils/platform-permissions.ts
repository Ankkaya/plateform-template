export interface PlatformPermissionUser {
  isSuperAdmin?: boolean
  permissions?: string[] | null
}

export function hasPlatformPermission(
  user: PlatformPermissionUser | null | undefined,
  permission?: string | string[],
) {
  if (!permission) return true
  if (!user) return false
  if (user.isSuperAdmin) return true

  const permissions = user.permissions ?? []
  if (permissions.includes('platform:*')) return true

  const requiredPermissions = Array.isArray(permission) ? permission : [permission]
  return requiredPermissions.every(item => permissions.includes(item))
}
