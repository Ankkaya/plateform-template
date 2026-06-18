import forge from 'node-forge'
import api from '@/api/request'
import { platformApi } from '@/api/request'

interface PublicKeyResponse {
  publicKey: string
  timestamp: number
}

interface CachedKey {
  publicKey: string
  expiresAt: number
}

const CACHE_TTL_MS = 10 * 60 * 1000
let cached: CachedKey | null = null
let platformCached: CachedKey | null = null
let pending: Promise<string> | null = null
let platformPending: Promise<string> | null = null

async function fetchPublicKey(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) {
    return cached.publicKey
  }
  if (!pending) {
    pending = api
      .get<PublicKeyResponse>('/auth/public-key')
      .then((res) => {
        cached = {
          publicKey: res.publicKey,
          expiresAt: Date.now() + CACHE_TTL_MS,
        }
        return res.publicKey
      })
      .finally(() => {
        pending = null
      })
  }
  return pending
}

async function fetchPlatformPublicKey(): Promise<string> {
  if (platformCached && Date.now() < platformCached.expiresAt) {
    return platformCached.publicKey
  }
  if (!platformPending) {
    platformPending = platformApi
      .get<PublicKeyResponse>('/platform/auth/public-key')
      .then((res) => {
        platformCached = {
          publicKey: res.publicKey,
          expiresAt: Date.now() + CACHE_TTL_MS,
        }
        return res.publicKey
      })
      .finally(() => {
        platformPending = null
      })
  }
  return platformPending
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s/g, '')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function encryptWithWebCrypto(publicKey: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(publicKey),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    key,
    new TextEncoder().encode(payload),
  )
  return arrayBufferToBase64(encrypted)
}

function encryptWithForge(publicKey: string, payload: string): string {
  const key = forge.pki.publicKeyFromPem(publicKey)
  const encrypted = key.encrypt(forge.util.encodeUtf8(payload), 'RSA-OAEP', {
    md: forge.md.sha256.create(),
    mgf1: {
      md: forge.md.sha256.create(),
    },
  })
  return forge.util.encode64(encrypted)
}

async function rsaEncrypt(publicKey: string, plain: string): Promise<string> {
  const payload = `${plain}::${Date.now()}`
  if (globalThis.crypto?.subtle) {
    return encryptWithWebCrypto(publicKey, payload)
  }
  return encryptWithForge(publicKey, payload)
}

/**
 * RSA-OAEP-SHA256 加密登录密码（租户端）
 * @param plain 明文密码
 * @returns base64 密文
 */
export async function encryptPassword(plain: string): Promise<string> {
  const publicKey = await fetchPublicKey()
  return rsaEncrypt(publicKey, plain)
}

/**
 * RSA-OAEP-SHA256 加密登录密码（平台端）
 * @param plain 明文密码
 * @returns base64 密文
 */
export async function encryptPlatformPassword(plain: string): Promise<string> {
  const publicKey = await fetchPlatformPublicKey()
  return rsaEncrypt(publicKey, plain)
}

/** 测试用：清除本地缓存（例如服务端密钥轮换） */
export function clearPublicKeyCache(): void {
  cached = null
  platformCached = null
}
