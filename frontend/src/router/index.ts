import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store'
import { APP_TITLE } from '@/constants/app'

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
      path: '/',
      component: () => import('@/views/layout/index.vue'),
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/layout/components/Dashboard.vue'),
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
          component: () => import('@/views/users/index.vue'),
          meta: { title: '用户管理', permission: 'system:user:view' }
        },
        {
          path: 'roles',
          name: 'system-roles',
          component: () => import('@/views/roles/index.vue'),
          meta: { title: '角色管理', permission: 'system:role:view' }
        },
        {
          path: 'menus',
          name: 'system-menus',
          component: () => import('@/views/menus/index.vue'),
          meta: { title: '菜单管理', permission: 'system:menu:view' }
        },
        {
          path: 'settings',
          name: 'system-settings',
          component: () => import('@/views/system-settings/index.vue'),
          meta: { title: '系统配置', permission: 'system:setting:view' }
        },
        {
          path: 'dictionaries',
          name: 'system-dictionaries',
          component: () => import('@/views/dictionaries/index.vue'),
          meta: { title: '字典管理', permission: 'system:dictionary:view' }
        },
        {
          path: 'logs',
          name: 'system-logs',
          component: () => import('@/views/system-logs/index.vue'),
          meta: { title: '操作日志', permission: 'system:log:view' }
        },
        {
          path: 'upload-records',
          name: 'upload-records',
          component: () => import('@/views/upload-records/index.vue'),
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
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard'
    }
  ]
})

// 路由守卫
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  if (to.meta.public) {
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
