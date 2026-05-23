import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearPlatformToken,
  getPlatformToken,
  setPlatformToken,
} from './platform-auth.ts'

function createStorage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

test('stores platform token separately from tenant auth tokens', () => {
  globalThis.localStorage = createStorage()
  globalThis.localStorage.setItem('token', 'tenant-access-token')

  setPlatformToken('platform-token')

  assert.equal(getPlatformToken(), 'platform-token')
  assert.equal(globalThis.localStorage.getItem('token'), 'tenant-access-token')

  clearPlatformToken()

  assert.equal(getPlatformToken(), '')
  assert.equal(globalThis.localStorage.getItem('token'), 'tenant-access-token')
})
