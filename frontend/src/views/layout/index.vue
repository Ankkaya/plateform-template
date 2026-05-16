<template>
  <div class="h-screen flex flex-col overflow-hidden bg-layout transition-theme">
    <!-- 顶部导航 -->
    <header class="bg-container shadow-header h-16 flex items-center justify-between px-6 z-10 transition-theme">
      <div class="flex items-center gap-4">
        <n-button quaternary circle @click="toggleSidebarCollapsed">
          <template #icon>
            <n-icon class="sidebar-toggle-icon" :class="{ 'sidebar-toggle-icon--collapsed': sidebarCollapsed }">
              <menu-outline />
            </n-icon>
          </template>
        </n-button>
        <h1 class="text-xl font-bold text-base-text">{{ APP_TITLE }}</h1>
      </div>
      <div class="flex items-center gap-4">
        <!-- 主题切换按钮 -->
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

    <n-modal
      v-model:show="profileDialogVisible"
      title="个人信息"
      preset="card"
      style="width: 520px"
    >
      <n-descriptions label-placement="left" :column="1" bordered>
        <n-descriptions-item label="用户名">
          {{ user?.username || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="姓名">
          {{ user?.name || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="邮箱">
          {{ user?.email || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="角色">
          {{ userRoleNames || '-' }}
        </n-descriptions-item>
      </n-descriptions>
      <template #footer>
        <n-space justify="end">
          <n-button @click="profileDialogVisible = false">关闭</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 主体区域 -->
    <div class="flex-1 flex min-h-0 overflow-hidden">
      <!-- 左侧菜单 -->
      <aside
        class="layout-scrollbar shrink-0 overflow-y-auto bg-container border-r border-gray-200 dark:border-gray-700 shadow-sider transition-theme"
        :style="{ width: `${sidebarWidth}px` }"
      >
        <div class="min-h-full py-3">
          <n-menu
            :value="activeMenu"
            :options="menuOptions"
            :collapsed="sidebarCollapsed"
            :collapsed-width="sidebarCollapsedWidth"
            :collapsed-icon-size="18"
            @update:value="handleMenuSelect"
          />
        </div>
      </aside>

      <!-- 右侧内容 -->
      <main class="flex-1 flex min-h-0 flex-col overflow-hidden bg-layout transition-theme">
        <!-- 选项卡栏 -->
        <TabBar />
        <div class="h-10 shrink-0 flex items-center border-b border-gray-200 bg-container px-4 dark:border-gray-700 transition-theme">
          <n-breadcrumb>
            <n-breadcrumb-item
              v-for="item in breadcrumbs"
              :key="item.path || item.title"
              class="cursor-pointer"
              @click="handleBreadcrumbClick(item.path)"
            >
              {{ item.title }}
            </n-breadcrumb-item>
          </n-breadcrumb>
        </div>

        <!-- 页面内容 -->
        <div class="content-scrollbar flex-1 overflow-y-auto">
          <router-view v-slot="{ Component, route }">
            <keep-alive :include="cachedViews">
              <component :is="Component" :key="route.fullPath" />
            </keep-alive>
          </router-view>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store'
import { useThemeStore } from '@/store/modules/theme'
import {
  PersonOutline,
  ChevronDownOutline,
  MenuOutline,
} from '@vicons/ionicons5'
import { NIcon, useMessage } from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import AppIcon from '@/components/common/AppIcon.vue'
import ThemeSchemaSwitch from '@/components/common/ThemeSchemaSwitch.vue'
import TabBar from '@/components/TabBar/index.vue'
import { useTabStore } from '@/store/modules/tab'
import type { Menu } from '@/types'
import { APP_TITLE } from '@/constants/app'
import { localStg } from '@/utils/storage'

interface BreadcrumbItem {
  title: string
  path?: string
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const themeStore = useThemeStore()
const tabStore = useTabStore()
const message = useMessage()
const sidebarCollapsedWidth = 64
const sidebarExpandedWidth = 208
const sidebarCollapsed = ref(localStg.get<boolean>('layoutSidebarCollapsed') ?? false)
const profileDialogVisible = ref(false)
const sidebarWidth = computed(() => (
  sidebarCollapsed.value ? sidebarCollapsedWidth : sidebarExpandedWidth
))

// 页面缓存列表
const cachedViews = computed(() => tabStore.cachedViews)

// 监听路由变化，添加标签
watch(
  () => route.fullPath,
  () => {
    tabStore.addTab(route)
  },
  { immediate: true }
)

const user = computed(() => authStore.user)
const userRoleNames = computed(() => (
  authStore.user?.roles?.map(role => role.name).filter(Boolean).join('、') || ''
))
const activeMenu = computed(() => route.path)
const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  if (route.path === '/dashboard') {
    return [{ title: '首页', path: '/dashboard' }]
  }

  const menuTrail = authStore.findMenuTrail(route.path)
  if (menuTrail.length > 0) {
    return [
      { title: '首页', path: '/dashboard' },
      ...menuTrail.map(menu => ({
        title: menu.name,
        path: menu.path,
      })),
    ]
  }

  const matched = route.matched
    .filter(record => record.meta?.title && !record.meta?.hidden)
    .map(record => ({
      title: String(record.meta.title),
      path: record.path,
    }))

  return [{ title: '首页', path: '/dashboard' }, ...matched]
})

watch(
  () => breadcrumbs.value[breadcrumbs.value.length - 1]?.title,
  (title) => {
    document.title = title ? `${title} - ${APP_TITLE}` : APP_TITLE
  },
  { immediate: true }
)

// 图标渲染函数
const renderIcon = (menu?: Pick<Menu, 'icon' | 'iconUrl'>) => {
  if (menu?.iconUrl || menu?.icon) {
    return () => h(AppIcon, {
      icon: menu.icon,
      iconUrl: menu.iconUrl,
      size: 18,
      alt: menu.icon,
      useMask: true,
    })
  }
  return () => h(NIcon, null, { default: () => h(MenuOutline) })
}

// 将后端菜单转换为 Naive UI 菜单选项
const mapMenuToOption = (menu: Menu): MenuOption => {
  const children = menu.children
    ?.filter(isVisibleMenu)
    .map(mapMenuToOption)

  return {
    label: menu.name,
    key: menu.path || String(menu.id),
    icon: renderIcon(menu),
    children: children?.length ? children : undefined
  }
}

const isVisibleMenu = (menu: Menu) => !menu.hidden && menu.type !== 'button'

// 动态菜单选项
const menuOptions = computed<MenuOption[]>(() => {
  const dashboardOption: MenuOption = {
    label: '首页',
    key: '/dashboard',
    icon: renderIcon({ icon: 'material-symbols:home-outline' })
  }

  const dynamicOptions = authStore.menus
    .filter(isVisibleMenu)
    .map(mapMenuToOption)

  return [dashboardOption, ...dynamicOptions]
})

// 下拉选项
const dropdownOptions = [
  { label: '个人信息', key: 'profile' },
  { label: '退出登录', key: 'logout' }
]

const isKnownRoutePath = (path: string) => {
  const matched = router.resolve(path).matched
  return matched.length > 0 && !matched.some(record => record.path.includes(':pathMatch'))
}

const handleMenuSelect = (key: string | number, item: MenuOption) => {
  const path = String(key)
  if (!path) {
    return
  }

  // 检查是否有子菜单，有子菜单则不跳转
  if (item.children && item.children.length > 0) {
    return
  }

  if (!path.startsWith('/') || !isKnownRoutePath(path)) {
    message.error(`菜单路径未注册: ${path}`)
    return
  }

  if (!authStore.canAccessMenuPath(path)) {
    message.error('没有权限访问该菜单')
    return
  }

  router.push(path).catch(err => {
    message.error('页面跳转失败: ' + err.message)
  })
}

const handleBreadcrumbClick = (path?: string) => {
  if (!path || path === route.path || !isKnownRoutePath(path)) {
    return
  }
  router.push(path).catch(() => undefined)
}

const handleSelect = (key: string) => {
  switch (key) {
    case 'profile':
      profileDialogVisible.value = true
      break
    case 'logout':
      authStore.logout()
      break
  }
}

const toggleSidebarCollapsed = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

watch(
  sidebarCollapsed,
  (value) => {
    localStg.set('layoutSidebarCollapsed', value)
  },
  { immediate: true }
)
</script>

<style scoped>
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
