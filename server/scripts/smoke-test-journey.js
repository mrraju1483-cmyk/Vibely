// Final end-to-end journey (Phase 12). Server must be running with OTP_PROVIDER=dev and MEDIA_PROVIDER=local:  npm run test:journey
// Landing -> Register -> Login -> Profile -> Follow -> Post -> Feed -> Like/Comment/Save -> Explore -> Story -> Reel
// -> Chat -> Notifications -> Call -> Vibely AI -> Settings -> Logout -> Admin.  Cleans up everything it creates.
import mongoose from 'mongoose'
import { io } from 'socket.io-client'
import { env } from '../src/config/env.js'
import User from '../src/models/User.js'
import Post from '../src/models/Post.js'
import Comment from '../src/models/Comment.js'
import Like from '../src/models/Like.js'
import SavedPost from '../src/models/SavedPost.js'
import Story from '../src/models/Story.js'
import Reel from '../src/models/Reel.js'
import ReelView from '../src/models/ReelView.js'
import Follow from '../src/models/Follow.js'
import Hashtag from '../src/models/Hashtag.js'
import Conversation from '../src/models/Conversation.js'
import Message from '../src/models/Message.js'
import Notification from '../src/models/Notification.js'
import Call from '../src/models/Call.js'
import OTP from '../src/models/OTPVerification.js'
import AIRequest from '../src/models/AIRequest.js'
import { deleteMedia } from '../src/services/media/index.js'

const ORIGIN = process.env.API_ORIGIN || `http://localhost:${env.port}`
const BASE = `${ORIGIN}/api`
let pass = 0, fail = 0
const t = async (name, fn) => { try { await fn(); console.log('PASS', name); pass++ } catch (e) { console.log('FAIL', name, '-', e.message); fail++ } }
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${b}, got ${a}`) }
const ok = (v, m) => { if (!v) throw new Error(m) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const call = async (method, path, body, token) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) })
  let j = {}; try { j = await r.json() } catch {}
  return { status: r.status, body: j, data: j.data }
}
const upload = async (path, token, fields, buf, mime, name) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  fd.append('media', new Blob([buf], { type: mime }), name)
  const r = await fetch(BASE + path, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
  let j = {}; try { j = await r.json() } catch {}
  return { status: r.status, body: j, data: j.data }
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const box = (type, payload) => { const b = Buffer.alloc(8 + payload.length); b.writeUInt32BE(8 + payload.length, 0); b.write(type, 4, 'ascii'); payload.copy(b, 8); return b }
const MP4 = (() => { const m = Buffer.alloc(100); m.writeUInt32BE(1000, 12); m.writeUInt32BE(5000, 16); return Buffer.concat([box('ftyp', Buffer.concat([Buffer.from('isom'), Buffer.alloc(4), Buffer.from('isom')])), box('moov', box('mvhd', m)), Buffer.alloc(2048)]) })()

const s = Date.now().toString(36)
const rnd = () => String(Math.floor(Math.random() * 1e9)).padStart(9, '0')
const sockets = []
const connect = (token) => new Promise((res, rej) => {
  const sk = io(ORIGIN, { auth: { token }, transports: ['websocket'], reconnection: false })
  sockets.push(sk)
  sk.once('connect', () => res(sk)); sk.once('connect_error', (e) => rej(new Error('socket: ' + e.message)))
})
const once = (sk, ev, pred = () => true, ms = 5000) => new Promise((res, rej) => {
  const id = setTimeout(() => rej(new Error('timeout waiting for ' + ev)), ms)
  const h = (d) => { if (pred(d)) { clearTimeout(id); sk.off(ev, h); res(d) } }
  sk.on(ev, h)
})
const ack = (sk, ev, data) => new Promise((res, rej) => sk.timeout(5000).emit(ev, data, (err, r) => (err ? rej(new Error('no ack for ' + ev)) : res(r))))
const waitNote = async (u, pred, ms = 4000) => {
  const end = Date.now() + ms
  for (;;) {
    const d = (await call('GET', '/notifications', null, u.token)).data
    const n = d.notifications.find(pred)
    if (n) return n
    if (Date.now() > end) throw new Error('notification did not arrive')
    await sleep(150)
  }
}

const tag = `jt${s}`
const mk = (t2, name) => ({ fullName: `Journey ${name}`, username: `${t2}${s}`.slice(0, 20), email: `${t2}${s}@test.dev`, phone: '9' + rnd(), password: 'Passw0rd1' })
const A = mk('ja', 'Alice'), B = mk('jb', 'Bob'), ADM = mk('jc', 'Admin')
let post, story, reel, conv, sockA, sockB

await mongoose.connect(env.mongoUri)

await t('1 landing: API is up (health check)', async () => { const r = await call('GET', '/health'); eq(r.status, 200); eq(r.body.status, 'ok') })
await t('2 register + verify OTP + login (3 accounts)', async () => {
  for (const u of [A, B, ADM]) {
    const reg = await call('POST', '/auth/register', u); eq(reg.status, 201, reg.body.message)
    ok(reg.data.devOtp, 'no devOtp (is OTP_PROVIDER=dev?)')
    eq((await call('POST', '/auth/verify-otp', { identifier: u.email, otp: reg.data.devOtp })).status, 200)
    const login = await call('POST', '/auth/login', { identifier: u.email, password: u.password }); eq(login.status, 200)
    u.token = login.data.token; u.id = login.data.user.id
  }
})
await t('3 profile: load + edit', async () => {
  eq((await call('GET', `/users/${A.id}`, null, A.token)).data.profile.isMe, true)
  eq((await call('PUT', '/users/profile', { bio: 'Journey test bio' }, A.token)).data.user.bio, 'Journey test bio')
  eq((await call('GET', '/auth/me', null, A.token)).data.user.email, A.email)
})
await t('4 follow: Bob follows Alice', async () => { const r = await call('POST', `/users/${A.id}/follow`, null, B.token); eq(r.status, 200); eq(r.data.followStatus, 'following') })
await t('5 create post (image + hashtag)', async () => {
  const r = await upload('/posts', A.token, { caption: `Journey day #${tag}`, visibility: 'public' }, PNG, 'image/png', 'p.png'); eq(r.status, 201, r.body.message); post = r.data.post
  ok(post.hashtags.includes(tag), 'hashtag not extracted')
})
await t('6 home feed shows the post for a follower', async () => { const r = await call('GET', '/posts/feed', null, B.token); eq(r.status, 200); ok(r.data.posts.some((p) => p.id === post.id), 'post missing from feed') })
await t('7 like, comment, reply, save', async () => {
  eq((await call('POST', `/posts/${post.id}/like`, null, B.token)).data.likesCount, 1)
  const c = await call('POST', `/posts/${post.id}/comment`, { text: 'Great post!' }, B.token); eq(c.status, 201)
  eq((await call('POST', `/posts/${post.id}/comment`, { text: 'Thanks!', parentId: c.data.comment.id }, A.token)).status, 201)
  eq((await call('POST', `/posts/${post.id}/save`, null, B.token)).status, 200)
  const p = await call('GET', `/posts/${post.id}`, null, B.token); eq(p.data.post.commentsCount, 2); eq(p.data.post.savedByMe, true)
})
await t('8 explore: recent posts, hashtag, user search, trending', async () => {
  ok((await call('GET', '/explore/recent-posts?limit=30', null, B.token)).data.posts.some((p) => p.id === post.id), 'not in recent')
  ok(JSON.stringify((await call('GET', `/explore/hashtags/search?q=${tag}`, null, B.token)).data).includes(tag), 'hashtag not found')
  ok((await call('GET', `/explore/hashtags/${tag}/posts`, null, B.token)).data.posts.some((p) => p.id === post.id), 'hashtag page empty')
  ok(JSON.stringify((await call('GET', `/explore/search?type=users&q=${A.username}`, null, B.token)).data).includes(A.username), 'user not found')
  eq((await call('GET', '/explore/trending-posts', null, B.token)).status, 200)
})
await t('9 story: post, appears in tray, viewed, owner sees viewer', async () => {
  const r = await upload('/stories', A.token, { caption: 'hi' }, PNG, 'image/png', 's.png'); eq(r.status, 201, r.body.message); story = r.data.story
  const g = (await call('GET', '/stories', null, B.token)).data.groups.find((x) => x.user.id === A.id); ok(g && g.hasUnseen, 'story not in tray')
  eq((await call('POST', `/stories/${story.id}/view`, null, B.token)).status, 200)
  eq((await call('GET', `/stories/${story.id}/viewers`, null, A.token)).data.viewers[0].user.id, B.id)
})
await t('10 reel: post and watch', async () => {
  const r = await upload('/reels', A.token, { caption: 'My reel' }, MP4, 'video/mp4', 'r.mp4'); eq(r.status, 201, r.body.message); reel = r.data.reel
  ok((await call('GET', '/reels/feed', null, B.token)).data.reels.some((x) => x.id === reel.id), 'reel not in feed')
  eq((await call('POST', `/reels/${reel.id}/like`, null, B.token)).data.likesCount, 1)
})
await t('11 chat: direct conversation, live message, unread, read receipt', async () => {
  sockA = await connect(A.token); sockB = await connect(B.token)
  const c = await call('POST', '/chat/conversations/direct', { userId: A.id }, B.token); eq(c.status, 201, c.body.message); conv = c.data.conversation
  const live = once(sockA, 'message:new', (m) => m.text === 'Hello Alice')
  eq((await call('POST', `/chat/conversations/${conv.id}/messages`, { text: 'Hello Alice' }, B.token)).status, 201)
  await live
  eq((await call('GET', '/chat/conversations', null, A.token)).data.conversations[0].unread, 1)
  eq((await call('POST', `/chat/conversations/${conv.id}/read`, null, A.token)).status, 200)
  eq((await call('GET', '/chat/conversations', null, A.token)).data.conversations[0].unread, 0)
})
await t('12 notifications: follow, like, comment, message, then mark read', async () => {
  await waitNote({ token: A.token }, (n) => n.type === 'follow' && n.actor.id === B.id)
  await waitNote({ token: A.token }, (n) => n.type === 'like' && n.actor.id === B.id)
  await waitNote({ token: A.token }, (n) => n.type === 'comment' && n.actor.id === B.id)
  await waitNote({ token: A.token }, (n) => n.type === 'message' && n.actor.id === B.id)
  ok((await call('GET', '/notifications/unread-count', null, A.token)).data.unreadCount >= 4, 'badge count too low')
  eq((await call('PUT', '/notifications/read-all', null, A.token)).data.unreadCount, 0)
})
await t('13 call: ring, accept, end, history for both', async () => {
  const inc = once(sockA, 'call:incoming')
  const a = await ack(sockB, 'call:start', { receiverId: A.id, type: 'voice' }); eq(a.ok, true, a.error)
  await inc
  const acc = once(sockB, 'call:accepted')
  eq((await ack(sockA, 'call:accept', { callId: a.callId })).ok, true)
  await acc
  await sleep(1100)
  const ended = once(sockB, 'call:ended')
  eq((await ack(sockA, 'call:end', { callId: a.callId })).ok, true)
  eq((await ended).status ?? 'completed', 'completed')
  for (const u of [A, B]) { const h = (await call('GET', '/calls', null, u.token)).data.calls; ok(h.length >= 1 && h[0].duration >= 1, 'history missing or no duration') }
})
await t('14 Vibely AI: status answers; chat gives a real answer or a friendly "not set up" (never a 500)', async () => {
  const st = await call('GET', '/ai/status', null, A.token); eq(st.status, 200); eq(typeof st.data.available, 'boolean')
  const r = await call('POST', '/ai/chat', { messages: [{ role: 'user', content: 'Write a short caption about coffee' }] }, A.token)
  ok([200, 503].includes(r.status), `status ${r.status}`)
  if (r.status === 503) eq(r.body.code, 'AI_NOT_CONFIGURED')
  else ok(r.data.reply, 'empty reply')
  eq((await call('POST', '/ai/safety', { text: 'You are a lovely person' }, A.token)).status === 200 || st.data.available === false, true)
})
await t('15 settings: privacy + story privacy + blocked list', async () => {
  eq((await call('PUT', '/users/privacy', { isPrivate: true }, A.token)).data.user.isPrivate, true)
  eq((await call('PUT', '/users/privacy', { isPrivate: false }, A.token)).data.user.isPrivate, false)
  eq((await call('PUT', '/users/story-privacy', { visibility: 'followers' }, A.token)).data.user.storyVisibility, 'followers')
  eq((await call('GET', '/users/blocked', null, A.token)).status, 200)
})
await t('16 logout', async () => { eq((await call('POST', '/auth/logout', null, B.token)).status, 200); eq((await call('POST', '/auth/logout')).status, 401) })
await t('17 admin: normal user refused, admin allowed (role set from the command line path)', async () => {
  eq((await call('GET', '/admin/stats', null, A.token)).status, 403)
  await User.updateOne({ _id: ADM.id }, { role: 'admin' }) // same effect as: npm run admin:grant -- email
  const st = await call('GET', '/admin/stats', null, ADM.token); eq(st.status, 200); ok(st.data.users.total >= 3, 'stats look empty')
  eq((await call('GET', `/admin/users?q=${A.username}`, null, ADM.token)).data.users[0].id, A.id)
  eq((await call('GET', '/admin/reports', null, ADM.token)).status, 200)
  eq((await call('GET', '/admin/audit', null, ADM.token)).status, 200)
})

sockets.forEach((sk) => sk.close())
const ids = [A.id, B.id, ADM.id]
for (const m of [...(await Post.find({ author: { $in: ids } })), ...(await Reel.find({ author: { $in: ids } })), ...(await Story.find({ user: { $in: ids } }))]) await deleteMedia(m.mediaKey)
const convIds = (await Conversation.find({ 'participants.user': { $in: ids } }).select('_id')).map((c) => c._id)
await Promise.all([
  User.deleteMany({ _id: { $in: ids } }), Post.deleteMany({ author: { $in: ids } }), Comment.deleteMany({ author: { $in: ids } }),
  Like.deleteMany({ user: { $in: ids } }), SavedPost.deleteMany({ user: { $in: ids } }), Story.deleteMany({ user: { $in: ids } }),
  Reel.deleteMany({ author: { $in: ids } }), ReelView.deleteMany({ user: { $in: ids } }), Follow.deleteMany({ $or: [{ follower: { $in: ids } }, { following: { $in: ids } }] }),
  Hashtag.deleteMany({ name: tag }), Message.deleteMany({ conversation: { $in: convIds } }), Conversation.deleteMany({ _id: { $in: convIds } }),
  Notification.deleteMany({ $or: [{ recipient: { $in: ids } }, { actor: { $in: ids } }] }), Call.deleteMany({ $or: [{ caller: { $in: ids } }, { receiver: { $in: ids } }] }),
  OTP.deleteMany({ user: { $in: ids } }), AIRequest.deleteMany({ user: { $in: ids } }),
])
await mongoose.disconnect()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
