import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore, usePlatformAuthStore } from '@/store'
import { APP_TITLE } from '@/constants/app'

const PLATFORM_HOME_CANDIDATES = [
  { path: '/platform/tenants', permission: 'platform:tenant:view' },
  { path: '/platform/menus', permission: 'platform:menu:view' },
  { path: '/platform/plans', permission: 'platform:plan:view' },
  { path: '/platform/subscriptions', permission: 'platform:subscription:view' },
]

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/login/index.vue'),
      meta: { public: true }
    },
    {
      path: '/platform/login',
      name: 'platform-login',
      component: () => import('@/views/platform/login/index.vue'),
      meta: { platformPublic: true, title: '平台登录' }
    },
    {
      path: '/',
      component: () => import('@/views/layout/index.vue'),
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/dashboard/index.vue'),
          meta: { title: '首页' }
        }
      ]
    },
    {
      path: '/system',
      component: () => import('@/views/layout/index.vue'),
      redirect: '/system/users',
      meta: { title: '系统管理' },
      children: [
        {
          path: 'users',
          name: 'system-users',
          component: () => import('@/views/system/users/index.vue'),
          meta: { title: '用户管理', permission: 'system:user:view' }
        },
        {
          path: 'roles',
          name: 'system-roles',
          component: () => import('@/views/system/roles/index.vue'),
          meta: { title: '角色管理', permission: 'system:role:view' }
        },
        {
          path: 'menus',
          name: 'system-menus',
          component: () => import('@/views/system/menus/index.vue'),
          meta: { title: '菜单管理', permission: 'system:menu:view' }
        },
        {
          path: 'settings',
          name: 'system-settings',
          component: () => import('@/views/system/settings/index.vue'),
          meta: { title: '系统配置', permission: 'system:setting:view' }
        },
        {
          path: 'dictionaries',
          name: 'system-dictionaries',
          component: () => import('@/views/system/dictionaries/index.vue'),
          meta: { title: '字典管理', permission: 'system:dictionary:view' }
        },
        {
          path: 'logs',
          name: 'system-logs',
          component: () => import('@/views/system/logs/index.vue'),
          meta: { title: '操作日志', permission: 'system:log:view' }
        },
        {
          path: 'upload-records',
          name: 'upload-records',
          component: () => import('@/views/system/upload-records/index.vue'),
          meta: { title: '上传记录', permission: 'system:upload-record:view' }
        }
      ]
    },
    {
      path: '/redirect',
      component: () => import('@/views/layout/index.vue'),
      meta: { hidden: true },
      children: [
        {
          path: '',
          component: () => import('@/views/layout/components/Redirect.vue'),
          meta: { hidden: true }
        }
      ]
    },
    {
      path: '/platform',
      component: () => import('@/views/platform/layout/index.vue'),
      redirect: '/platform/tenants',
      meta: { platform: true, title: '平台控制台' },
      children: [
        {
          path: 'tenants',
          name: 'platform-tenants',
          component: () => import('@/views/platform/tenants/index.vue'),
          meta: { platform: true, title: '租户管理', permission: 'platform:tenant:view' }
        },
        {
          path: 'menus',
          name: 'platform-menus',
          component: () => import('@/views/platform/menus/index.vue'),
          meta: { platform: true, title: '菜单管理', permission: 'platform:menu:view' }
        },
        {
          path: 'plans',
          name: 'platform-plans',
          component: () => import('@/views/platform/plans/index.vue'),
          meta: { platform: true, title: '套餐管理', permission: 'platform:plan:view' }
        },
        {
          path: 'subscriptions',
          name: 'platform-subscriptions',
          component: () => import('@/views/platform/subscriptions/index.vue'),
          meta: { platform: true, title: '订阅管理', permission: 'platform:subscription:view' }
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard'
    }
  ]
})

// 路由守卫
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()
  const platformAuthStore = usePlatformAuthStore()

  if (to.meta.platformPublic) {
    next()
    return
  }

  if (to.meta.public) {
    next()
    return
  }

  if (to.meta.platform) {
    if (!platformAuthStore.isLoggedIn) {
      next({ name: 'platform-login', query: { redirect: to.fullPath } })
      return
    }

    if (!platformAuthStore.user) {
      try {
        await platformAuthStore.init()
      } catch {
        next({ name: 'platform-login' })
        return
      }
    }

    const permission = to.meta.permission as string | string[] | undefined
    if (!platformAuthStore.hasPermission(permission)) {
      const fallback = PLATFORM_HOME_CANDIDATES.find(item => platformAuthStore.hasPermission(item.permission))
      if (fallback && fallback.path !== to.path) {
        next({ path: fallback.path })
        return
      }
      next(false)
      return
    }

    next()
    return
  }

  if (!authStore.isLoggedIn) {
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }

  if (!authStore.user) {
    try {
      await authStore.init()
    } catch (error) {
      next({ name: 'login' })
      return
    }
  }

  const permission = to.meta.permission as string | string[] | undefined
  if (!authStore.hasPermission(permission)) {
    next({ path: '/dashboard' })
    return
  }

  next()
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} - ${APP_TITLE}` : APP_TITLE
})

export default router
