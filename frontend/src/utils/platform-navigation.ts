export interface PlatformNavigationItem<TIcon = unknown> {
  title: string
  key?: string
  path?: string
  permission?: string
  icon?: TIcon
  children?: PlatformNavigationItem<TIcon>[]
}

export function findPlatformMenuTrail<TIcon>(
  menus: readonly PlatformNavigationItem<TIcon>[],
  path: string,
): PlatformNavigationItem<TIcon>[] {
  const walk = (
    items: readonly PlatformNavigationItem<TIcon>[],
    parents: PlatformNavigationItem<TIcon>[] = [],
  ): PlatformNavigationItem<TIcon>[] => {
    for (const item of items) {
      const nextParents = [...parents, item]
      if (item.path === path) {
        return nextParents
      }

      if (item.children?.length) {
        const found = walk(item.children, nextParents)
        if (found.length) {
          return found
        }
      }
    }

    return []
  }

  return walk(menus)
}
