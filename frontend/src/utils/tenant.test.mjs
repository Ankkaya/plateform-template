import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getTenantId,
  normalizeTenantId,
  setTenantId,
} from './tenant.ts'

function createStorage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

test('normalizes tenant ids as positive integers', () => {
  assert.equal(normalizeTenantId(' 12 '), '12')
  assert.equal(normalizeTenantId('001'), '1')
  assert.equal(normalizeTenantId('0'), null)
  assert.equal(normalizeTenantId('-1'), null)
  assert.equal(normalizeTenantId('abc'), null)
})

test('stores normalized tenant ids', () => {
  globalThis.localStorage = createStorage()

  setTenantId(' 003 ')

  assert.equal(getTenantId(), '3')
})
