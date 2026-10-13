// Phase 8 checks (REST + Socket.IO). Server must be running (OTP_PROVIDER=dev, MEDIA_PROVIDER=local): npm run test:chat
import { io } from 'socket.io-client'
import mongoose from 'mongoose'
import { env } from '../src/config/env.js'
import User from '../src/models/User.js'
import Conversation from '../src/models/Conversation.js'
import Message from '../src/models/Message.js'
import Follow from '../src/models/Follow.js'
import Block from '../src/models/Block.js'
import OTP from '../src/models/OTPVerification.js'
import { deleteMedia } from '../src/services/media/index.js'
import { cleanupExpiredMessages } from '../src/services/chat/messageService.js'

const ORIGIN = process.env.SOCKET_URL || `http://localhost:${env.port}`
const BASE = process.env.API_URL || `${ORIGIN}/api`
let pass = 0, fail = 0
const t = async (name, fn) => { try { await fn(); console.log('PASS', name); pass++ } catch (e) { console.log('FAIL', name, '-', e.message); fail++ } }
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${b}, got ${a}`) }
const call = async (method, path, body, token) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) })
  let j = {}; try { j = await r.json() } catch {}
  return { status: r.status, body: j, data: j.data }
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
async function sendFile(token, convId, file, mime, fields = {}) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  fd.append('media', new Blob([file], { type: mime }), 'upload.bin')
  const r = await fetch(`${BASE}/chat/conversations/${convId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
  let j = {}; try { j = await r.json() } catch {}
  return { status: r.status, body: j, data: j.data }
}
const sock = (token) => new Promise((res, rej) => {
  const s = io(ORIGIN, { auth: { token }, transports: ['websocket'], reconnection: false })
  s.once('connect', () => res(s)); s.once('connect_error', rej)
})
const waitFor = (s, ev, pred = () => true, ms = 3000) => new Promise((res, rej) => {
  const to = setTimeout(() => { s.off(ev, h); rej(new Error('timed out waiting for ' + ev)) }, ms)
  const h = (p) => { if (pred(p)) { clearTimeout(to); s.off(ev, h); res(p) } }
  s.on(ev, h)
})
const expectNone = (s, ev, ms = 800) => new Promise((res, rej) => {
  const to = setTimeout(() => { s.off(ev, h); res() }, ms)
  const h = () => { clearTimeout(to); s.off(ev, h); rej(new Error('unexpected ' + ev)) }
  s.on(ev, h)
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const s0 = Date.now().toString(36)
const rnd = () => String(Math.floor(Math.random() * 1e9)).padStart(9, '0')
async function makeUser(tag) {
  const u = { fullName: `Chat ${tag}`, username: `${tag}${s0}`.slice(0, 20), email: `${tag}${s0}@test.dev`, phone: '9' + rnd(), password: 'Passw0rd1' }
  const reg = await call('POST', '/auth/register', u)
  if (reg.status !== 201) throw new Error('register failed: ' + reg.body.message)
  await call('POST', '/auth/verify-otp', { identifier: u.email, otp: reg.data.devOtp })
  const login = await call('POST', '/auth/login', { identifier: u.email, password: u.password })
  return { ...u, token: login.data.token, id: login.data.user.id }
}
const post = (u, path, body) => call('POST', path, body, u.token)
const send = (u, convId, text) => post(u, `/chat/conversations/${convId}/messages`, { text })

await mongoose.connect(env.mongoUri)
const A = await makeUser('a'), B = await makeUser('b'), C = await makeUser('c'), D = await makeUser('d')
const sockets = []
const open = async (u) => { const s = await sock(u.token); sockets.push(s); return s }
let conv, sA, sB, m1

await t('socket without token is rejected', async () => { await new Promise((res, rej) => { const s = io(ORIGIN, { reconnection: false, transports: ['websocket'] }); s.once('connect', () => { s.close(); rej(new Error('connected without a token')) }); s.once('connect_error', (e) => { s.close(); eq(e.message, 'unauthorized'); res() }) }) })
await t('socket with a bad token is rejected', async () => { try { await sock('not.a.jwt'); throw new Error('connected') } catch (e) { eq(e.message, 'unauthorized') } })
await t('REST without token -> 401', async () => eq((await call('GET', '/chat/conversations')).status, 401))

await t('start direct chat; no duplicates from either side', async () => {
  const r = await post(A, '/chat/conversations/direct', { userId: B.id }); eq(r.status, 201); conv = r.data.conversation; eq(conv.type, 'direct')
  eq((await post(A, '/chat/conversations/direct', { userId: B.id })).data.conversation.id, conv.id, 'repeat')
  eq((await post(B, '/chat/conversations/direct', { userId: A.id })).data.conversation.id, conv.id, 'reverse')
  eq(await Conversation.countDocuments({ type: 'direct', 'participants.user': A.id }), 1)
})
await t('cannot message yourself / invalid id', async () => { eq((await post(A, '/chat/conversations/direct', { userId: A.id })).status, 400); eq((await post(A, '/chat/conversations/direct', { userId: 'x' })).status, 400) })
await t('empty chat stays hidden from the other person', async () => { eq((await call('GET', '/chat/conversations', null, B.token)).data.conversations.length, 0) })
await t('message privacy: only people they follow', async () => {
  eq((await call('PUT', '/users/chat-privacy', { messagePrivacy: 'following' }, B.token)).status, 200)
  eq((await post(A, '/chat/conversations/direct', { userId: B.id })).status, 403)
  await post(B, `/users/${A.id}/follow`)
  eq((await post(A, '/chat/conversations/direct', { userId: B.id })).status, 200)
  await call('PUT', '/users/chat-privacy', { messagePrivacy: 'everyone' }, B.token)
})

await t('real-time: online recipient gets message, status delivered', async () => {
  sA = await open(A); sB = await open(B)
  const got = waitFor(sB, 'message:new', (m) => m.text === 'hello B')
  const r = await send(A, conv.id, 'hello B'); eq(r.status, 201, r.body.message); m1 = r.data.message
  const m = await got; eq(m.sender.id, A.id); eq(m.conversationId, conv.id)
  eq(m1.deliveredTo.includes(B.id), true, 'delivered because B is online')
})
await t('typing indicator reaches the other member', async () => {
  const p = waitFor(sB, 'typing', (e) => e.userId === A.id && e.isTyping === true)
  sA.emit('typing', { conversationId: conv.id, isTyping: true }); await p
})
await t('typing from a non-member is ignored', async () => {
  const sC = await open(C); const none = expectNone(sB, 'typing'); sC.emit('typing', { conversationId: conv.id, isTyping: true }); await none
})
await t('read receipt: sender is notified, unread resets', async () => {
  eq((await call('GET', '/chat/conversations', null, B.token)).data.conversations[0].unread, 1)
  const p = waitFor(sA, 'conversation:read', (e) => e.userId === B.id)
  eq((await post(B, `/chat/conversations/${conv.id}/read`)).status, 200); await p
  const hist = await call('GET', `/chat/conversations/${conv.id}/messages`, null, A.token)
  eq(hist.data.messages[0].readBy.includes(B.id), true)
  eq((await call('GET', '/chat/conversations', null, B.token)).data.conversations[0].unread, 0)
})
await t('offline recipient: status "sent", then delivered on reconnect', async () => {
  sB.close(); await sleep(400)
  const r = await send(A, conv.id, 'while you were away'); eq(r.data.message.deliveredTo.length, 0)
  const p = waitFor(sA, 'message:delivered', (e) => e.messageIds.includes(r.data.message.id))
  sB = await open(B); await p
})
await t('presence: online/offline broadcast with last seen', async () => {
  const off = waitFor(sA, 'presence', (e) => e.userId === B.id && e.online === false); sB.close(); const e = await off; if (!e.lastSeenAt) throw new Error('no lastSeenAt')
  const on = waitFor(sA, 'presence', (e2) => e2.userId === B.id && e2.online === true); sB = await open(B); await on
})
await t('hidden online status is not broadcast', async () => {
  await call('PUT', '/users/chat-privacy', { showOnlineStatus: false }, B.token)
  const none = expectNone(sA, 'presence', 1000); sB.close(); await none
  await call('PUT', '/users/chat-privacy', { showOnlineStatus: true }, B.token); sB = await open(B)
})
await t('history + cursor pagination', async () => {
  for (let i = 0; i < 4; i++) await send(A, conv.id, `m${i}`)
  const p1 = await call('GET', `/chat/conversations/${conv.id}/messages?limit=3`, null, B.token); eq(p1.data.messages.length, 3); if (!p1.data.nextCursor) throw new Error('no cursor')
  const p2 = await call('GET', `/chat/conversations/${conv.id}/messages?limit=3&cursor=${p1.data.nextCursor}`, null, B.token)
  if (p2.data.messages.some((x) => p1.data.messages.some((y) => y.id === x.id))) throw new Error('overlap')
})
await t('list shows last message; chat search works', async () => {
  const l = await call('GET', '/chat/conversations', null, B.token); eq(l.data.conversations[0].lastMessage.text, 'm3'); eq(l.data.totalUnread > 0, true)
  eq((await call('GET', `/chat/conversations?q=${A.username}`, null, B.token)).data.conversations.length, 1)
  eq((await call('GET', '/chat/conversations?q=zzzzzz', null, B.token)).data.conversations.length, 0)
})
await t('message validation', async () => {
  eq((await send(A, conv.id, '   ')).status, 400); eq((await send(A, conv.id, 'x'.repeat(2001))).status, 400)
  eq((await send(C, conv.id, 'intruder')).status, 404, 'non-member send'); eq((await call('GET', `/chat/conversations/${conv.id}/messages`, null, C.token)).status, 404, 'non-member read')
})
await t('attachments: image + PDF accepted, fakes rejected', async () => {
  const img = await sendFile(A.token, conv.id, PNG, 'image/png'); eq(img.status, 201, img.body.message); eq(img.data.message.type, 'image'); eq((await fetch(img.data.message.attachment.url)).status, 200)
  const pdf = await sendFile(A.token, conv.id, PDF, 'application/pdf', { text: 'invoice' }); eq(pdf.status, 201); eq(pdf.data.message.type, 'file')
  eq((await sendFile(A.token, conv.id, Buffer.from('<script>alert(1)</script> not a real file'), 'image/png')).status, 400)
  eq((await sendFile(A.token, conv.id, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/svg+xml')).status, 400)
})
await t('delete for me / for everyone', async () => {
  const mine = await send(A, conv.id, 'secret'); const id = mine.data.message.id
  eq((await call('DELETE', `/chat/conversations/${conv.id}/messages/${id}?scope=everyone`, null, B.token)).status, 403, 'not sender')
  eq((await call('DELETE', `/chat/conversations/${conv.id}/messages/${id}?scope=me`, null, B.token)).status, 200)
  eq((await call('GET', `/chat/conversations/${conv.id}/messages?limit=50`, null, B.token)).data.messages.some((x) => x.id === id), false, 'hidden for B')
  eq((await call('GET', `/chat/conversations/${conv.id}/messages?limit=50`, null, A.token)).data.messages.some((x) => x.id === id), true, 'still visible for A')
  const p = waitFor(sB, 'message:deleted', (e) => e.messageId === id)
  eq((await call('DELETE', `/chat/conversations/${conv.id}/messages/${id}?scope=everyone`, null, A.token)).status, 200); await p
  const again = (await call('GET', `/chat/conversations/${conv.id}/messages?limit=50`, null, A.token)).data.messages.find((x) => x.id === id); eq(again.deleted, true); eq(again.text, '')
})
await t('blocked users cannot message; chat hidden while blocked', async () => {
  await call('POST', `/users/${B.id}/block`, null, A.token)
  eq((await send(A, conv.id, 'x')).status, 403); eq((await send(B, conv.id, 'x')).status, 403)
  eq((await post(B, '/chat/conversations/direct', { userId: A.id })).status, 404)
  eq((await call('GET', '/chat/conversations', null, B.token)).data.conversations.length, 0)
  await call('DELETE', `/users/${B.id}/block`, null, A.token)
  eq((await send(A, conv.id, 'back')).status, 201)
})
await t('disappearing messages: expiry, hiding, cleanup', async () => {
  eq((await call('PUT', `/chat/conversations/${conv.id}/settings`, { disappearAfter: 12345 }, A.token)).status, 400)
  eq((await call('PUT', `/chat/conversations/${conv.id}/settings`, { disappearAfter: 86400 }, A.token)).status, 200)
  const r = await send(A, conv.id, 'poof'); const hrs = (new Date(r.data.message.expiresAt) - Date.now()) / 3600000; if (hrs < 23.9 || hrs > 24.1) throw new Error('expiry ' + hrs)
  await Message.updateOne({ _id: r.data.message.id }, { expiresAt: new Date(Date.now() - 1000) })
  eq((await call('GET', `/chat/conversations/${conv.id}/messages?limit=50`, null, B.token)).data.messages.some((x) => x.id === r.data.message.id), false)
  if ((await cleanupExpiredMessages()) < 1) throw new Error('nothing cleaned'); eq(await Message.countDocuments({ _id: r.data.message.id }), 0)
  await call('PUT', `/chat/conversations/${conv.id}/settings`, { disappearAfter: 0 }, A.token)
})

let group, sD
await t('group: create, message reaches members, history', async () => {
  const sC = sockets.find((x) => x.connected && x !== sA && x !== sB)
  const r = await post(A, '/chat/conversations/group', { name: 'Crew', memberIds: [B.id, C.id] }); eq(r.status, 201, r.body.message); group = r.data.conversation; eq(group.participants.length, 3); eq(group.isAdmin, true)
  const gotB = waitFor(sB, 'message:new', (m) => m.conversationId === group.id), gotC = waitFor(sC, 'message:new', (m) => m.conversationId === group.id)
  eq((await send(B, group.id, 'hi crew')).status, 201); await Promise.all([gotC, waitFor(sA, 'message:new', (m) => m.conversationId === group.id)]); void gotB
  eq((await post(A, '/chat/conversations/group', { name: '', memberIds: [B.id] })).status, 400)
})
await t('group: only admins add/remove/rename', async () => {
  eq((await call('POST', `/chat/conversations/${group.id}/members`, { userIds: [D.id] }, B.token)).status, 403)
  eq((await call('PUT', `/chat/conversations/${group.id}`, { name: 'Hack' }, B.token)).status, 403)
  eq((await call('PUT', `/chat/conversations/${group.id}`, { name: 'Crew 2' }, A.token)).data.conversation.name, 'Crew 2')
})
await t('group: new member sees no old history; removed member loses access', async () => {
  eq((await call('POST', `/chat/conversations/${group.id}/members`, { userIds: [D.id] }, A.token)).data.conversation.participants.length, 4)
  eq((await call('GET', `/chat/conversations/${group.id}/messages`, null, D.token)).data.messages.length, 0, 'no history')
  sD = await open(D); const gone = waitFor(sD, 'conversation:removed', (e) => e.id === group.id)
  eq((await call('DELETE', `/chat/conversations/${group.id}/members/${D.id}`, null, A.token)).status, 200); await gone
  eq((await call('GET', `/chat/conversations/${group.id}/messages`, null, D.token)).status, 404)
})
await t('group: members can leave; admin passes on', async () => {
  eq((await call('DELETE', `/chat/conversations/${group.id}/members/${C.id}`, null, C.token)).status, 200)
  eq((await call('DELETE', `/chat/conversations/${group.id}/members/${A.id}`, null, A.token)).status, 200)
  const g = (await call('GET', `/chat/conversations/${group.id}`, null, B.token)).data.conversation; eq(g.participants.length, 1); eq(g.isAdmin, true)
})
await t('group photo must be an image', async () => {
  const fd = new FormData(); fd.append('media', new Blob([PDF], { type: 'application/pdf' }), 'x.pdf')
  const r = await fetch(`${BASE}/chat/conversations/${group.id}/photo`, { method: 'PUT', headers: { Authorization: `Bearer ${B.token}` }, body: fd }); eq(r.status, 400)
})
await t('reconnection: history intact, missed message delivered', async () => {
  sB.close(); await sleep(300)
  const r = await send(A, conv.id, 'missed this'); eq(r.status, 201)
  const p = waitFor(sA, 'message:delivered', (e) => e.messageIds.includes(r.data.message.id))
  sB = await open(B); await p
  eq((await call('GET', `/chat/conversations/${conv.id}/messages?limit=5`, null, B.token)).data.messages[0].text, 'missed this')
})

sockets.forEach((s) => s.close())
const ids = [A.id, B.id, C.id, D.id]
for (const m of await Message.find({ sender: { $in: ids }, 'attachment.key': { $exists: true } }).select('attachment.key')) await deleteMedia(m.attachment.key)
await Promise.all([
  User.deleteMany({ _id: { $in: ids } }), Message.deleteMany({ sender: { $in: ids } }), Conversation.deleteMany({ 'participants.user': { $in: ids } }),
  Follow.deleteMany({ $or: [{ follower: { $in: ids } }, { following: { $in: ids } }] }),
  Block.deleteMany({ $or: [{ blocker: { $in: ids } }, { blocked: { $in: ids } }] }), OTP.deleteMany({ user: { $in: ids } }),
])
await mongoose.disconnect()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
