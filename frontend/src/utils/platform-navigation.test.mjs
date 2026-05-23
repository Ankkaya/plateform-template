import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { findPlatformMenuTrail } from './platform-navigation.ts'

const platformLayoutSource = readFileSync(
  new URL('../views/platform/layout/index.vue', import.meta.url),
  'utf8',
)
const platformMenusPageSource = readFileSync(
  new URL('../views/platform/menus/index.vue', import.meta.url),
  'utf8',
)

const menus = [
  {
    title: '租户运营',
    key: 'tenant-operations',
    children: [
      { title: '租户管理', path: '/platform/tenants' },
      { title: '套餐管理', path: '/platform/plans' },
    ],
  },
]

test('finds a breadcrumb trail from the platform menu tree', () => {
  const trail = findPlatformMenuTrail(menus, '/platform/plans')

  assert.deepEqual(
    trail.map(item => item.title),
    ['租户运营', '套餐管理'],
  )
})

test('returns an empty trail when the path is not in the platform menu tree', () => {
  assert.deepEqual(findPlatformMenuTrail(menus, '/platform/unknown'), [])
})

test('places platform menu management under platform system management', () => {
  assert.match(
    platformLayoutSource,
    /title:\s*'系统管理'[\s\S]*path:\s*'\/platform\/menus'/,
  )
  assert.doesNotMatch(
    platformLayoutSource,
    /title:\s*'租户运营'[\s\S]*path:\s*'\/platform\/menus'/,
  )
})

test('does not expose a tenant selector on the global platform menu page', () => {
  assert.doesNotMatch(platformMenusPageSource, /selectedTenantId/)
  assert.doesNotMatch(platformMenusPageSource, /getPlatformTenants/)
  assert.doesNotMatch(platformMenusPageSource, /请选择租户/)
})
