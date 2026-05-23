import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectGrantedMenuIds,
  formatTenantMenuGrantLabel,
  getTenantMenuGrantSyncActions,
} from './tenant-menu-grants.ts'

const menus = [
  {
    id: 1,
    name: 'System',
    isTenantGranted: true,
    type: 'menu',
    children: [
      {
        id: 2,
        name: 'Users',
        isTenantGranted: false,
        type: 'menu',
        children: [
          {
            id: 3,
            name: 'Create user',
            permission: 'system:user:create',
            isTenantGranted: true,
            type: 'button',
          },
        ],
      },
    ],
  },
]

test('collects granted menu ids from nested tenant menu grant trees', () => {
  assert.deepEqual(collectGrantedMenuIds(menus), [1, 3])
})

test('includes permission code in button grant labels', () => {
  assert.equal(formatTenantMenuGrantLabel(menus[0].children[0].children[0]), 'Create user (system:user:create)')
  assert.equal(formatTenantMenuGrantLabel(menus[0]), 'System')
})

test('describes post-sync tenant permission cleanup actions', () => {
  assert.deepEqual(getTenantMenuGrantSyncActions(), [
    '更新租户可用菜单和按钮权限范围',
    '自动补齐已选菜单所需的父级菜单',
    '从租户角色中移除已撤回的菜单权限',
  ])
})
