import { env } from '../../config/env.js'
import { ApiError } from '../../utils/ApiError.js'

export const aiConfigured = () => !!(env.aiServiceUrl && env.aiServiceKey)
const notConfigured = () => new ApiError(503, 'Vibely AI is not set up on this server yet.', { code: 'AI_NOT_CONFIGURED' })

// Calls the Python AI service. Every failure becomes a clear, friendly ApiError. No fake answer is ever produced here.
export async function callAI(path, body, { method = 'POST', timeoutMs = env.aiTimeoutMs } = {}) {
  if (!aiConfigured()) throw notConfigured()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let res
  try {
    res = await fetch(`${env.aiServiceUrl}${path}`, {
      method, signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'X-Internal-Key': env.aiServiceKey },
      body: method === 'GET' ? undefined : JSON.stringify(body),
    })
  } catch (e) {
    const timeout = e.name === 'AbortError'
    throw new ApiError(503, timeout ? 'Vibely AI took too long to respond. Please try again.' : 'Vibely AI is unavailable right now. Please try again later.', { code: timeout ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE' })
  } finally {
    clearTimeout(timer)
  }
  let json = {}
  try { json = await res.json() } catch { /* not JSON */ }
  if (res.ok && json.success) return json.data

  const code = json.code
  if (code === 'AI_NOT_CONFIGURED') throw notConfigured()
  if (res.status === 429 || code === 'AI_PROVIDER_RATE_LIMIT') throw new ApiError(429, 'Vibely AI is busy right now. Please try again in a moment.', { code: 'AI_BUSY' })
  if (res.status === 504 || code === 'AI_TIMEOUT') throw new ApiError(503, 'Vibely AI took too long to respond. Please try again.', { code: 'AI_TIMEOUT' })
  if (res.status === 400) throw new ApiError(400, 'Vibely AI could not use this request.', { code: 'AI_BAD_REQUEST' })
  if (res.status === 401 || res.status === 403 || code === 'AI_PROVIDER_AUTH') {
    console.error('AI service rejected our credentials (check AI_SERVICE_KEY / provider key)')
    throw new ApiError(502, 'Vibely AI is misconfigured. Please contact support.', { code: 'AI_MISCONFIGURED' })
  }
  throw new ApiError(502, 'Vibely AI could not complete this request. Please try again.', { code: code || 'AI_ERROR' })
}
