export const PLATFORM_TOKEN_STORAGE_KEY = 'platformToken'

function getStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage
}

export function getPlatformAuthToken() {
  return getStorage()?.getItem(PLATFORM_TOKEN_STORAGE_KEY) || ''
}

export const getPlatformToken = getPlatformAuthToken

export function setPlatformAuthToken(token: string) {
  const storage = getStorage()
  if (!storage) return

  storage.setItem(PLATFORM_TOKEN_STORAGE_KEY, token)
}

export const setPlatformToken = setPlatformAuthToken

export function clearPlatformAuthToken() {
  const storage = getStorage()
  if (!storage) return

  storage.removeItem(PLATFORM_TOKEN_STORAGE_KEY)
}

export const clearPlatformToken = clearPlatformAuthToken
