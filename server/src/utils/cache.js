import { isProd } from '../config/env.js'

// Tiny in-memory TTL cache for expensive, user-independent aggregations.
// Disabled outside production so development and tests always see fresh data.
const store = new Map()
export async function cached(key, ttlMs, fn) {
  const hit = store.get(key)
  if (isProd && hit && hit.exp > Date.now()) return hit.value
  const value = await fn()
  if (isProd) store.set(key, { value, exp: Date.now() + ttlMs })
  return value
}
