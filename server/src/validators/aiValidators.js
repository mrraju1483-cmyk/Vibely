import { ApiError } from '../utils/ApiError.js'
import { clean } from './userValidators.js'

const fail = (errors) => { throw new ApiError(400, 'Validation failed', { errors }) }
const TONES = ['fun', 'professional', 'inspiring', 'casual', 'witty']

export function validateChat(b = {}) {
  if (!Array.isArray(b.messages) || b.messages.length < 1 || b.messages.length > 20) fail({ messages: 'Send between 1 and 20 messages' })
  let total = 0
  const messages = b.messages.map((m) => {
    const content = typeof m?.content === 'string' ? clean(m.content, true) : ''
    if (!['user', 'assistant'].includes(m?.role) || !content || content.length > 2000) fail({ messages: 'Each message needs a role (user or assistant) and 1-2000 characters of text' })
    total += content.length
    return { role: m.role, content }
  })
  if (total > 8000) fail({ messages: 'The conversation is too long. Start a new chat.' })
  if (messages[messages.length - 1].role !== 'user') fail({ messages: 'The last message must be yours' })
  return { messages }
}

export function validateCaptions(b = {}) {
  const topic = typeof b.topic === 'string' ? clean(b.topic) : ''
  if (!topic || topic.length > 300) fail({ topic: 'Describe your post in 1-300 characters' })
  const tone = b.tone === undefined ? 'fun' : b.tone
  if (!TONES.includes(tone)) fail({ tone: `Tone must be one of: ${TONES.join(', ')}` })
  const count = b.count === undefined ? 3 : Number(b.count)
  if (!Number.isInteger(count) || count < 1 || count > 5) fail({ count: 'Choose 1 to 5 captions' })
  return { topic, tone, count, hashtags: b.hashtags === undefined ? true : b.hashtags === true }
}

export function validateSafety(b = {}) {
  const text = b.text === undefined ? '' : typeof b.text === 'string' ? clean(b.text, true) : null
  if (text === null || text.length > 5000) fail({ text: 'Text must be 5000 characters or fewer' })
  let metadata
  if (b.metadata !== undefined) {
    const m = b.metadata
    if (typeof m !== 'object' || m === null || Array.isArray(m)) fail({ metadata: 'Invalid metadata' })
    const mediaType = m.mediaType === undefined ? undefined : m.mediaType
    const filename = m.filename === undefined ? undefined : typeof m.filename === 'string' ? clean(m.filename) : null
    if ((mediaType !== undefined && !['image', 'video', 'text'].includes(mediaType)) || filename === null || (filename && filename.length > 200)) fail({ metadata: 'Invalid metadata' })
    metadata = { ...(mediaType && { mediaType }), ...(filename && { filename }) }
  }
  if (!text && !(metadata && Object.keys(metadata).length)) fail({ text: 'Provide some text or media details to check' })
  return { ...(text && { text }), ...(metadata && Object.keys(metadata).length && { metadata }) }
}
