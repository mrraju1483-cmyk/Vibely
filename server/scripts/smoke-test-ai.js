// Phase 10 checks. Needs only MongoDB (from server/.env). The API runs inside this script, talking to a small
// STUB AI service that exists only for this test, so the Node side is verified without any model or API key:  npm run test:ai
import http from 'http'
import mongoose from 'mongoose'
import User from '../src/models/User.js'
import Conversation from '../src/models/Conversation.js'
import Message from '../src/models/Message.js'
import AIRequest from '../src/models/AIRequest.js'
import OTP from '../src/models/OTPVerification.js'

const KEY = 'test-internal-key-123456'
process.env.AI_SERVICE_KEY = KEY
process.env.AI_RATE_LIMIT_MAX = '12'
process.env.NODE_ENV = 'development' // the dev OTP code is only returned outside production

// ---- stub AI service (test only) ----
let mode = 'ok'
const seen = []
const stub = http.createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : null
    seen.push({ url: req.url, key: req.headers['x-internal-key'], headers: req.headers, body })
    const out = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)) }
    if (req.headers['x-internal-key'] !== KEY) return out(401, { detail: 'unauthorized' })
    if (req.url === '/v1/status') return out(200, { success: true, data: { configured: true } })
    if (mode === 'notconfigured') return out(503, { success: false, code: 'AI_NOT_CONFIGURED', message: 'x' })
    if (mode === 'busy') return out(429, { success: false, code: 'AI_PROVIDER_RATE_LIMIT', message: 'x' })
    if (mode === 'error') return out(502, { success: false, code: 'AI_PROVIDER_ERROR', message: 'x' })
    if (req.url === '/v1/chat') return out(200, { success: true, data: { reply: `echo: ${body.messages.at(-1).content}`, model: 'stub-model' } })
    if (req.url === '/v1/captions') return out(200, { success: true, data: { captions: Array.from({ length: body.count }, (_, i) => `caption ${i + 1} about ${body.topic}`), model: 'stub-model' } })
    if (req.url === '/v1/smart-replies') return out(200, { success: true, data: { replies: ['Sure!', 'Sounds good', 'On my way'], model: 'stub-model' } })
    if (req.url === '/v1/safety') {
      const bad = /kill/i.test(body.text || '')
      return out(200, { success: true, data: { flagged: bad, severity: bad ? 'high' : 'none', categories: bad ? ['violence'] : [], reason: '', method: 'llm+rules', degraded: false, model: 'stub-model' } })
    }
    return out(404, { success: false, code: 'NOPE' })
  })
})
await new Promise((r) => stub.listen(0, '127.0.0.1', r))
process.env.AI_SERVICE_URL = `http://127.0.0.1:${stub.address().port}`

// Import the API only now, so it sees the variables above
const { env } = await import('../src/config/env.js')
const { default: app } = await import('../src/app.js')
await mongoose.connect(env.mongoUri)
const api = app.listen(0, '127.0.0.1')
await new Promise((r) => api.once('listening', r))
const BASE = `http://127.0.0.1:${api.address().port}/api`

let pass = 0, fail = 0
const t = async (name, fn) => { try { await fn(); console.log('PASS', name); pass++ } catch (e) { console.log('FAIL', name, '-', e.message); fail++ } }
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${b}, got ${a}`) }
const call = async (method, path, body, token) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) })
  let j = {}; try { j = await r.json() } catch {}
  return { status: r.status, body: j, data: j.data, code: j.code }
}
const s = Date.now().toString(36)
const rnd = () => String(Math.floor(Math.random() * 1e9)).padStart(9, '0')
let n = 0
async function makeUser(tag) {
  const u = { fullName: `AI ${tag}`, username: `${tag}${s}${n++}`.slice(0, 20), email: `${tag}${s}${n}@test.dev`, phone: '9' + rnd(), password: 'Passw0rd1' }
  const reg = await call('POST', '/auth/register', u)
  if (reg.status !== 201) throw new Error('register failed: ' + reg.body.message)
  await call('POST', '/auth/verify-otp', { identifier: u.email, otp: reg.data.devOtp })
  const login = await call('POST', '/auth/login', { identifier: u.email, password: u.password })
  return { ...u, token: login.data.token, id: login.data.user.id }
}
const users = []
const fresh = async (tag) => { const u = await makeUser(tag); users.push(u); return u }
const lastSeen = (url) => seen.filter((x) => x.url === url).at(-1)

const A = await fresh('a')
await t('no token -> 401 on every AI route', async () => {
  for (const [m, p] of [['GET', '/ai/status'], ['POST', '/ai/chat'], ['POST', '/ai/captions'], ['POST', '/ai/smart-replies'], ['POST', '/ai/safety']]) eq((await call(m, p)).status, 401, p)
})
await t('status: available when the AI service answers', async () => { const r = await call('GET', '/ai/status', null, A.token); eq(r.status, 200); eq(r.data.available, true) })

await t('chat validation', async () => {
  const bad = [{}, { messages: [] }, { messages: [{ role: 'user', content: '' }] }, { messages: [{ role: 'system', content: 'x' }] },
    { messages: [{ role: 'assistant', content: 'x' }] }, { messages: [{ role: 'user', content: 'x'.repeat(2001) }] },
    { messages: Array.from({ length: 21 }, () => ({ role: 'user', content: 'x' })) }]
  for (const b of bad) eq((await call('POST', '/ai/chat', b, A.token)).status, 400, JSON.stringify(b).slice(0, 40))
})
await t('chat: reply comes from the AI service; only the messages are forwarded', async () => {
  const r = await call('POST', '/ai/chat', { messages: [{ role: 'user', content: 'Hello Vibely' }] }, A.token)
  eq(r.status, 200); eq(r.data.reply, 'echo: Hello Vibely'); eq(r.data.model, 'stub-model')
  const sent = lastSeen('/v1/chat')
  eq(sent.key, KEY, 'internal key'); eq(sent.headers.authorization, undefined, 'user token must not be forwarded')
  eq(JSON.stringify(Object.keys(sent.body)), '["messages"]', 'body keys')
})

const B = await fresh('b')
await t('captions: validation + success', async () => {
  eq((await call('POST', '/ai/captions', { topic: '' }, B.token)).status, 400)
  eq((await call('POST', '/ai/captions', { topic: 'x'.repeat(301) }, B.token)).status, 400)
  eq((await call('POST', '/ai/captions', { topic: 'beach', tone: 'angry' }, B.token)).status, 400)
  eq((await call('POST', '/ai/captions', { topic: 'beach', count: 9 }, B.token)).status, 400)
  const r = await call('POST', '/ai/captions', { topic: 'beach day', tone: 'witty', count: 2 }, B.token)
  eq(r.status, 200); eq(r.data.captions.length, 2); eq(lastSeen('/v1/captions').body.tone, 'witty')
})
await t('safety: validation + flagged / clean', async () => {
  eq((await call('POST', '/ai/safety', {}, B.token)).status, 400)
  eq((await call('POST', '/ai/safety', { text: 'x'.repeat(5001) }, B.token)).status, 400)
  const bad = await call('POST', '/ai/safety', { text: 'I will kill you' }, B.token); eq(bad.data.flagged, true); eq(bad.data.severity, 'high')
  const ok = await call('POST', '/ai/safety', { text: 'lovely sunset', metadata: { mediaType: 'image', filename: 'sunset.jpg' } }, B.token); eq(ok.data.flagged, false)
  eq(lastSeen('/v1/safety').body.metadata.filename, 'sunset.jpg')
})

const C = await fresh('c'), D = await fresh('d'), E = await fresh('e')
let conv
await t('smart replies: uses the last messages of YOUR chat', async () => {
  conv = (await call('POST', '/chat/conversations/direct', { userId: D.id }, C.token)).data.conversation
  await call('POST', `/chat/conversations/${conv.id}/messages`, { text: 'Are you coming tonight? secret-plan-xyz' }, C.token)
  const r = await call('POST', '/ai/smart-replies', { conversationId: conv.id }, D.token)
  eq(r.status, 200); eq(r.data.replies.length, 3)
  const sent = lastSeen('/v1/smart-replies').body.messages
  eq(sent.length, 1); eq(sent[0].who, 'them'); eq(sent[0].text.startsWith('Are you coming'), true)
})
await t('smart replies: outsiders, bad ids and empty chats are refused', async () => {
  eq((await call('POST', '/ai/smart-replies', { conversationId: conv.id }, E.token)).status, 404, 'outsider')
  eq((await call('POST', '/ai/smart-replies', { conversationId: 'nope' }, D.token)).status, 400)
  const empty = (await call('POST', '/chat/conversations/direct', { userId: E.id }, D.token)).data.conversation
  const r = await call('POST', '/ai/smart-replies', { conversationId: empty.id }, D.token); eq(r.status, 400); eq(r.code, 'NO_CONTEXT')
})

const F = await fresh('f')
await t('AI failures become friendly errors, never a fake reply', async () => {
  const ask = () => call('POST', '/ai/chat', { messages: [{ role: 'user', content: 'hi' }] }, F.token)
  mode = 'notconfigured'; let r = await ask(); eq(r.status, 503); eq(r.code, 'AI_NOT_CONFIGURED'); eq(r.data, undefined)
  mode = 'busy'; r = await ask(); eq(r.status, 429); eq(r.code, 'AI_BUSY')
  mode = 'error'; r = await ask(); eq(r.status, 502); eq(r.data, undefined)
  mode = 'ok'
})

await t('request log keeps little private data', async () => {
  const long = 'q'.repeat(1500)
  await call('POST', '/ai/chat', { messages: [{ role: 'user', content: long }] }, A.token)
  const chat = await AIRequest.findOne({ user: A.id, requestType: 'chat' }).sort({ createdAt: -1 })
  if (chat.input.length > 300) throw new Error('chat input not truncated: ' + chat.input.length)
  eq(chat.status, 'ok'); eq(chat.model, 'stub-model')
  const sr = await AIRequest.findOne({ user: D.id, requestType: 'smart_reply' })
  eq(sr.input, '[1 messages]'); if (/secret-plan|Are you coming/.test(sr.input + sr.output)) throw new Error('chat text was stored')
  const safety = await AIRequest.findOne({ user: B.id, requestType: 'safety' }); if (!/^\[\d+ chars\]$/.test(safety.input)) throw new Error('safety input: ' + safety.input)
  const err = await AIRequest.findOne({ user: F.id, status: 'error' }); eq(err.errorCode, 'AI_NOT_CONFIGURED')
})

const R = await fresh('r')
await t('rate limit is per user (12 per window in this test)', async () => {
  for (let i = 0; i < 12; i++) eq((await call('POST', '/ai/safety', { text: `ok ${i}` }, R.token)).status, 200, `call ${i + 1}`)
  const over = await call('POST', '/ai/safety', { text: 'one more' }, R.token); eq(over.status, 429); eq(over.code, 'AI_RATE_LIMITED')
  eq((await call('POST', '/ai/safety', { text: 'other user' }, F.token)).status, 200, 'another user is not affected')
})

await t('AI service down -> clear message', async () => {
  const G = await fresh('g')
  await new Promise((r) => stub.close(r))
  const r = await call('POST', '/ai/chat', { messages: [{ role: 'user', content: 'hi' }] }, G.token)
  eq(r.status, 503); eq(r.code, 'AI_UNAVAILABLE'); eq(r.data, undefined)
})

const ids = users.map((u) => u.id)
await Promise.all([
  Message.deleteMany({ sender: { $in: ids } }), Conversation.deleteMany({ 'participants.user': { $in: ids } }),
  AIRequest.deleteMany({ user: { $in: ids } }), OTP.deleteMany({ user: { $in: ids } }), User.deleteMany({ _id: { $in: ids } }),
])
await new Promise((r) => api.close(r))
await mongoose.disconnect()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
