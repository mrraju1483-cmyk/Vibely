// Phase 7 checks. Server must be running (OTP_PROVIDER=dev, MEDIA_PROVIDER=local): npm run test:reels
import mongoose from 'mongoose'
import { env } from '../src/config/env.js'
import User from '../src/models/User.js'
import Reel from '../src/models/Reel.js'
import ReelComment from '../src/models/ReelComment.js'
import ReelView from '../src/models/ReelView.js'
import SavedReel from '../src/models/SavedReel.js'
import Like from '../src/models/Like.js'
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
// A minimal MP4-shaped file: 'ftyp' + 'moov/mvhd' header with the given duration (not playable, but passes the server's checks)
const box = (type, payload) => { const b = Buffer.alloc(8 + payload.length); b.writeUInt32BE(8 + payload.length, 0); b.write(type, 4, 'ascii'); payload.copy(b, 8); return b }
const mp4 = (seconds) => {
  const mvhd = Buffer.alloc(100)
  mvhd.writeUInt32BE(1000, 12)
  mvhd.writeUInt32BE(Math.round(seconds * 1000), 16)
  return Buffer.concat([box('ftyp', Buffer.concat([Buffer.from('isom'), Buffer.alloc(4), Buffer.from('isom')])), box('moov', box('mvhd', mvhd)), Buffer.alloc(2048)])
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
async function mkReel(token, fields = {}, file = mp4(5), mime = 'video/mp4') {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  if (file) fd.append('media', new Blob([file], { type: mime }), 'r.mp4')
  const r = await fetch(BASE + '/reels', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
  let j = {}; try { j = await r.json() } catch {}
  return { status: r.status, body: j, data: j.data }
}
const s = Date.now().toString(36)
const rnd = () => String(Math.floor(Math.random() * 1e9)).padStart(9, '0')
async function makeUser(tag) {
  const u = { fullName: `Reel ${tag}`, username: `${tag}${s}`.slice(0, 20), email: `${tag}${s}@test.dev`, phone: '9' + rnd(), password: 'Passw0rd1' }
  const reg = await call('POST', '/auth/register', u)
  if (reg.status !== 201) throw new Error('register failed: ' + reg.body.message)
  await call('POST', '/auth/verify-otp', { identifier: u.email, otp: reg.data.devOtp })
  const login = await call('POST', '/auth/login', { identifier: u.email, password: u.password })
  return { ...u, token: login.data.token, id: login.data.user.id }
}

await mongoose.connect(env.mongoUri)
const A = await makeUser('a'), B = await makeUser('b'), C = await makeUser('c')
let reel

await t('no token -> 401', async () => eq((await call('GET', '/reels/feed')).status, 401))
await t('create reel; duration read from file', async () => {
  const r = await mkReel(A.token, { caption: 'Dance #Vibes #fun', location: 'Goa' }); eq(r.status, 201, r.body.message); reel = r.data.reel
  eq(reel.duration, 5); eq(reel.hashtags.join(), 'vibes,fun')
})
await t('video file is served', async () => eq((await fetch(reel.videoUrl)).status, 200))
await t('video longer than 90s rejected', async () => eq((await mkReel(A.token, {}, mp4(120))).status, 400))
await t('image rejected (reels are videos)', async () => eq((await mkReel(A.token, {}, PNG, 'image/png')).status, 400))
await t('fake video rejected', async () => eq((await mkReel(A.token, {}, Buffer.from('not a video at all, just text bytes')) ).status, 400))
await t('missing file rejected', async () => eq((await mkReel(A.token, {}, null)).status, 400))
await t('caption too long rejected', async () => eq((await mkReel(A.token, { caption: 'x'.repeat(501) })).status, 400))
await t('feed: public account visible to non-followers', async () => { const r = await call('GET', '/reels/feed', null, B.token); eq(r.status, 200); if (!r.data.reels.some((x) => x.id === reel.id)) throw new Error('missing') })
await t('feed pagination (cursor)', async () => {
  for (let i = 0; i < 3; i++) await mkReel(A.token, { caption: `r${i}` })
  const p1 = await call('GET', '/reels/feed?limit=2', null, B.token); eq(p1.data.reels.length, 2); if (!p1.data.nextCursor) throw new Error('no cursor')
  const p2 = await call('GET', `/reels/feed?limit=2&cursor=${p1.data.nextCursor}`, null, B.token)
  if (p2.data.reels.some((x) => p1.data.reels.some((y) => y.id === x.id))) throw new Error('overlap')
  eq((await call('GET', '/reels/feed?cursor=bad', null, B.token)).status, 400)
})
await t('get single reel + user reels', async () => {
  eq((await call('GET', `/reels/${reel.id}`, null, B.token)).status, 200)
  eq((await call('GET', `/reels/user/${A.id}`, null, B.token)).data.reels.length, 4)
  eq((await call('GET', '/reels/nope', null, B.token)).status, 400)
})
await t('like is idempotent, unlike works', async () => {
  eq((await call('POST', `/reels/${reel.id}/like`, null, B.token)).data.likesCount, 1)
  eq((await call('POST', `/reels/${reel.id}/like`, null, B.token)).data.likesCount, 1, 'duplicate')
  eq((await call('GET', `/reels/${reel.id}`, null, B.token)).data.reel.likedByMe, true)
  eq((await call('DELETE', `/reels/${reel.id}/like`, null, B.token)).data.likesCount, 0)
})
await t('comments: add, list, delete own only', async () => {
  const c = await call('POST', `/reels/${reel.id}/comment`, { text: 'Nice!' }, B.token); eq(c.status, 201)
  eq((await call('POST', `/reels/${reel.id}/comment`, { text: '   ' }, B.token)).status, 400)
  eq((await call('GET', `/reels/${reel.id}/comments`, null, A.token)).data.comments.length, 1)
  eq((await call('GET', `/reels/${reel.id}`, null, A.token)).data.reel.commentsCount, 1)
  eq((await call('DELETE', `/reels/comments/${c.data.comment.id}`, null, A.token)).status, 403)
  eq((await call('DELETE', `/reels/comments/${c.data.comment.id}`, null, B.token)).status, 200)
  eq((await call('GET', `/reels/${reel.id}`, null, A.token)).data.reel.commentsCount, 0)
})
await t('save / saved list / unsave', async () => {
  eq((await call('POST', `/reels/${reel.id}/save`, null, B.token)).status, 200)
  eq((await call('POST', `/reels/${reel.id}/save`, null, B.token)).status, 200, 'duplicate')
  eq((await call('GET', '/reels/saved', null, B.token)).data.reels.length, 1)
  await call('DELETE', `/reels/${reel.id}/save`, null, B.token)
  eq((await call('GET', '/reels/saved', null, B.token)).data.reels.length, 0)
})
await t('share increments + link', async () => { const r = await call('POST', `/reels/${reel.id}/share`, null, B.token); eq(r.data.sharesCount, 1); if (!r.data.url.includes(reel.id)) throw new Error('url') })
await t('views counted once per person, own views ignored', async () => {
  await call('POST', `/reels/${reel.id}/view`, null, B.token); await call('POST', `/reels/${reel.id}/view`, null, B.token); await call('POST', `/reels/${reel.id}/view`, null, A.token)
  eq((await call('GET', `/reels/${reel.id}`, null, B.token)).data.reel.viewsCount, 1)
})
await t('report reel (dup 409, own 400)', async () => {
  eq((await call('POST', `/reels/${reel.id}/report`, { reason: 'spam' }, B.token)).status, 201)
  eq((await call('POST', `/reels/${reel.id}/report`, { reason: 'spam' }, B.token)).status, 409)
  eq((await call('POST', `/reels/${reel.id}/report`, { reason: 'spam' }, A.token)).status, 400)
})
await t('private account: reels hidden until followed', async () => {
  await call('PUT', '/users/privacy', { isPrivate: true }, A.token)
  eq((await call('GET', `/reels/${reel.id}`, null, C.token)).status, 404)
  const feed = await call('GET', '/reels/feed?limit=15', null, C.token); if (feed.data.reels.some((x) => x.author.id === A.id)) throw new Error('private reel in feed')
  eq((await call('GET', `/reels/user/${A.id}`, null, C.token)).status, 403)
  await call('POST', `/users/${A.id}/follow`, null, C.token); await call('POST', `/users/follow-requests/${C.id}/accept`, null, A.token)
  eq((await call('GET', `/reels/${reel.id}`, null, C.token)).status, 200)
  await call('PUT', '/users/privacy', { isPrivate: false }, A.token)
  eq((await call('GET', `/reels/${reel.id}`, null, B.token)).status, 200)
})
await t('blocked users cannot see reels (either way)', async () => {
  await call('POST', `/users/${A.id}/block`, null, A.token)
  eq((await call('GET', `/reels/${reel.id}`, null, B.token)).status, 404)
  eq((await call('POST', `/reels/${reel.id}/like`, null, B.token)).status, 404)
  const feed = await call('GET', '/reels/feed?limit=15', null, B.token); if (feed.data.reels.some((x) => x.author.id === A.id)) throw new Error('blocked reel in feed')
  await call('DELETE', `/users/${B.id}/block`, null, A.token)
})
await t('only the owner can delete a reel', async () => eq((await call('DELETE', `/reels/${reel.id}`, null, B.token)).status, 403))
await t('owner deletes reel + media + related data', async () => {
  await call('POST', `/reels/${reel.id}/comment`, { text: 'bye' }, B.token)
  eq((await call('DELETE', `/reels/${reel.id}`, null, A.token)).status, 200)
  eq((await call('GET', `/reels/${reel.id}`, null, A.token)).status, 404)
  eq(await ReelComment.countDocuments({ reel: reel.id }), 0)
  eq((await fetch(reel.videoUrl)).status, 404, 'media')
})

const ids = [A.id, B.id, C.id]
for (const r of await Reel.find({ author: { $in: ids } })) await deleteMedia(r.mediaKey)
await Promise.all([
  User.deleteMany({ _id: { $in: ids } }), Reel.deleteMany({ author: { $in: ids } }), ReelComment.deleteMany({ author: { $in: ids } }),
  ReelView.deleteMany({ user: { $in: ids } }), SavedReel.deleteMany({ user: { $in: ids } }), Like.deleteMany({ user: { $in: ids } }),
  Report.deleteMany({ reporter: { $in: ids } }),
  Follow.deleteMany({ $or: [{ follower: { $in: ids } }, { following: { $in: ids } }] }),
  Block.deleteMany({ $or: [{ blocker: { $in: ids } }, { blocked: { $in: ids } }] }), OTP.deleteMany({ user: { $in: ids } }),
])
await mongoose.disconnect()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
