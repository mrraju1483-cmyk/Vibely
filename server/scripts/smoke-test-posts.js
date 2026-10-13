// Phase 4 checks. Server must be running (OTP_PROVIDER=dev, MEDIA_PROVIDER=local): npm run test:posts
import mongoose from 'mongoose'
import { env } from '../src/config/env.js'
import User from '../src/models/User.js'
import Post from '../src/models/Post.js'
import Comment from '../src/models/Comment.js'
import Like from '../src/models/Like.js'
import SavedPost from '../src/models/SavedPost.js'
import Report from '../src/models/Report.js'
import Follow from '../src/models/Follow.js'
import Block from '../src/models/Block.js'
import OTP from '../src/models/OTPVerification.js'
import { deleteMedia } from '../src/services/media/index.js'

const BASE = process.env.API_URL || `http://localhost:${env.port}/api`
let pass = 0, fail = 0
const t = async (name, fn) => { try { await fn(); console.log('PASS', name); pass++ } catch (e) { console.log('FAIL', name, '-', e.message); fail++ } }
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${b}, got ${a}`) }
const call = async (method, path, body, token) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) })
  let j = {}; try { j = await r.json() } catch {}
  return { status: r.status, body: j, data: j.data }
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
async function mkPost(token, fields = {}, file = PNG, mime = 'image/png', name = 'a.png') {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  if (file) fd.append('media', new Blob([file], { type: mime }), name)
  const r = await fetch(BASE + '/posts', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
  let j = {}; try { j = await r.json() } catch {}
  return { status: r.status, body: j, data: j.data }
}
const s = Date.now().toString(36)
const rnd = () => String(Math.floor(Math.random() * 1e9)).padStart(9, '0')
async function makeUser(tag) {
  const u = { fullName: `Poster ${tag}`, username: `${tag}${s}`.slice(0, 20), email: `${tag}${s}@test.dev`, phone: '9' + rnd(), password: 'Passw0rd1' }
  const reg = await call('POST', '/auth/register', u)
  if (reg.status !== 201) throw new Error('register failed: ' + reg.body.message)
  await call('POST', '/auth/verify-otp', { identifier: u.email, otp: reg.data.devOtp })
  const login = await call('POST', '/auth/login', { identifier: u.email, password: u.password })
  return { ...u, token: login.data.token, id: login.data.user.id }
}

await mongoose.connect(env.mongoUri)
const A = await makeUser('a'), B = await makeUser('b')
let post, privatePost

await t('create post with image', async () => { const r = await mkPost(A.token, { caption: 'Good vibes #Vibes #travel', location: 'Goa', visibility: 'public' }); eq(r.status, 201, r.body.message); post = r.data.post; eq(post.mediaType, 'image') })
await t('hashtags extracted + lowercased', async () => { if (post.hashtags.join() !== 'vibes,travel') throw new Error(post.hashtags.join()) })
await t('uploaded file is served', async () => { const r = await fetch(post.mediaUrl); eq(r.status, 200); eq(r.headers.get('x-content-type-options'), 'nosniff') })
await t('post without media rejected', async () => eq((await mkPost(A.token, { caption: 'x' }, null)).status, 400))
await t('fake image (text bytes) rejected', async () => eq((await mkPost(A.token, {}, Buffer.from('<script>alert(1)</script> not an image'), 'image/png', 'x.png')).status, 400))
await t('SVG rejected', async () => eq((await mkPost(A.token, {}, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/svg+xml', 'x.svg')).status, 400))
await t('caption too long rejected', async () => eq((await mkPost(A.token, { caption: 'x'.repeat(2201) })).status, 400))
await t('invalid visibility rejected', async () => eq((await mkPost(A.token, { visibility: 'everyone' })).status, 400))
await t('no token -> 401', async () => eq((await call('GET', '/posts/feed')).status, 401))
await t('invalid id -> 400', async () => eq((await call('GET', '/posts/nope', null, A.token)).status, 400))

await t('own feed has the post', async () => { const r = await call('GET', '/posts/feed', null, A.token); eq(r.status, 200); eq(r.data.posts[0].id, post.id) })
await t('feed excludes non-followed authors', async () => { const r = await call('GET', '/posts/feed', null, B.token); eq(r.data.posts.length, 0) })
await t('feed shows followed authors', async () => { await call('POST', `/users/${A.id}/follow`, null, B.token); const r = await call('GET', '/posts/feed', null, B.token); eq(r.data.posts[0].id, post.id) })
await t('private-visibility post hidden from others', async () => {
  const r = await mkPost(A.token, { caption: 'secret', visibility: 'private' }); privatePost = r.data.post
  eq((await call('GET', `/posts/${privatePost.id}`, null, B.token)).status, 404)
  eq((await call('GET', `/posts/${privatePost.id}`, null, A.token)).status, 200)
  const feed = await call('GET', '/posts/feed', null, B.token); if (feed.data.posts.some((p) => p.id === privatePost.id)) throw new Error('leaked in feed')
})
await t('feed pagination (cursor)', async () => {
  for (let i = 0; i < 3; i++) await mkPost(A.token, { caption: `p${i}` })
  const p1 = await call('GET', '/posts/feed?limit=2', null, B.token); eq(p1.data.posts.length, 2); if (!p1.data.nextCursor) throw new Error('no cursor')
  const p2 = await call('GET', `/posts/feed?limit=2&cursor=${p1.data.nextCursor}`, null, B.token); if (p2.data.posts.some((x) => p1.data.posts.some((y) => y.id === x.id))) throw new Error('overlap')
  eq((await call('GET', '/posts/feed?cursor=bad', null, B.token)).status, 400)
})
await t('user posts list', async () => { const r = await call('GET', `/posts/user/${A.id}`, null, B.token); eq(r.status, 200); if (r.data.posts.some((p) => p.visibility === 'private')) throw new Error('private leaked') })

await t('like is idempotent, unlike works', async () => {
  eq((await call('POST', `/posts/${post.id}/like`, null, B.token)).data.likesCount, 1)
  eq((await call('POST', `/posts/${post.id}/like`, null, B.token)).data.likesCount, 1, 'duplicate')
  eq((await call('DELETE', `/posts/${post.id}/like`, null, B.token)).data.likesCount, 0)
})
let c1, r1
await t('comment + reply', async () => {
  const c = await call('POST', `/posts/${post.id}/comment`, { text: 'Nice!' }, B.token); eq(c.status, 201); c1 = c.data.comment
  const r = await call('POST', `/posts/${post.id}/comment`, { text: 'Thanks', parentId: c1.id }, A.token); eq(r.status, 201); r1 = r.data.comment
  const rr = await call('POST', `/posts/${post.id}/comment`, { text: 'reply to reply', parentId: r1.id }, B.token); eq(rr.data.comment.parentId, c1.id, 'flattened')
  const p = await call('GET', `/posts/${post.id}`, null, B.token); eq(p.data.post.commentsCount, 3)
})
await t('list comments + replies', async () => {
  const l = await call('GET', `/posts/${post.id}/comments`, null, B.token); eq(l.data.comments.length, 1); eq(l.data.comments[0].repliesCount, 2)
  eq((await call('GET', `/comments/${c1.id}/replies`, null, B.token)).data.comments.length, 2)
})
await t('empty / too-long comment rejected', async () => {
  eq((await call('POST', `/posts/${post.id}/comment`, { text: '   ' }, B.token)).status, 400)
  eq((await call('POST', `/posts/${post.id}/comment`, { text: 'x'.repeat(501) }, B.token)).status, 400)
})
await t('like comment (no duplicates)', async () => {
  await call('POST', `/comments/${c1.id}/like`, null, A.token)
  eq((await call('POST', `/comments/${c1.id}/like`, null, A.token)).data.likesCount, 1)
})
await t('cannot delete someone else\'s comment', async () => eq((await call('DELETE', `/comments/${c1.id}`, null, A.token)).status, 403))
await t('delete own comment removes replies + fixes count', async () => {
  const d = await call('DELETE', `/comments/${c1.id}`, null, B.token); eq(d.status, 200); eq(d.data.removed, 3)
  eq((await call('GET', `/posts/${post.id}`, null, B.token)).data.post.commentsCount, 0)
})
await t('save / saved list / unsave', async () => {
  eq((await call('POST', `/posts/${post.id}/save`, null, B.token)).status, 200)
  eq((await call('POST', `/posts/${post.id}/save`, null, B.token)).status, 200, 'duplicate')
  const l = await call('GET', '/posts/saved', null, B.token); eq(l.data.posts.length, 1); eq(l.data.posts[0].savedByMe, true)
  await call('DELETE', `/posts/${post.id}/save`, null, B.token)
  eq((await call('GET', '/posts/saved', null, B.token)).data.posts.length, 0)
})
await t('share increments count', async () => { const r = await call('POST', `/posts/${post.id}/share`, null, B.token); eq(r.data.sharesCount, 1); if (!r.data.url.includes(post.id)) throw new Error('bad url') })
await t('report post (dup 409, own 400, bad reason 400)', async () => {
  eq((await call('POST', `/posts/${post.id}/report`, { reason: 'spam', details: 'looks fake' }, B.token)).status, 201)
  eq((await call('POST', `/posts/${post.id}/report`, { reason: 'spam' }, B.token)).status, 409)
  eq((await call('POST', `/posts/${post.id}/report`, { reason: 'spam' }, A.token)).status, 400)
  eq((await call('POST', `/posts/${post.id}/report`, { reason: 'nope' }, B.token)).status, 400)
})
await t('report user', async () => { eq((await call('POST', `/users/${A.id}/report`, { reason: 'harassment' }, B.token)).status, 201); eq((await call('POST', `/users/${A.id}/report`, { reason: 'harassment' }, B.token)).status, 409) })
await t('profile postsCount is real', async () => { const r = await call('GET', `/users/${A.id}`, null, A.token); if (r.data.profile.postsCount < 5) throw new Error('count ' + r.data.profile.postsCount) })

await t('block hides posts both ways', async () => {
  await call('POST', `/users/${A.id}/block`, null, A.token)
  eq((await call('GET', `/posts/${post.id}`, null, B.token)).status, 404)
  eq((await call('POST', `/posts/${post.id}/like`, null, B.token)).status, 404)
  await call('DELETE', `/users/${B.id}/block`, null, A.token)
})
await t('only the owner can delete a post', async () => eq((await call('DELETE', `/posts/${post.id}`, null, B.token)).status, 403))
await t('owner deletes post + media + related data', async () => {
  await call('POST', `/posts/${post.id}/comment`, { text: 'bye' }, A.token)
  eq((await call('DELETE', `/posts/${post.id}`, null, A.token)).status, 200)
  eq((await call('GET', `/posts/${post.id}`, null, A.token)).status, 404)
  eq(await Comment.countDocuments({ post: post.id }), 0)
  eq((await fetch(post.mediaUrl)).status, 404, 'media file')
})

const ids = [A.id, B.id]
const posts = await Post.find({ author: { $in: ids } })
for (const p of posts) await deleteMedia(p.mediaKey)
await Promise.all([
  User.deleteMany({ _id: { $in: ids } }), Post.deleteMany({ author: { $in: ids } }), Comment.deleteMany({ author: { $in: ids } }),
  Like.deleteMany({ user: { $in: ids } }), SavedPost.deleteMany({ user: { $in: ids } }), Report.deleteMany({ reporter: { $in: ids } }),
  Follow.deleteMany({ $or: [{ follower: { $in: ids } }, { following: { $in: ids } }] }),
  Block.deleteMany({ $or: [{ blocker: { $in: ids } }, { blocked: { $in: ids } }] }), OTP.deleteMany({ user: { $in: ids } }),
])
await mongoose.disconnect()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
