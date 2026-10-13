// Phase 11 checks: admin access control, moderation, reports, audit log and security hardening.
// Server must be running (OTP_PROVIDER=dev): npm run test:admin
import mongoose from 'mongoose'
import { env } from '../src/config/env.js'
import User from '../src/models/User.js'
import Post from '../src/models/Post.js'
import Comment from '../src/models/Comment.js'
import Like from '../src/models/Like.js'
import Follow from '../src/models/Follow.js'
import Report from '../src/models/Report.js'
import ModerationLog from '../src/models/ModerationLog.js'
import Notification from '../src/models/Notification.js'
import OTP from '../src/models/OTPVerification.js'
import { deleteMedia } from '../src/services/media/index.js'

const BASE = process.env.API_URL || `http://localhost:${env.port}/api`
let pass = 0, fail = 0
const t = async (name, fn) => { try { await fn(); console.log('PASS', name); pass++ } catch (e) { console.log('FAIL', name, '-', e.message); fail++ } }
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${b}, got ${a}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const call = async (method, path, body, token, headers = {}) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...headers }, body: body && JSON.stringify(body) })
  let j = {}; try { j = await r.json() } catch {}
  return { status: r.status, body: j, data: j.data, headers: r.headers }
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
async function mkPost(token, caption) {
  const fd = new FormData(); fd.append('caption', caption); fd.append('media', new Blob([PNG], { type: 'image/png' }), 'a.png')
  const r = await fetch(BASE + '/posts', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
  return (await r.json()).data.post
}
const s = Date.now().toString(36)
const rnd = () => String(Math.floor(Math.random() * 1e9)).padStart(9, '0')
async function makeUser(tag) {
  const u = { fullName: `Admin ${tag}`, username: `${tag}${s}`.slice(0, 20), email: `${tag}${s}@test.dev`, phone: '9' + rnd(), password: 'Passw0rd1' }
  const reg = await call('POST', '/auth/register', u)
  if (reg.status !== 201) throw new Error('register failed: ' + reg.body.message)
  await call('POST', '/auth/verify-otp', { identifier: u.email, otp: reg.data.devOtp })
  const login = await call('POST', '/auth/login', { identifier: u.email, password: u.password })
  return { ...u, token: login.data.token, id: login.data.user.id }
}

await mongoose.connect(env.mongoUri)
const ADMIN = await makeUser('ad'), A = await makeUser('a'), B = await makeUser('b'), C = await makeUser('c')
await User.updateOne({ _id: ADMIN.id }, { role: 'admin' }) // the only way to make an admin: outside the API
let post, comment, report, D

// ---- access control
await t('admin routes: no token -> 401', async () => { for (const p of ['/admin/stats', '/admin/users', '/admin/reports', '/admin/audit']) eq((await call('GET', p)).status, 401, p) })
await t('admin routes: normal user -> 403 (every route)', async () => {
  for (const p of ['/admin/stats', '/admin/users', `/admin/users/${A.id}`, '/admin/reports', '/admin/posts', '/admin/reels', '/admin/comments', '/admin/audit']) eq((await call('GET', p, null, A.token)).status, 403, p)
  eq((await call('PUT', `/admin/users/${B.id}/status`, { active: false, reason: 'testing' }, A.token)).status, 403)
  eq((await call('POST', `/admin/users/${B.id}/remove`, { reason: 'testing' }, A.token)).status, 403)
})
await t('role cannot be escalated through the API', async () => {
  await call('PUT', '/users/profile', { role: 'admin', bio: 'hi' }, A.token)
  const reg = await call('POST', '/auth/register', { fullName: 'Sneaky', username: `sn${s}`.slice(0, 20), email: `sn${s}@test.dev`, password: 'Passw0rd1', role: 'admin' })
  eq((await User.findById(A.id)).role, 'user'); eq((await User.findOne({ email: `sn${s}@test.dev` }))?.role, 'user'); eq(reg.status, 201)
  await User.deleteOne({ email: `sn${s}@test.dev` })
})
await t('admin role is read from the database (revoked admin loses access at once)', async () => {
  await User.updateOne({ _id: B.id }, { role: 'admin' }); eq((await call('GET', '/admin/stats', null, B.token)).status, 200)
  await User.updateOne({ _id: B.id }, { role: 'user' }); eq((await call('GET', '/admin/stats', null, B.token)).status, 403)
})

// ---- dashboard + users
await t('stats: numbers only, no personal data', async () => {
  const r = await call('GET', '/admin/stats', null, ADMIN.token); eq(r.status, 200)
  if (typeof r.data.users.total !== 'number' || r.data.series.newUsers.length !== 14) throw new Error('bad shape')
  if (/password|@test\.dev/i.test(JSON.stringify(r.data))) throw new Error('personal data in stats')
})
await t('users: search, filters, detail, no password in output', async () => {
  const r = await call('GET', `/admin/users?q=${A.username}`, null, ADMIN.token); eq(r.data.users.length, 1); eq(r.data.users[0].email, A.email)
  if (JSON.stringify(r.data).includes('"password"')) throw new Error('password field present')
  eq((await call('GET', '/admin/users?status=nope', null, ADMIN.token)).status, 400)
  eq((await call('GET', '/admin/users?q[$ne]=x', null, ADMIN.token)).status, 400, 'operator injection')
  const d = await call('GET', `/admin/users/${A.id}`, null, ADMIN.token); eq(d.status, 200); eq(d.data.user.username, A.username)
  eq((await call('GET', '/admin/users/not-an-id', null, ADMIN.token)).status, 400)
})
await t('users: cursor pagination', async () => {
  const p1 = await call('GET', '/admin/users?limit=2', null, ADMIN.token); eq(p1.data.users.length, 2); if (!p1.data.nextCursor) throw new Error('no cursor')
  const p2 = await call('GET', `/admin/users?limit=2&cursor=${p1.data.nextCursor}`, null, ADMIN.token)
  if (p2.data.users.some((u) => p1.data.users.some((x) => x.id === u.id))) throw new Error('overlap')
})
await t('deactivate: reason required; signs the user out; reactivate restores', async () => {
  eq((await call('PUT', `/admin/users/${C.id}/status`, { active: false }, ADMIN.token)).status, 400, 'no reason')
  eq((await call('PUT', `/admin/users/${C.id}/status`, { active: false, reason: 'spamming' }, ADMIN.token)).status, 200)
  eq((await call('GET', '/auth/me', null, C.token)).status, 403, 'old token')
  eq((await call('POST', '/auth/login', { identifier: C.email, password: C.password })).status, 403, 'login')
  eq((await call('PUT', `/admin/users/${C.id}/status`, { active: true, reason: 'appeal accepted' }, ADMIN.token)).status, 200)
  eq((await call('GET', '/auth/me', null, C.token)).status, 200)
})
await t('admins cannot be changed through the dashboard (self or other admins)', async () => {
  eq((await call('PUT', `/admin/users/${ADMIN.id}/status`, { active: false, reason: 'oops' }, ADMIN.token)).status, 400)
  await User.updateOne({ _id: B.id }, { role: 'admin' })
  eq((await call('PUT', `/admin/users/${B.id}/status`, { active: false, reason: 'takeover' }, ADMIN.token)).status, 403)
  eq((await call('POST', `/admin/users/${B.id}/remove`, { reason: 'takeover' }, ADMIN.token)).status, 403)
  await User.updateOne({ _id: B.id }, { role: 'user' })
})

// ---- reports + moderation
await t('report workflow: queue, detail, resolve with content removal', async () => {
  post = await mkPost(A.token, 'bad post #spam')
  await call('POST', `/posts/${post.id}/report`, { reason: 'spam', details: 'looks fake' }, B.token)
  await call('POST', `/posts/${post.id}/report`, { reason: 'harassment' }, C.token)
  const list = await call('GET', '/admin/reports?status=open&type=post', null, ADMIN.token); eq(list.status, 200)
  report = list.data.reports.find((r) => r.target === post.id)
  if (!report) throw new Error('report not in queue'); eq(report.preview.exists, true); eq(report.preview.authorUsername, A.username)
  eq((await call('GET', '/admin/reports?reason=bogus', null, ADMIN.token)).status, 400)
  eq((await call('PUT', `/admin/reports/${report.id}`, { status: 'resolved', action: 'remove_content' }, ADMIN.token)).status, 400, 'action needs a reason')
  eq((await call('PUT', `/admin/reports/${report.id}`, { status: 'maybe' }, ADMIN.token)).status, 400, 'bad status')
  const upd = await call('PUT', `/admin/reports/${report.id}`, { status: 'resolved', adminResponse: 'Removed, thanks.', action: 'remove_content', reason: 'spam post' }, ADMIN.token)
  eq(upd.status, 200); eq(upd.data.report.status, 'resolved'); eq(upd.data.report.reviewedBy, ADMIN.username)
  eq(await Post.countDocuments({ _id: post.id }), 0, 'post gone')
  eq(await Report.countDocuments({ target: post.id, status: 'open' }), 0, 'sibling report closed too')
})
await t('report: reject without touching content; filter by status', async () => {
  const p = await mkPost(A.token, 'fine post'); await call('POST', `/posts/${p.id}/report`, { reason: 'other' }, B.token)
  const open = (await call('GET', '/admin/reports?status=open', null, ADMIN.token)).data.reports.find((r) => r.target === p.id)
  eq((await call('PUT', `/admin/reports/${open.id}`, { status: 'rejected', adminResponse: 'No violation.' }, ADMIN.token)).status, 200)
  eq(await Post.countDocuments({ _id: p.id }), 1, 'post kept')
  eq((await call('GET', '/admin/reports?status=rejected', null, ADMIN.token)).data.reports.some((r) => r.id === open.id), true)
  eq((await call('GET', '/admin/reports?status=open', null, ADMIN.token)).data.reports.some((r) => r.id === open.id), false)
})
await t('report: deactivate the author from a user report', async () => {
  await call('POST', `/users/${C.id}/report`, { reason: 'harassment' }, B.token)
  const rep = (await call('GET', '/admin/reports?type=user', null, ADMIN.token)).data.reports.find((r) => r.target === C.id)
  eq((await call('PUT', `/admin/reports/${rep.id}`, { status: 'resolved', action: 'deactivate_user', reason: 'harassment confirmed' }, ADMIN.token)).status, 200)
  eq((await User.findById(C.id)).isActive, false)
  await User.updateOne({ _id: C.id }, { isActive: true })
})
await t('moderation: remove a comment (counts stay right) and a post', async () => {
  const p = await mkPost(A.token, 'comment target')
  const cm = await call('POST', `/posts/${p.id}/comment`, { text: 'rude comment' }, B.token); comment = cm.data.comment
  await call('POST', `/posts/${p.id}/comment`, { text: 'reply', parentId: comment.id }, A.token)
  eq((await call('GET', '/admin/comments?kind=post', null, ADMIN.token)).data.items.some((c) => c.id === comment.id), true)
  eq((await call('POST', `/admin/comments/${comment.id}/remove`, { kind: 'post' }, ADMIN.token)).status, 400, 'reason required')
  const rm = await call('POST', `/admin/comments/${comment.id}/remove`, { kind: 'post', reason: 'abusive' }, ADMIN.token); eq(rm.status, 200); eq(rm.data.removed, 2, 'comment + reply')
  eq((await call('GET', `/posts/${p.id}`, null, A.token)).data.post.commentsCount, 0)
  eq((await call('GET', `/admin/posts?q=comment%20target`, null, ADMIN.token)).data.items.length, 1)
  eq((await call('POST', `/admin/posts/${p.id}/remove`, { reason: 'test' }, ADMIN.token)).status, 200)
  eq((await call('POST', `/admin/posts/${p.id}/remove`, { reason: 'test' }, ADMIN.token)).status, 404, 'already gone')
})
await t('remove account: content purged, anonymized, cannot log in, admin protected', async () => {
  D = await makeUser('d')
  await call('POST', `/users/${A.id}/follow`, null, D.token)
  const dp = await mkPost(D.token, 'doomed post'); await call('POST', `/posts/${dp.id}/like`, null, A.token)
  const ap = await mkPost(A.token, 'survivor'); await call('POST', `/posts/${ap.id}/like`, null, D.token)
  await call('POST', `/posts/${ap.id}/comment`, { text: 'from D' }, D.token)
  eq((await call('POST', `/admin/users/${D.id}/remove`, { reason: 'x' }, ADMIN.token)).status, 400, 'reason too short')
  const r = await call('POST', `/admin/users/${D.id}/remove`, { reason: 'terms violation' }, ADMIN.token); eq(r.status, 200); eq(r.data.removed.posts, 1)
  const u = await User.findById(D.id)
  if (u.email === D.email || u.username === D.username || u.fullName !== 'Removed user') throw new Error('not anonymized')
  eq(await Post.countDocuments({ author: D.id }), 0); eq(await Like.countDocuments({ user: D.id }), 0); eq(await Follow.countDocuments({ follower: D.id }), 0); eq(await Comment.countDocuments({ author: D.id }), 0)
  const fresh = (await call('GET', `/posts/${ap.id}`, null, A.token)).data.post; eq(fresh.likesCount, 0, 'like counter fixed'); eq(fresh.commentsCount, 0, 'comment counter fixed')
  eq((await call('POST', '/auth/login', { identifier: D.email, password: D.password })).status, 401)
  eq((await call('GET', '/auth/me', null, D.token)).status, 403)
  eq((await call('POST', `/admin/users/${D.id}/remove`, { reason: 'again please' }, ADMIN.token)).status, 400, 'already removed')
})
await t('audit log records who, what and why', async () => {
  const r = await call('GET', '/admin/audit?limit=50', null, ADMIN.token); eq(r.status, 200)
  const actions = new Set(r.data.entries.map((e) => e.action))
  for (const a of ['user_deactivate', 'user_activate', 'report_update', 'comment_remove', 'post_remove', 'user_remove']) if (!actions.has(a)) throw new Error('missing ' + a)
  const e = r.data.entries.find((x) => x.action === 'user_remove'); eq(e.admin, ADMIN.username); eq(e.reason, 'terms violation')
})

// ---- security hardening
await t('password reset signs out older tokens', async () => {
  const old = (await call('POST', '/auth/login', { identifier: A.email, password: A.password })).data.token
  eq((await call('GET', '/auth/me', null, old)).status, 200)
  const f = await call('POST', '/auth/forgot-password', { identifier: A.email }); await sleep(1200)
  eq((await call('POST', '/auth/reset-password', { identifier: A.email, otp: f.data.devOtp, newPassword: 'NewPassw0rd9' })).status, 200)
  eq((await call('GET', '/auth/me', null, old)).status, 401, 'old token')
  eq((await call('GET', '/auth/me', null, A.token)).status, 401, 'first token')
  const fresh = (await call('POST', '/auth/login', { identifier: A.email, password: 'NewPassw0rd9' })).data.token
  eq((await call('GET', '/auth/me', null, fresh)).status, 200, 'new token works')
})
await t('NoSQL operator injection is neutralised', async () => {
  eq((await call('GET', '/users/search?q[$ne]=zzz', null, B.token)).status, 400)
  const r = await call('POST', '/auth/login', { identifier: { $ne: '' }, password: { $ne: '' } }); if (r.status === 200) throw new Error('injection worked')
  eq((await call('PUT', '/users/profile', { bio: { $gt: '' } }, B.token)).status, 400)
})
await t('security headers + no caching of API answers + no tech disclosure', async () => {
  const r = await call('GET', '/auth/me', null, B.token)
  eq(r.headers.get('cache-control'), 'no-store'); eq(r.headers.get('x-content-type-options'), 'nosniff'); eq(r.headers.get('x-powered-by'), null)
  if (!r.headers.get('x-frame-options') && !r.headers.get('content-security-policy')) throw new Error('missing framing protection')
})
await t('CORS: unknown origins get no permission', async () => {
  const bad = await call('GET', '/health', null, null, { Origin: 'https://evil.example' }); eq(bad.headers.get('access-control-allow-origin'), null)
  const good = await call('GET', '/health', null, null, { Origin: env.clientUrl.split(',')[0] }); eq(good.headers.get('access-control-allow-origin'), env.clientUrl.split(',')[0])
})
await t('errors never leak stack traces or internals', async () => {
  const r = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json' }); const text = await r.text()
  eq(r.status, 400); if (/at\s.+\(.+:\d+:\d+\)|node_modules|MongoServerError/i.test(text)) throw new Error('internals leaked')
  const nf = await call('GET', '/nope/nothing'); eq(nf.status, 404)
})
await t('oversized JSON bodies are rejected', async () => {
  const r = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'x'.repeat(20000), password: 'y' }) })
  eq(r.status, 400)
})

const allIds = [ADMIN.id, A.id, B.id, C.id, D?.id].filter(Boolean)
for (const p of await Post.find({ author: { $in: allIds } })) await deleteMedia(p.mediaKey)
await Promise.all([
  User.deleteMany({ _id: { $in: allIds } }), Post.deleteMany({ author: { $in: allIds } }), Comment.deleteMany({ author: { $in: allIds } }),
  Like.deleteMany({ user: { $in: allIds } }), Follow.deleteMany({ $or: [{ follower: { $in: allIds } }, { following: { $in: allIds } }] }),
  Report.deleteMany({ $or: [{ reporter: { $in: allIds } }, { reviewedBy: { $in: allIds } }] }), ModerationLog.deleteMany({ admin: { $in: allIds } }),
  Notification.deleteMany({ $or: [{ recipient: { $in: allIds } }, { actor: { $in: allIds } }] }), OTP.deleteMany({ user: { $in: allIds } }),
])
await mongoose.disconnect()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
