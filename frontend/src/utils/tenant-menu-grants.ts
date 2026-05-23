export interface TenantMenuGrantNode {
  id: number
  name: string
  permission?: string | null
  type?: string | null
  isTenantGranted?: boolean
  children?: TenantMenuGrantNode[]
}

export function collectGrantedMenuIds(menus: readonly TenantMenuGrantNode[]): number[] {
  const ids: number[] = []

  const walk = (items: readonly TenantMenuGrantNode[]) => {
    for (const item of items) {
      if (item.isTenantGranted) {
        ids.push(item.id)
      }
      if (item.children?.length) {
        walk(item.children)
      }
    }
  }

  walk(menus)
  return ids
}

export function formatTenantMenuGrantLabel(menu: TenantMenuGrantNode): string {
  if (menu.type === 'button' && menu.permission) {
    return `${menu.name} (${menu.permission})`
  }

  return menu.name
}

export function getTenantMenuGrantSyncActions(): string[] {
  return [
    '更新租户可用菜单和按钮权限范围',
    '自动补齐已选菜单所需的父级菜单',
    '从租户角色中移除已撤回的菜单权限',
  ]
}
