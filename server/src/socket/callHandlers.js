import { ApiError } from '../utils/ApiError.js'
import { startCall, acceptCall, rejectCall, cancelCall, endCall, relaySignal } from '../services/callService.js'

// Socket events for calling. Each handler answers through the ack callback: { ok: true, ... } or { ok: false, error }.
export function registerCallHandlers(socket) {
  const userId = socket.data.userId
  let burst = []
  let starts = []

  const limited = (list, max, windowMs) => {
    const now = Date.now()
    while (list.length && now - list[0] > windowMs) list.shift()
    if (list.length >= max) return true
    list.push(now)
    return false
  }

  const on = (event, fn, { isStart = false } = {}) => socket.on(event, async (data, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {}
    try {
      if (limited(burst, 100, 10000) || (isStart && limited(starts, 6, 60000))) throw new ApiError(429, 'Too many requests. Slow down.')
      reply({ ok: true, ...(await fn(userId, data && typeof data === 'object' ? data : {})) })
    } catch (e) {
      if (!(e instanceof ApiError)) console.error('Call event failed:', e.message)
      reply({ ok: false, error: e instanceof ApiError ? e.message : 'Something went wrong' })
    }
  })

  on('call:start', startCall, { isStart: true })
  on('call:accept', acceptCall)
  on('call:reject', rejectCall)
  on('call:cancel', cancelCall)
  on('call:end', endCall)
  on('call:signal', relaySignal)
}
