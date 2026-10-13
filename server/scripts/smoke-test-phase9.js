// Phase 9 checks (notifications + calls). Server must be running (OTP_PROVIDER=dev, MEDIA_PROVIDER=local): npm run test:phase9
import mongoose from 'mongoose'
import { io } from 'socket.io-client'
import { env } from '../src/config/env.js'
import User from '../src/models/User.js'
import Post from '../src/models/Post.js'
import Reel from '../src/models/Reel.js'
import Comment from '../src/models/Comment.js'
import Like from '../src/models/Like.js'
import Follow from '../src/models/Follow.js'
import Block from '../src/models/Block.js'
import Call from '../src/models/Call.js'
import Notification from '../src/models/Notification.js'
import Conversation from '../src/models/Conversation.js'
import Message from '../src/models/Message.js'
import OTP from '../src/models/OTPVerification.js'
import { deleteMedia } from '../src/services/media/index.js'

const BASE = process.env.API_URL || `http://localhost:${env.port}/api`
const ORIGIN = BASE.replace(/\/api\/?$/, '')
let pass = 0, fail = 0
const t = async (name, fn) => { try { await fn(); console.log('PASS', name); pass++ } catch (e) { console.log('FAIL', name, '-', e.message); fail++ } }
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${b}, got ${a}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const call = async (method, path, body, token) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) })
  let j = {}; try { j = await r.json() } catch {}
  return { status: r.status, body: j, data: j.data }
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
async function mkPost(token, caption) {
  const fd = new FormData(); fd.append('caption', caption); fd.append('media', new Blob([PNG], { type: 'image/png' }), 'a.png')
  const r = await fetch(BASE + '/posts', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
  return (await r.json()).data.post
}
const box = (type, payload) => { const b = Buffer.alloc(8 + payload.length); b.writeUInt32BE(8 + payload.length, 0); b.write(type, 4, 'ascii'); payload.copy(b, 8); return b }
async function mkReel(token) {
  const mvhd = Buffer.alloc(100); mvhd.writeUInt32BE(1000, 12); mvhd.writeUInt32BE(5000, 16)
  const file = Buffer.concat([box('ftyp', Buffer.concat([Buffer.from('isom'), Buffer.alloc(4), Buffer.from('isom')])), box('moov', box('mvhd', mvhd)), Buffer.alloc(2048)])
  const fd = new FormData(); fd.append('caption', 'reel'); fd.append('media', new Blob([file], { type: 'video/mp4' }), 'r.mp4')
  const r = await fetch(BASE + '/reels', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
  return (await r.json()).data.reel
}
const s = Date.now().toString(36)
const rnd = () => String(Math.floor(Math.random() * 1e9)).padStart(9, '0')
async function makeUser(tag) {
  const u = { fullName: `Phase ${tag}`, username: `${tag}${s}`.slice(0, 20), email: `${tag}${s}@test.dev`, phone: '9' + rnd(), password: 'Passw0rd1' }
  const reg = await call('POST', '/auth/register', u)
  if (reg.status !== 201) throw new Error('register failed: ' + reg.body.message)
  await call('POST', '/auth/verify-otp', { identifier: u.email, otp: reg.data.devOtp })
  const login = await call('POST', '/auth/login', { identifier: u.email, password: u.password })
  return { ...u, token: login.data.token, id: login.data.user.id }
}
const sockets = []
const connect = (token) => new Promise((res, rej) => {
  const sk = io(ORIGIN, { auth: { token }, transports: ['websocket'], reconnection: false })
  sockets.push(sk)
  sk.once('connect', () => res(sk)); sk.once('connect_error', (e) => rej(new Error('socket: ' + e.message)))
})
const once = (sk, ev, ms = 4000) => new Promise((res, rej) => { const id = setTimeout(() => rej(new Error('timeout waiting for ' + ev)), ms); sk.once(ev, (d) => { clearTimeout(id); res(d) }) })
const ack = (sk, ev, data) => new Promise((res, rej) => sk.timeout(4000).emit(ev, data, (err, r) => (err ? rej(new Error('no ack for ' + ev)) : res(r))))
// notifications are created in the background after the API answers, so poll briefly
const notes = async (u) => (await call('GET', '/notifications', null, u.token)).data
const waitNote = async (u, pred, ms = 3000) => { const end = Date.now() + ms; for (;;) { const d = await notes(u); const n = d.notifications.find(pred); if (n) return { n, d }; if (Date.now() > end) throw new Error('notification did not arrive'); await sleep(100) } }
const noNote = async (u, pred) => { await sleep(500); if ((await notes(u)).notifications.some(pred)) throw new Error('unexpected notification') }

await mongoose.connect(env.mongoUri)
const A = await makeUser('a'), B = await makeUser('b'), C = await makeUser('c')
let postB, reelB

// ---------------- notifications ----------------
await t('no token -> 401', async () => eq((await call('GET', '/notifications')).status, 401))
await t('follow notifies once (no spam on unfollow/refollow)', async () => {
  await call('POST', `/users/${B.id}/follow`, null, A.token)
  await waitNote(B, (n) => n.type === 'follow' && n.actor.id === A.id)
  await call('DELETE', `/users/${B.id}/follow`, null, A.token); await call('POST', `/users/${B.id}/follow`, null, A.token)
  await sleep(400); eq((await notes(B)).notifications.filter((n) => n.type === 'follow').length, 1)
})
await t('private account: follow_request, then follow_accept', async () => {
  await call('PUT', '/users/privacy', { isPrivate: true }, C.token)
  await call('POST', `/users/${C.id}/follow`, null, A.token)
  await waitNote(C, (n) => n.type === 'follow_request' && n.actor.id === A.id)
  await call('POST', `/users/follow-requests/${A.id}/accept`, null, C.token)
  await waitNote(A, (n) => n.type === 'follow_accept' && n.actor.id === C.id)
  await call('PUT', '/users/privacy', { isPrivate: false }, C.token)
})
await t('post like notifies the author (once, never yourself)', async () => {
  postB = await mkPost(B.token, 'hello world')
  await call('POST', `/posts/${postB.id}/like`, null, A.token)
  const { n } = await waitNote(B, (x) => x.type === 'like' && x.postId === postB.id); eq(n.read, false)
  await call('DELETE', `/posts/${postB.id}/like`, null, A.token); await call('POST', `/posts/${postB.id}/like`, null, A.token)
  await sleep(400); eq((await notes(B)).notifications.filter((x) => x.type === 'like' && x.postId === postB.id).length, 1)
  await call('POST', `/posts/${postB.id}/like`, null, B.token); await sleep(400)
  eq((await notes(B)).notifications.filter((x) => x.actor.id === B.id).length, 0)
})
let commentId
await t('comment, reply and @mention notifications', async () => {
  const c = await call('POST', `/posts/${postB.id}/comment`, { text: 'Nice one!' }, A.token); commentId = c.data.comment.id
  await waitNote(B, (x) => x.type === 'comment' && x.text === 'Nice one!')
  await call('POST', `/posts/${postB.id}/comment`, { text: 'thanks', parentId: commentId }, B.token)
  await waitNote(A, (x) => x.type === 'reply' && x.text === 'thanks')
  await call('POST', `/posts/${postB.id}/comment`, { text: `hey @${C.username} look` }, A.token)
  await waitNote(C, (x) => x.type === 'mention' && x.actor.id === A.id)
})
await t('comment like notifies the comment author', async () => {
  await call('POST', `/comments/${commentId}/like`, null, B.token)
  await waitNote(A, (x) => x.type === 'like' && x.text === 'liked your comment')
})
await t('reel like + comment notifications', async () => {
  reelB = await mkReel(B.token)
  await call('POST', `/reels/${reelB.id}/like`, null, A.token)
  await waitNote(B, (x) => x.type === 'like' && x.reelId === reelB.id)
  await call('POST', `/reels/${reelB.id}/comment`, { text: 'cool reel' }, A.token)
  await waitNote(B, (x) => x.type === 'comment' && x.reelId === reelB.id)
})
await t('messages: offline recipient gets one collapsed notification', async () => {
  const conv = (await call('POST', '/chat/conversations/direct', { userId: B.id }, A.token)).data.conversation
  await call('POST', `/chat/conversations/${conv.id}/messages`, { text: 'one' }, A.token)
  await call('POST', `/chat/conversations/${conv.id}/messages`, { text: 'two' }, A.token)
  await sleep(600)
  const list = (await notes(B)).notifications.filter((x) => x.type === 'message')
  eq(list.length, 1); eq(list[0].count, 2); eq(list[0].conversationId, conv.id)
})
await t('list, unread count, mark one read, mark all read', async () => {
  const d = await notes(B); if (d.unreadCount < 4) throw new Error('unread ' + d.unreadCount)
  const first = d.notifications[0]
  const r = await call('PUT', `/notifications/${first.id}/read`, null, B.token); eq(r.status, 200); eq(r.data.unreadCount, d.unreadCount - 1)
  eq((await call('GET', '/notifications/unread-count', null, B.token)).data.unreadCount, d.unreadCount - 1)
  eq((await call('PUT', '/notifications/read-all', null, B.token)).data.unreadCount, 0)
  eq((await notes(B)).notifications.every((x) => x.read), true)
})
await t('cannot read someone else\'s notification; bad id -> 400', async () => {
  const mine = (await notes(A)).notifications[0]
  eq((await call('PUT', `/notifications/${mine.id}/read`, null, B.token)).status, 404)
  eq((await call('PUT', '/notifications/nope/read', null, B.token)).status, 400)
})
await t('pagination (cursor)', async () => {
  const p1 = await call('GET', '/notifications?limit=2', null, B.token); eq(p1.data.notifications.length, 2); if (!p1.data.nextCursor) throw new Error('no cursor')
  const p2 = await call('GET', `/notifications?limit=2&cursor=${p1.data.nextCursor}`, null, B.token)
  if (p2.data.notifications.some((x) => p1.data.notifications.some((y) => y.id === x.id))) throw new Error('overlap')
})
let sockB
await t('real-time: notification:new with live unread badge', async () => {
  sockB = await connect(B.token)
  const p = once(sockB, 'notification:new')
  await call('POST', `/posts/${postB.id}/comment`, { text: 'live one' }, C.token)
  const ev = await p; eq(ev.notification.type, 'comment'); eq(ev.notification.text, 'live one'); if (!(ev.unreadCount >= 1)) throw new Error('badge ' + ev.unreadCount)
  const sync = once(sockB, 'notification:sync'); await call('PUT', '/notifications/read-all', null, B.token); eq((await sync).unreadCount, 0)
})
await t('online recipient gets no message notification (chat badge covers it)', async () => {
  const conv = (await call('POST', '/chat/conversations/direct', { userId: B.id }, C.token)).data.conversation
  await call('POST', `/chat/conversations/${conv.id}/messages`, { text: 'hi live' }, C.token)
  await noNote(B, (x) => x.type === 'message' && x.actor.id === C.id)
})
await t('blocked users: no notifications, old ones hidden', async () => {
  await call('POST', `/users/${B.id}/block`, null, A.token)
  await call('POST', `/posts/${postB.id}/comment`, { text: 'after block' }, C.token) // unrelated user still notifies
  await call('POST', `/posts/${postB.id}/like`, null, A.token) // blocked: 404, nothing created
  await noNote(B, (x) => x.actor.id === A.id)
  await call('DELETE', `/users/${B.id}/block`, null, A.token)
})

// ---------------- calls ----------------
let sockA, sockC
sockA = await connect(A.token); sockC = await connect(C.token)
let callId
await t('ICE config: STUN present, no secrets', async () => {
  const r = await call('GET', '/calls/config', null, A.token); eq(r.status, 200); if (!r.data.iceServers.length) throw new Error('no ice servers')
  if (JSON.stringify(r.data).includes(env.turnSecret || '\u0000none')) throw new Error('secret leaked')
  eq((await call('GET', '/calls/config')).status, 401)
})
await t('start call: callee rings, caller gets an id', async () => {
  const inc = once(sockB, 'call:incoming')
  const a = await ack(sockA, 'call:start', { receiverId: B.id, type: 'video' }); eq(a.ok, true, a.error); callId = a.callId
  const ev = await inc; eq(ev.call.id, callId); eq(ev.call.type, 'video'); eq(ev.call.caller.id, A.id)
})
await t('busy: nobody can call into or out of an active call', async () => {
  const x = await ack(sockC, 'call:start', { receiverId: B.id, type: 'voice' }); eq(x.ok, false); if (!/another call/.test(x.error)) throw new Error(x.error)
  const y = await ack(sockA, 'call:start', { receiverId: C.id, type: 'voice' }); eq(y.ok, false); if (!/already in a call/.test(y.error)) throw new Error(y.error)
})
await t('signals are refused until the call is accepted', async () => { const r = await ack(sockA, 'call:signal', { callId, data: { type: 'offer', sdp: 'x' } }); eq(r.ok, false) })
await t('only the callee can accept; accept notifies both', async () => {
  eq((await ack(sockA, 'call:accept', { callId })).ok, false, 'caller cannot accept')
  eq((await ack(sockC, 'call:accept', { callId })).ok, false, 'stranger cannot accept')
  const pa = once(sockA, 'call:accepted'), pb = once(sockB, 'call:accepted')
  eq((await ack(sockB, 'call:accept', { callId })).ok, true)
  eq((await pa).callId, callId); eq((await pb).callId, callId)
})
await t('signaling relay: offer, answer, candidate; strangers/oversized/invalid refused', async () => {
  const gotOffer = once(sockB, 'call:signal'); await ack(sockA, 'call:signal', { callId, data: { type: 'offer', sdp: 'v=0 fake' } }); eq((await gotOffer).data.type, 'offer')
  const gotAnswer = once(sockA, 'call:signal'); await ack(sockB, 'call:signal', { callId, data: { type: 'answer', sdp: 'v=0 fake' } }); eq((await gotAnswer).data.type, 'answer')
  const gotCand = once(sockB, 'call:signal'); await ack(sockA, 'call:signal', { callId, data: { type: 'candidate', candidate: { candidate: 'x' } } }); eq((await gotCand).data.type, 'candidate')
  eq((await ack(sockC, 'call:signal', { callId, data: { type: 'offer', sdp: 'x' } })).ok, false, 'stranger')
  eq((await ack(sockA, 'call:signal', { callId, data: { type: 'offer', sdp: 'x'.repeat(20000) } })).ok, false, 'oversized')
  eq((await ack(sockA, 'call:signal', { callId, data: { type: 'bogus' } })).ok, false, 'invalid')
})
await t('end call: both get call:ended (completed) with duration; history for both', async () => {
  await sleep(1100)
  const ea = once(sockA, 'call:ended'), eb = once(sockB, 'call:ended')
  eq((await ack(sockB, 'call:end', { callId })).ok, true)
  const x = await ea; eq(x.status, 'completed'); if (!(x.duration >= 1)) throw new Error('duration ' + x.duration); eq((await eb).callId, callId)
  const ha = (await call('GET', '/calls', null, A.token)).data.calls[0], hb = (await call('GET', '/calls', null, B.token)).data.calls[0]
  eq(ha.id, callId); eq(ha.direction, 'outgoing'); eq(ha.status, 'completed'); eq(hb.direction, 'incoming'); eq(hb.other.id, A.id)
})
await t('reject: status rejected, no missed-call notification', async () => {
  const inc = once(sockB, 'call:incoming'); const a = await ack(sockA, 'call:start', { receiverId: B.id, type: 'voice' }); await inc
  const ended = once(sockA, 'call:ended'); await ack(sockB, 'call:reject', { callId: a.callId })
  eq((await ended).status, 'rejected')
  await noNote(B, (x) => x.type === 'missed_call' && x.callId === a.callId)
})
await t('cancel before answer: callee gets a missed-call notification', async () => {
  const inc = once(sockB, 'call:incoming'); const a = await ack(sockA, 'call:start', { receiverId: B.id, type: 'voice' }); await inc
  const ended = once(sockB, 'call:ended'); await ack(sockA, 'call:cancel', { callId: a.callId })
  eq((await ended).status, 'canceled')
  await waitNote(B, (x) => x.type === 'missed_call' && x.callId === a.callId && x.actor.id === A.id)
})
await t('offline callee: refused, but logged as a missed call', async () => {
  const d = await makeUser('d')
  const r = await ack(sockA, 'call:start', { receiverId: d.id, type: 'voice' }); eq(r.ok, false); if (!/not available/.test(r.error)) throw new Error(r.error)
  await waitNote(d, (x) => x.type === 'missed_call'); eq((await Call.countDocuments({ receiver: d.id, status: 'missed' })), 1)
  await Promise.all([User.deleteOne({ _id: d.id }), Call.deleteMany({ receiver: d.id }), Notification.deleteMany({ recipient: d.id }), OTP.deleteMany({ user: d.id })])
})
await t('validation: self, bad id, bad type', async () => {
  eq((await ack(sockA, 'call:start', { receiverId: A.id, type: 'voice' })).ok, false)
  eq((await ack(sockA, 'call:start', { receiverId: 'nope', type: 'voice' })).ok, false)
  eq((await ack(sockA, 'call:start', { receiverId: B.id, type: 'hologram' })).ok, false)
  eq((await ack(sockA, 'call:accept', { callId: 'nope' })).ok, false)
})
await t('blocked users cannot call each other', async () => {
  await call('POST', `/users/${B.id}/block`, null, A.token)
  const r = await ack(sockA, 'call:start', { receiverId: B.id, type: 'voice' }); eq(r.ok, false)
  const r2 = await ack(sockB ? await connect(B.token) : sockB, 'call:start', { receiverId: A.id, type: 'voice' }); eq(r2.ok, false)
  await call('DELETE', `/users/${B.id}/block`, null, A.token)
})
await t('hang-up when a participant disconnects', async () => {
  const sb2 = await connect(C.token) // second tab for C: call survives until the LAST tab closes
  const inc = once(sockB, 'call:incoming'); const a = await ack(sockA, 'call:start', { receiverId: B.id, type: 'voice' }); await inc
  const acc = once(sockA, 'call:accepted'); await ack(sockB, 'call:accept', { callId: a.callId }); await acc
  const ended = once(sockB, 'call:ended'); sockA.close()
  const e = await ended; eq(e.status, 'completed'); eq(e.reason, 'disconnected')
  sb2.close()
})
await t('ringing callee who disconnects = missed call', async () => {
  const sA = await connect(A.token), sB = await connect(B.token)
  sockB.close()
  await sleep(300)
  const inc = once(sB, 'call:incoming'); const a = await ack(sA, 'call:start', { receiverId: B.id, type: 'voice' }); await inc
  const ended = once(sA, 'call:ended'); sB.close()
  eq((await ended).status, 'missed')
  sA.close()
})

// ---------------- cleanup ----------------
sockets.forEach((x) => x.close())
const ids = [A.id, B.id, C.id]
for (const p of await Post.find({ author: { $in: ids } })) await deleteMedia(p.mediaKey)
for (const r of await Reel.find({ author: { $in: ids } })) await deleteMedia(r.mediaKey)
const convs = await Conversation.find({ 'participants.user': { $in: ids } }).select('_id')
await Promise.all([
  User.deleteMany({ _id: { $in: ids } }), Post.deleteMany({ author: { $in: ids } }), Reel.deleteMany({ author: { $in: ids } }), Comment.deleteMany({ author: { $in: ids } }),
  Like.deleteMany({ user: { $in: ids } }), Call.deleteMany({ $or: [{ caller: { $in: ids } }, { receiver: { $in: ids } }] }),
  Notification.deleteMany({ $or: [{ recipient: { $in: ids } }, { actor: { $in: ids } }] }),
  Message.deleteMany({ conversation: { $in: convs.map((c) => c._id) } }), Conversation.deleteMany({ _id: { $in: convs.map((c) => c._id) } }),
  Follow.deleteMany({ $or: [{ follower: { $in: ids } }, { following: { $in: ids } }] }),
  Block.deleteMany({ $or: [{ blocker: { $in: ids } }, { blocked: { $in: ids } }] }), OTP.deleteMany({ user: { $in: ids } }),
])
await mongoose.disconnect()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
