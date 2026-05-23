import assert from 'node:assert/strict'
import test from 'node:test'
import { hasPlatformPermission } from './platform-permissions.ts'

const baseUser = {
  id: 1,
  username: 'operator',
  name: 'Operator',
  email: 'operator@example.com',
  isEnabled: true,
  isSuperAdmin: false,
  permissions: ['platform:tenant:view', 'platform:plan:view'],
}

test('allows platform super admins and wildcard permissions', () => {
  assert.equal(hasPlatformPermission({ ...baseUser, isSuperAdmin: true }, 'platform:tenant:delete'), true)
  assert.equal(hasPlatformPermission({ ...baseUser, permissions: ['platform:*'] }, 'platform:plan:delete'), true)
})

test('requires every requested platform permission', () => {
  assert.equal(hasPlatformPermission(baseUser, 'platform:tenant:view'), true)
  assert.equal(hasPlatformPermission(baseUser, ['platform:tenant:view', 'platform:plan:view']), true)
  assert.equal(hasPlatformPermission(baseUser, ['platform:tenant:view', 'platform:subscription:update']), false)
})

test('treats missing permission requirements as public within platform auth', () => {
  assert.equal(hasPlatformPermission(baseUser), true)
  assert.equal(hasPlatformPermission(null, 'platform:tenant:view'), false)
})
