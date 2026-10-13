import api from './axios.js'

const d = (p) => p.then((r) => r.data.data || {})
const slow = { timeout: 60000 } // models can take a while

export const aiStatusApi = () => d(api.get('/ai/status'))
export const aiChatApi = (messages) => d(api.post('/ai/chat', { messages }, slow))
export const aiCaptionsApi = (body) => d(api.post('/ai/captions', body, slow))
export const aiSmartRepliesApi = (conversationId) => d(api.post('/ai/smart-replies', { conversationId }, slow))
export const aiSafetyApi = (body) => d(api.post('/ai/safety', body, slow))

// Cached for a minute so several components can ask without extra requests
let cache = null
export async function getAIStatus() {
  if (cache && Date.now() - cache.at < 60000) return cache.value
  let value
  try { value = await aiStatusApi() } catch { value = { available: false, reason: 'unreachable' } }
  cache = { at: Date.now(), value }
  return value
}
