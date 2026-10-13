// Phase 5 checks. Server must be running (OTP_PROVIDER=dev, MEDIA_PROVIDER=local): npm run test:explore
import mongoose from 'mongoose'
import { env } from '../src/config/env.js'
import User from '../src/models/User.js'
import Post from '../src/models/Post.js'
import Comment from '../src/models/Comment.js'
import Like from '../src/models/Like.js'
import Follow from '../src/models/Follow.js'
import Block from '../src/models/Block.js'
import Hashtag from '../src/models/Hashtag.js'
import OTP from '../src/models/OTPVerification.js'
import { deleteMedia } from '../src/services/media/index.js'

const BASE = process.env.API_URL || `http://localhost:${env.port}/api`
let pass = 0, fail = 0
const t = async (name, fn) => { try { await fn(); console.log('PASS', name); pass++ } catch (e) { console.log('FAIL', name, '-', e.message); fail++ } }
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${b}, got ${a}`) }
const ok = (c, m) => { if (!c) throw new Error(m) }
const call = async (method, path, body, token) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) })
  let j = {}; try { j = await r.json() } catch {}
  return { status: r.status, body: j, data: j.data }
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
async function mkPost(token, fields) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  fd.append('media', new Blob([PNG], { type: 'image/png' }), 'a.png')
  const r = await fetch(BASE + '/posts', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
  const j = await r.json().catch(() => ({}))
  if (r.status !== 201) throw new Error('post failed: ' + j.message)
  return j.data.post
}
const s = Date.now().toString(36)
const rnd = () => String(Math.floor(Math.random() * 1e9)).padStart(9, '0')
async function makeUser(tag) {
  const u = { fullName: `Explorer ${tag}`, username: `${tag}${s}`.slice(0, 20), email: `${tag}${s}@test.dev`, phone: '9' + rnd(), password: 'Passw0rd1' }
  const reg = await call('POST', '/auth/register', u)
  if (reg.status !== 201) throw new Error('register failed: ' + reg.body.message)
  await call('POST', '/auth/verify-otp', { identifier: u.email, otp: reg.data.devOtp })
  const login = await call('POST', '/auth/login', { identifier: u.email, password: u.password })
  return { ...u, token: login.data.token, id: login.data.user.id }
}

await mongoose.connect(env.mongoUri)
await Post.init() // make sure the text index exists
const [A, B, C, D, M] = [await makeUser('a'), await makeUser('b'), await makeUser('c'), await makeUser('d'), await makeUser('m')]
const tagA = `exa${s}`, tagB = `exb${s}`, tagC = `exc${s}`, word = `zebra${s}`
let a1, a2, b1, c1

await call('PUT', '/users/privacy', { isPrivate: true }, C.token)
a1 = await mkPost(A.token, { caption: `${word} loving #${tagA}`, visibility: 'public' })
a2 = await mkPost(A.token, { caption: `again #${tagA}` })
b1 = await mkPost(B.token, { caption: `hello #${tagB}` })
c1 = await mkPost(C.token, { caption: `secret ${word} #${tagC}` })

await t('no token -> 401', async () => eq((await call('GET', '/explore/recent-posts')).status, 401))
await t('recent posts: public yes, private-account no', async () => {
  const r = await call('GET', '/explore/recent-posts?limit=30', null, D.token); eq(r.status, 200)
  const ids = r.data.posts.map((p) => p.id)
  ok(ids.includes(a1.id) && ids.includes(b1.id), 'public posts missing')
  ok(!ids.includes(c1.id), 'private account post leaked')
})
await t('recent posts: newest first + cursor', async () => {
  const p1 = await call('GET', '/explore/recent-posts?limit=2', null, D.token); eq(p1.data.posts.length, 2); ok(p1.data.nextCursor, 'no cursor')
  const p2 = await call('GET', `/explore/recent-posts?limit=2&cursor=${p1.data.nextCursor}`, null, D.token)
  ok(!p2.data.posts.some((x) => p1.data.posts.some((y) => y.id === x.id)), 'overlap')
  eq((await call('GET', '/explore/recent-posts?cursor=bad', null, D.token)).status, 400)
})
await t('hashtags are stored with counts (discoverable only)', async () => {
  const r = await call('GET', `/explore/hashtags/search?q=${tagA.slice(0, 6)}`, null, D.token)
  const h = r.data.hashtags.find((x) => x.name === tagA); ok(h, 'tag not found'); eq(h.postsCount, 2)
})
await t('private account hashtag not listed', async () => ok(!(await call('GET', `/explore/hashtags/search?q=${tagC}`, null, D.token)).data.hashtags.length, 'listed'))
await t('hashtag page', async () => {
  const r = await call('GET', `/explore/hashtags/${tagA}/posts`, null, D.token); eq(r.status, 200); eq(r.data.posts.length, 2); eq(r.data.hashtag.postsCount, 2)
  eq(r.data.posts[0].id, a2.id, 'newest first')
  eq((await call('GET', `/explore/hashtags/${tagC}/posts`, null, D.token)).data.posts.length, 0)
  eq((await call('GET', '/explore/hashtags/bad-tag!/posts', null, D.token)).status, 400)
})
await t('trending hashtags computed from recent posts', async () => {
  const r = await call('GET', '/explore/hashtags/trending', null, D.token); eq(r.status, 200)
  ok(r.data.hashtags.some((h) => h.name === tagA), 'tag missing (busy DB? more than 12 hotter tags)')
})
await t('trending posts rank by engagement', async () => {
  await call('POST', `/posts/${a1.id}/like`, null, B.token); await call('POST', `/posts/${a1.id}/like`, null, C.token)
  await call('POST', `/posts/${a1.id}/comment`, { text: 'wow' }, B.token)
  const r = await call('GET', '/explore/trending-posts?limit=30', null, D.token); eq(r.status, 200)
  const ids = r.data.posts.map((p) => p.id)
  ok(ids.includes(a1.id) && ids.includes(a2.id), 'posts missing')
  ok(ids.indexOf(a1.id) < ids.indexOf(a2.id), 'engaged post should rank higher')
  ok(!ids.includes(c1.id), 'private leaked')
})
await t('blocked users hidden from explore', async () => {
  await call('POST', `/users/${A.id}/block`, null, D.token)
  const ids = (await call('GET', '/explore/trending-posts?limit=30', null, D.token)).data.posts.map((p) => p.id)
  ok(!ids.includes(a1.id), 'trending shows blocked author')
  const recent = (await call('GET', '/explore/recent-posts?limit=30', null, D.token)).data.posts.map((p) => p.id)
  ok(!recent.includes(a1.id), 'recent shows blocked author')
  ok(!(await call('GET', `/explore/search?type=posts&q=${word}`, null, D.token)).data.posts.some((p) => p.id === a1.id), 'search shows blocked author')
  eq((await call('GET', `/explore/hashtags/${tagA}/posts`, null, D.token)).data.posts.length, 0)
  await call('DELETE', `/users/${A.id}/block`, null, D.token)
})
await t('search posts (caption) hides private accounts', async () => {
  const r = await call('GET', `/explore/search?type=posts&q=${word}`, null, M.token); eq(r.status, 200)
  const ids = r.data.posts.map((p) => p.id); ok(ids.includes(a1.id), 'not found'); ok(!ids.includes(c1.id), 'private leaked')
})
await t('search posts by #hashtag', async () => eq((await call('GET', `/explore/search?type=posts&q=${encodeURIComponent('#' + tagB)}`, null, M.token)).data.posts[0].id, b1.id))
await t('search users + hashtags via unified endpoint', async () => {
  const u = await call('GET', `/explore/search?type=users&q=${A.username}`, null, M.token); ok(u.data.users.some((x) => x.id === A.id), 'user missing')
  const h = await call('GET', `/explore/search?type=hashtags&q=${tagB}`, null, M.token); ok(h.data.hashtags.some((x) => x.name === tagB), 'tag missing')
})
await t('search validation', async () => {
  eq((await call('GET', '/explore/search?type=nope&q=x', null, M.token)).status, 400)
  eq((await call('GET', '/explore/search?type=posts&q=', null, M.token)).status, 400)
  eq((await call('GET', '/explore/search?type=posts&q=' + encodeURIComponent('"a" -b'), null, M.token)).status, 200)
})
await t('recommended users: mutual followers', async () => {
  await call('POST', `/users/${B.id}/follow`, null, M.token)   // M follows B
  await call('POST', `/users/${A.id}/follow`, null, B.token)   // B follows A -> A is a friend-of-friend
  const r = await call('GET', '/explore/recommended-users', null, M.token); eq(r.status, 200)
  const a = r.data.users.find((u) => u.id === A.id); ok(a, 'A not recommended'); ok(/mutual/.test(a.note), 'reason: ' + a.note)
  ok(!r.data.users.some((u) => u.id === B.id || u.id === M.id), 'recommended someone already followed / self')
})
await t('recommended users skip blocked', async () => {
  await call('POST', `/users/${M.id}/block`, null, A.token)
  ok(!(await call('GET', '/explore/recommended-users', null, M.token)).data.users.some((u) => u.id === A.id), 'blocked user recommended')
  await call('DELETE', `/users/${M.id}/block`, null, A.token)
})
await t('popular users', async () => {
  const r = await call('GET', '/explore/popular-users', null, M.token); eq(r.status, 200); ok(Array.isArray(r.data.users), 'no array')
  ok(!r.data.users.some((u) => u.id === M.id), 'self listed')
})
await t('going public makes posts + hashtags discoverable; private hides again', async () => {
  await call('PUT', '/users/privacy', { isPrivate: false }, C.token)
  ok((await call('GET', '/explore/recent-posts?limit=30', null, D.token)).data.posts.some((p) => p.id === c1.id), 'not discoverable after going public')
  eq((await call('GET', `/explore/hashtags/search?q=${tagC}`, null, D.token)).data.hashtags[0]?.postsCount, 1)
  await call('PUT', '/users/privacy', { isPrivate: true }, C.token)
  ok(!(await call('GET', '/explore/recent-posts?limit=30', null, D.token)).data.posts.some((p) => p.id === c1.id), 'still discoverable after going private')
  eq((await call('GET', `/explore/hashtags/search?q=${tagC}`, null, D.token)).data.hashtags.length, 0)
})
await t('deleting a post updates hashtag count', async () => {
  await call('DELETE', `/posts/${a2.id}`, null, A.token)
  eq((await call('GET', `/explore/hashtags/search?q=${tagA}`, null, D.token)).data.hashtags[0].postsCount, 1)
})

const ids = [A.id, B.id, C.id, D.id, M.id]
for (const p of await Post.find({ author: { $in: ids } })) await deleteMedia(p.mediaKey)
await Promise.all([
  User.deleteMany({ _id: { $in: ids } }), Post.deleteMany({ author: { $in: ids } }), Comment.deleteMany({ author: { $in: ids } }), Like.deleteMany({ user: { $in: ids } }),
  Follow.deleteMany({ $or: [{ follower: { $in: ids } }, { following: { $in: ids } }] }), Block.deleteMany({ $or: [{ blocker: { $in: ids } }, { blocked: { $in: ids } }] }),
  Hashtag.deleteMany({ name: { $in: [tagA, tagB, tagC] } }), OTP.deleteMany({ user: { $in: ids } }),
])
await mongoose.disconnect()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
