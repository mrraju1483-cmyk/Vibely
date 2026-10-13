// Phase 6 checks. Server must be running (OTP_PROVIDER=dev, MEDIA_PROVIDER=local): npm run test:stories
import mongoose from 'mongoose'
import { env } from '../src/config/env.js'
import User from '../src/models/User.js'
import Story from '../src/models/Story.js'
import Follow from '../src/models/Follow.js'
import Block from '../src/models/Block.js'
import OTP from '../src/models/OTPVerification.js'
import { deleteMedia } from '../src/services/media/index.js'
import { cleanupExpiredStories } from '../src/services/storyService.js'

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
async function mkStory(token, fields = {}, file = PNG, mime = 'image/png') {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  if (file) fd.append('media', new Blob([file], { type: mime }), 's.png')
  const r = await fetch(BASE + '/stories', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
  let j = {}; try { j = await r.json() } catch {}
  return { status: r.status, body: j, data: j.data }
}
const s = Date.now().toString(36)
const rnd = () => String(Math.floor(Math.random() * 1e9)).padStart(9, '0')
async function makeUser(tag) {
  const u = { fullName: `Story ${tag}`, username: `${tag}${s}`.slice(0, 20), email: `${tag}${s}@test.dev`, phone: '9' + rnd(), password: 'Passw0rd1' }
  const reg = await call('POST', '/auth/register', u)
  if (reg.status !== 201) throw new Error('register failed: ' + reg.body.message)
  await call('POST', '/auth/verify-otp', { identifier: u.email, otp: reg.data.devOtp })
  const login = await call('POST', '/auth/login', { identifier: u.email, password: u.password })
  return { ...u, token: login.data.token, id: login.data.user.id }
}
const groupOf = (tray, id) => tray.data.groups.find((g) => g.user.id === id)

await mongoose.connect(env.mongoUri)
const A = await makeUser('a'), B = await makeUser('b'), C = await makeUser('c')
let story, followersOnly

await t('no token -> 401', async () => eq((await call('GET', '/stories')).status, 401))
await t('create story (image)', async () => {
  const r = await mkStory(A.token, { caption: 'hello' }); eq(r.status, 201, r.body.message); story = r.data.story
  const hours = (new Date(story.expiresAt) - Date.now()) / 3600000
  if (hours < 23.9 || hours > 24.1) throw new Error('expiry hours ' + hours)
})
await t('story media is served', async () => eq((await fetch(story.mediaUrl)).status, 200))
await t('story without media rejected', async () => eq((await mkStory(A.token, {}, null)).status, 400))
await t('fake image rejected', async () => eq((await mkStory(A.token, {}, Buffer.from('<script>alert(1)</script> text file'))).status, 400))
await t('caption too long rejected', async () => eq((await mkStory(A.token, { caption: 'x'.repeat(201) })).status, 400))
await t('invalid visibility rejected', async () => eq((await mkStory(A.token, { visibility: 'everyone' })).status, 400))
await t('owner sees own story in tray', async () => { const g = groupOf(await call('GET', '/stories', null, A.token), A.id); eq(g.stories.length, 1); eq(g.stories[0].viewersCount, 0) })
await t('non-follower tray has no stories', async () => eq(groupOf(await call('GET', '/stories', null, B.token), A.id), undefined))
await t('follower sees story, unseen, no viewer count', async () => {
  await call('POST', `/users/${A.id}/follow`, null, B.token)
  const g = groupOf(await call('GET', '/stories', null, B.token), A.id)
  eq(g.hasUnseen, true); eq(g.stories[0].viewedByMe, false); eq(g.stories[0].viewersCount, undefined)
})
await t('mark viewed (idempotent, counted once)', async () => {
  eq((await call('POST', `/stories/${story.id}/view`, null, B.token)).status, 200)
  eq((await call('POST', `/stories/${story.id}/view`, null, B.token)).status, 200)
  const g = groupOf(await call('GET', '/stories', null, B.token), A.id); eq(g.hasUnseen, false)
  const v = await call('GET', `/stories/${story.id}/viewers`, null, A.token); eq(v.status, 200); eq(v.data.viewers.length, 1); eq(v.data.viewers[0].user.id, B.id)
})
await t('viewing own story does not count', async () => { await call('POST', `/stories/${story.id}/view`, null, A.token); eq((await call('GET', `/stories/${story.id}/viewers`, null, A.token)).data.viewers.length, 1) })
await t('only owner can list viewers', async () => eq((await call('GET', `/stories/${story.id}/viewers`, null, B.token)).status, 403))

await t('followers-only story hidden from non-followers', async () => {
  const r = await mkStory(A.token, { visibility: 'followers', caption: 'close' }); followersOnly = r.data.story
  const asC = await call('GET', `/stories/user/${A.id}`, null, C.token); eq(asC.status, 200); eq(asC.data.group.stories.length, 1)
  eq((await call('POST', `/stories/${followersOnly.id}/view`, null, C.token)).status, 404)
  eq((await call('GET', `/stories/user/${A.id}`, null, B.token)).data.group.stories.length, 2)
})
await t('story privacy default setting', async () => {
  eq((await call('PUT', '/users/story-privacy', { visibility: 'followers' }, A.token)).status, 200)
  const r = await mkStory(A.token, {}); eq(r.data.story.visibility, 'followers')
  eq((await call('PUT', '/users/story-privacy', { visibility: 'nope' }, A.token)).status, 400)
  await call('PUT', '/users/story-privacy', { visibility: 'public' }, A.token)
})
await t('private account: stories need approval', async () => {
  await call('PUT', '/users/privacy', { isPrivate: true }, A.token)
  eq((await call('GET', `/stories/user/${A.id}`, null, C.token)).status, 403)
  await call('POST', `/users/${A.id}/follow`, null, C.token)
  await call('POST', `/users/follow-requests/${C.id}/accept`, null, A.token)
  eq((await call('GET', `/stories/user/${A.id}`, null, C.token)).status, 200)
  await call('PUT', '/users/privacy', { isPrivate: false }, A.token)
})
await t('blocked users cannot see or view stories', async () => {
  await call('POST', `/users/${A.id}/block`, null, A.token)
  eq(groupOf(await call('GET', '/stories', null, B.token), A.id), undefined)
  eq((await call('POST', `/stories/${story.id}/view`, null, B.token)).status, 404)
  eq((await call('GET', `/stories/user/${A.id}`, null, B.token)).status, 404)
  await call('DELETE', `/users/${B.id}/block`, null, A.token)
})
await t('expired story is unavailable (backend filter)', async () => {
  await call('POST', `/users/${A.id}/follow`, null, B.token)
  await Story.updateOne({ _id: story.id }, { expiresAt: new Date(Date.now() - 1000) })
  const g = groupOf(await call('GET', '/stories', null, B.token), A.id)
  if (g?.stories.some((x) => x.id === story.id)) throw new Error('expired story in tray')
  eq((await call('POST', `/stories/${story.id}/view`, null, B.token)).status, 404)
  eq((await call('GET', `/stories/${story.id}/viewers`, null, A.token)).status, 404)
})
await t('cleanup removes expired story + media file', async () => {
  const n = await cleanupExpiredStories(); if (n < 1) throw new Error('removed ' + n)
  eq(await Story.countDocuments({ _id: story.id }), 0)
  eq((await fetch(story.mediaUrl)).status, 404, 'media')
})
await t('only owner can delete a story', async () => eq((await call('DELETE', `/stories/${followersOnly.id}`, null, B.token)).status, 403))
await t('owner deletes story + media', async () => {
  eq((await call('DELETE', `/stories/${followersOnly.id}`, null, A.token)).status, 200)
  eq(await Story.countDocuments({ _id: followersOnly.id }), 0)
  eq((await fetch(followersOnly.mediaUrl)).status, 404, 'media')
})
await t('invalid id -> 400', async () => eq((await call('POST', '/stories/nope/view', null, B.token)).status, 400))

const ids = [A.id, B.id, C.id]
for (const st of await Story.find({ user: { $in: ids } })) await deleteMedia(st.mediaKey)
await Promise.all([
  User.deleteMany({ _id: { $in: ids } }), Story.deleteMany({ user: { $in: ids } }),
  Follow.deleteMany({ $or: [{ follower: { $in: ids } }, { following: { $in: ids } }] }),
  Block.deleteMany({ $or: [{ blocker: { $in: ids } }, { blocked: { $in: ids } }] }), OTP.deleteMany({ user: { $in: ids } }),
])
await mongoose.disconnect()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
