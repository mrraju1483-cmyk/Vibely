import AIRequest from '../../models/AIRequest.js'
import { ApiError } from '../../utils/ApiError.js'
import { listMessages } from '../chat/messageService.js'
import { validateChat, validateCaptions, validateSafety } from '../../validators/aiValidators.js'
import { aiConfigured, callAI } from './aiClient.js'

const cut = (s, n) => String(s || '').slice(0, n)

// Records one AI call without keeping private text: see the AIRequest model. A logging failure never breaks the request.
async function record(user, requestType, { input = '', output = '', model = '', status = 'ok', errorCode = '' }) {
  try { await AIRequest.create({ user: user._id, requestType, input: cut(input, 400), output: cut(output, 1000), model, status, errorCode }) } catch (e) { console.error('AI log failed:', e.message) }
}

async function run(user, requestType, input, call, outputOf) {
  try {
    const data = await call()
    await record(user, requestType, { input, output: outputOf(data), model: data.model })
    return data
  } catch (e) {
    await record(user, requestType, { input, status: 'error', errorCode: e.code || 'ERROR' })
    throw e
  }
}

export function chat(user, body) {
  const { messages } = validateChat(body)
  const last = messages[messages.length - 1].content
  return run(user, 'chat', cut(last, 300), () => callAI('/v1/chat', { messages }), (d) => d.reply)
}

export function captions(user, body) {
  const v = validateCaptions(body)
  return run(user, 'caption', cut(v.topic, 200), () => callAI('/v1/captions', v), (d) => d.captions.join(' | '))
}

export function safety(user, body) {
  const v = validateSafety(body)
  const size = v.text ? v.text.length : 0
  return run(user, 'safety', `[${size} chars]`, () => callAI('/v1/safety', v), (d) => `${d.flagged ? 'flagged' : 'ok'}:${d.severity}:${d.categories.join(',')}`)
}

// Uses the last messages of a chat the user belongs to (membership is checked by listMessages). Only text is sent.
export async function smartReplies(user, body = {}) {
  if (typeof body.conversationId !== 'string' || !/^[a-f\d]{24}$/i.test(body.conversationId)) throw new ApiError(400, 'Validation failed', { errors: { conversationId: 'Choose a conversation' } })
  const { messages } = await listMessages(user, body.conversationId, { cursor: null, limit: 10 })
  const lines = messages
    .filter((m) => m.type === 'text' && m.text && !m.deleted)
    .reverse() // oldest first
    .map((m) => ({ who: m.sender.id === user._id.toString() ? 'me' : 'them', text: cut(m.text, 300) }))
  if (!lines.length) throw new ApiError(400, 'There is nothing to reply to yet.', { code: 'NO_CONTEXT' })
  return run(user, 'smart_reply', `[${lines.length} messages]`, () => callAI('/v1/smart-replies', { messages: lines }), (d) => `[${d.replies.length} suggestions]`)
}

let statusCache = { at: 0, value: null }
export async function status() {
  if (!aiConfigured()) return { available: false, reason: 'not_configured' }
  if (statusCache.value && Date.now() - statusCache.at < 30000) return statusCache.value
  let value
  try {
    const d = await callAI('/v1/status', null, { method: 'GET', timeoutMs: 3000 })
    value = d.configured ? { available: true } : { available: false, reason: 'not_configured' }
  } catch {
    value = { available: false, reason: 'unreachable' }
  }
  statusCache = { at: Date.now(), value }
  return value
}
