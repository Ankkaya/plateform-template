<template>
  <div class="h-screen flex overflow-hidden bg-layout transition-theme">
    <aside
      class="layout-sidebar shrink-0 flex flex-col overflow-hidden bg-container shadow-sider transition-theme"
      :style="{ width: `${sidebarWidth}px` }"
    >
      <div class="sidebar-brand h-16 shrink-0 flex items-center px-4 transition-theme">
        <div class="sidebar-brand__icon">
          <n-icon :size="22">
            <apps-outline />
          </n-icon>
        </div>
        <h1 v-show="!sidebarCollapsed" class="sidebar-brand__title text-base font-semibold text-base-text">
          平台控制台
        </h1>
      </div>

      <div class="layout-scrollbar min-h-0 flex-1 overflow-y-auto py-3">
        <n-menu
          :value="activeMenu"
          :options="menuOptions"
          :default-expanded-keys="defaultExpandedMenuKeys"
          :collapsed="sidebarCollapsed"
          :collapsed-width="sidebarCollapsedWidth"
          :collapsed-icon-size="18"
          @update:value="handleMenuSelect"
        />
      </div>
    </aside>

    <main class="flex-1 flex min-w-0 min-h-0 flex-col overflow-hidden bg-layout transition-theme">
      <header class="bg-container shadow-header h-16 shrink-0 flex items-center justify-between px-4 z-10 transition-theme">
        <div class="min-w-0 flex items-center gap-3">
          <div class="flex shrink-0 items-center">
            <n-button quaternary circle aria-label="折叠菜单" @click="toggleSidebarCollapsed">
              <template #icon>
                <n-icon class="sidebar-toggle-icon" :class="{ 'sidebar-toggle-icon--collapsed': sidebarCollapsed }">
                  <menu-outline />
                </n-icon>
              </template>
            </n-button>
          </div>

          <n-breadcrumb class="min-w-0">
            <n-breadcrumb-item v-for="item in breadcrumbs" :key="item.path || item.title">
              <span class="breadcrumb-label">
                <n-icon :size="16">
                  <component :is="item.icon || MenuOutline" />
                </n-icon>
                <span>{{ item.title }}</span>
              </span>
            </n-breadcrumb-item>
          </n-breadcrumb>
        </div>

        <div class="flex shrink-0 items-center gap-4">
          <ThemeSchemaSwitch :theme-scheme="themeStore.themeScheme" @switch="themeStore.toggleThemeScheme" />

          <n-dropdown trigger="hover" :options="dropdownOptions" @select="handleSelect">
            <div class="user-dropdown-trigger flex items-center gap-2 cursor-pointer">
              <n-avatar :size="32">
                <template #icon>
                  <n-icon><person-outline /></n-icon>
                </template>
              </n-avatar>
              <span class="text-base-text">{{ user?.name || user?.username }}</span>
              <n-icon class="user-dropdown-arrow"><chevron-down-outline /></n-icon>
            </div>
          </n-dropdown>
        </div>
      </header>

      <div class="content-scrollbar flex-1 overflow-y-auto">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, h, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NIcon, useMessage } from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import {
  AppsOutline,
  BusinessOutline,
  ChevronDownOutline,
  PeopleOutline,
  MenuOutline,
  PersonOutline,
  PricetagsOutline,
  ReceiptOutline,
  SettingsOutline,
} from '@vicons/ionicons5'
import ThemeSchemaSwitch from '@/components/common/ThemeSchemaSwitch.vue'
import { usePlatformAuthStore } from '@/store'
import { useThemeStore } from '@/store/modules/theme'
import { localStg } from '@/utils/storage'
import { APP_TITLE } from '@/constants/app'
import {
  findPlatformMenuTrail,
  type PlatformNavigationItem,
} from '@/utils/platform-navigation'

interface PlatformMenu extends PlatformNavigationItem<Component> {
  icon: Component
  children?: PlatformMenu[]
}

interface BreadcrumbItem {
  title: string
  path?: string
  icon?: Component
}

const route = useRoute()
const router = useRouter()
const platformAuthStore = usePlatformAuthStore()
const themeStore = useThemeStore()
const message = useMessage()
const sidebarCollapsedWidth = 64
const sidebarExpandedWidth = 208
const sidebarCollapsed = ref(localStg.get<boolean>('platformSidebarCollapsed') ?? false)
const sidebarWidth = computed(() => (
  sidebarCollapsed.value ? sidebarCollapsedWidth : sidebarExpandedWidth
))

const platformMenus: PlatformMenu[] = [
  {
    title: '系统管理',
    key: 'platform-system',
    icon: SettingsOutline,
    children: [
      {
        title: '菜单管理',
        path: '/platform/menus',
        permission: 'platform:menu:view',
        icon: MenuOutline,
      },
    ],
  },
  {
    title: '租户运营',
    key: 'tenant-operations',
    icon: BusinessOutline,
    children: [
      {
        title: '租户管理',
        path: '/platform/tenants',
        permission: 'platform:tenant:view',
        icon: PeopleOutline,
      },
      {
        title: '套餐管理',
        path: '/platform/plans',
        permission: 'platform:plan:view',
        icon: PricetagsOutline,
      },
      {
        title: '订阅管理',
        path: '/platform/subscriptions',
        permission: 'platform:subscription:view',
        icon: ReceiptOutline,
      },
    ],
  },
]

const defaultExpandedMenuKeys = ['platform-system', 'tenant-operations']

const user = computed(() => platformAuthStore.user)
const activeMenu = computed(() => route.path)
const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const menuTrail = findPlatformMenuTrail(platformMenus, route.path)
  if (menuTrail.length > 0) {
    return menuTrail.map(item => ({
      title: item.title,
      path: item.path,
      icon: item.icon,
    }))
  }

  return route.matched
    .filter(record => record.meta?.title && !record.meta?.hidden)
    .map(record => ({
      title: String(record.meta.title),
      path: record.path,
      icon: MenuOutline,
    }))
})

const renderIcon = (icon: Component) => {
  return () => h(NIcon, null, { default: () => h(icon) })
}

const canShowMenu = (menu: PlatformMenu): boolean => {
  if (menu.children?.length) {
    return menu.children.some(canShowMenu)
  }
  return platformAuthStore.hasPermission(menu.permission)
}

const mapMenuToOption = (menu: PlatformMenu): MenuOption => {
  const children = menu.children
    ?.filter(canShowMenu)
    .map(mapMenuToOption)

  return {
    label: menu.title,
    key: menu.path || menu.key || menu.title,
    icon: renderIcon(menu.icon),
    children: children?.length ? children : undefined,
  }
}

const menuOptions = computed<MenuOption[]>(() => {
  return platformMenus
    .filter(canShowMenu)
    .map(mapMenuToOption)
})

const dropdownOptions = [
  { label: '退出登录', key: 'logout' },
]

const isKnownRoutePath = (path: string) => {
  const matched = router.resolve(path).matched
  return matched.length > 0 && !matched.some(record => record.path.includes(':pathMatch'))
}

const handleMenuSelect = (key: string | number) => {
  const path = String(key)
  if (!path.startsWith('/')) {
    return
  }
  if (!isKnownRoutePath(path)) {
    message.error(`菜单路径未注册: ${path}`)
    return
  }
  router.push(path).catch(err => {
    message.error('页面跳转失败: ' + err.message)
  })
}

const handleSelect = (key: string) => {
  if (key === 'logout') {
    platformAuthStore.logout()
  }
}

const toggleSidebarCollapsed = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

watch(
  () => breadcrumbs.value[breadcrumbs.value.length - 1]?.title,
  (title) => {
    document.title = title ? `${title} - ${APP_TITLE}` : APP_TITLE
  },
  { immediate: true }
)

watch(
  sidebarCollapsed,
  (value) => {
    localStg.set('platformSidebarCollapsed', value)
  },
  { immediate: true }
)
</script>

<style scoped>
.sidebar-brand {
  gap: 12px;
}

.sidebar-brand__icon {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--primary-color);
  background: rgba(59, 130, 246, 0.1);
}

.sidebar-brand__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layout-sidebar {
  box-shadow: 8px 0 18px rgba(15, 23, 42, 0.06);
  z-index: 11;
}

:global(.dark) .layout-sidebar {
  box-shadow: 8px 0 20px rgba(2, 6, 23, 0.28);
}

.breadcrumb-label {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.sidebar-toggle-icon {
  transition: transform 0.24s ease;
}

.sidebar-toggle-icon--collapsed {
  transform: rotate(-180deg);
}

.user-dropdown-arrow {
  transition: transform 0.22s ease;
}

.user-dropdown-trigger:hover .user-dropdown-arrow {
  transform: rotate(180deg);
}
</style>
