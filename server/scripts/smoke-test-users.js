// Phase 3 checks. Server must be running (OTP_PROVIDER=dev, non-production): npm run test:users
import mongoose from 'mongoose'
import { env } from '../src/config/env.js'
import User from '../src/models/User.js'
import Follow from '../src/models/Follow.js'
import Block from '../src/models/Block.js'
import OTP from '../src/models/OTPVerification.js'

const BASE = process.env.API_URL || `http://localhost:${env.port}/api`
let pass = 0, fail = 0
const t = async (name, fn) => { try { await fn(); console.log('PASS', name); pass++ } catch (e) { console.log('FAIL', name, '-', e.message); fail++ } }
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${b}, got ${a}`) }
const call = async (method, path, body, token) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) })
  let j = {}; try { j = await r.json() } catch {}
  return { status: r.status, body: j, data: j.data }
}
const s = Date.now().toString(36)
const rnd = () => String(Math.floor(Math.random() * 1e9)).padStart(9, '0')
async function makeUser(tag) {
  const u = { fullName: `Alice ${tag}`, username: `${tag}${s}`.slice(0, 20), email: `${tag}${s}@test.dev`, phone: '9' + rnd(), password: 'Passw0rd1' }
  const reg = await call('POST', '/auth/register', u)
  if (reg.status !== 201) throw new Error('register failed: ' + reg.body.message)
  await call('POST', '/auth/verify-otp', { identifier: u.email, otp: reg.data.devOtp })
  const login = await call('POST', '/auth/login', { identifier: u.email, password: u.password })
  if (login.status !== 200) throw new Error('login failed: ' + login.body.message)
  return { ...u, token: login.data.token, id: login.data.user.id }
}

await mongoose.connect(env.mongoUri)
const A = await makeUser('a')
const B = await makeUser('b')
const C = await makeUser('c')

await t('profile loads (own)', async () => { const r = await call('GET', `/users/${A.id}`, null, A.token); eq(r.status, 200); eq(r.data.profile.isMe, true) })
await t('GET /users/me', async () => { const r = await call('GET', '/users/me', null, A.token); eq(r.status, 200); eq(r.data.user.email, A.email) })
await t('edit profile', async () => { const r = await call('PUT', '/users/profile', { fullName: 'Alice Updated', bio: 'Hello vibes' }, A.token); eq(r.status, 200); eq(r.data.user.bio, 'Hello vibes') })
await t('username must be unique', async () => eq((await call('PUT', '/users/profile', { username: B.username }, A.token)).status, 409))
await t('invalid username rejected', async () => eq((await call('PUT', '/users/profile', { username: 'a b' }, A.token)).status, 400))
await t('HTML stripped from input', async () => { const r = await call('PUT', '/users/profile', { fullName: '<b>Alice</b> Z' }, A.token); eq(r.data.user.fullName, 'Alice Z') })
await t('search by username (case-insensitive)', async () => { const r = await call('GET', `/users/search?q=${A.username.toUpperCase()}`, null, B.token); eq(r.status, 200); if (!r.data.users.some((u) => u.id === A.id)) throw new Error('not found') })
await t('search by full name', async () => { const r = await call('GET', '/users/search?q=alice%20z', null, B.token); if (!r.data.users.some((u) => u.id === A.id)) throw new Error('not found') })
await t('search needs a term', async () => eq((await call('GET', '/users/search?q=', null, B.token)).status, 400))
await t('B follows A', async () => { const r = await call('POST', `/users/${A.id}/follow`, null, B.token); eq(r.status, 200); eq(r.data.followStatus, 'following') })
await t('duplicate follow blocked', async () => eq((await call('POST', `/users/${A.id}/follow`, null, B.token)).status, 409))
await t('cannot follow yourself', async () => eq((await call('POST', `/users/${A.id}/follow`, null, A.token)).status, 400))
await t('followers list has B', async () => { const r = await call('GET', `/users/${A.id}/followers`, null, A.token); if (!r.data.users.some((u) => u.id === B.id)) throw new Error('missing') })
await t('following list has A', async () => { const r = await call('GET', `/users/${B.id}/following`, null, B.token); if (!r.data.users.some((u) => u.id === A.id)) throw new Error('missing') })
await t('profile shows counts + follow status', async () => { const r = await call('GET', `/users/${A.id}`, null, B.token); eq(r.data.profile.followersCount, 1); eq(r.data.profile.followStatus, 'following') })
await t('unfollow, then unfollow again 404', async () => { eq((await call('DELETE', `/users/${A.id}/follow`, null, B.token)).status, 200); eq((await call('DELETE', `/users/${A.id}/follow`, null, B.token)).status, 404) })
await t('invalid ObjectId -> 400', async () => eq((await call('GET', '/users/not-an-id', null, A.token)).status, 400))
await t('no token -> 401', async () => eq((await call('GET', `/users/${A.id}`)).status, 401))
await t('cannot modify another user (no such route)', async () => eq((await call('PUT', `/users/${A.id}`, { fullName: 'Hacked' }, B.token)).status, 404))

await t('block removes follows and hides profile', async () => {
  await call('POST', `/users/${A.id}/follow`, null, B.token)
  eq((await call('POST', `/users/${B.id}/block`, null, A.token)).status, 200)
  eq((await call('GET', `/users/${A.id}`, null, B.token)).status, 404)
  eq((await call('POST', `/users/${A.id}/follow`, null, B.token)).status, 404)
  eq(await Follow.countDocuments({ follower: B.id, following: A.id }), 0)
})
await t('blocked list + search hides blocker', async () => {
  const l = await call('GET', '/users/blocked', null, A.token); if (!l.data.users.some((u) => u.id === B.id)) throw new Error('not listed')
  const r = await call('GET', `/users/search?q=${A.username}`, null, B.token); if (r.data.users.some((u) => u.id === A.id)) throw new Error('blocker visible in search')
})
await t('A cannot follow blocked B', async () => eq((await call('POST', `/users/${B.id}/follow`, null, A.token)).status, 403))
await t('unblock restores access', async () => { eq((await call('DELETE', `/users/${B.id}/block`, null, A.token)).status, 200); eq((await call('GET', `/users/${A.id}`, null, B.token)).status, 200) })

await t('private account: request -> accept', async () => {
  eq((await call('PUT', '/users/privacy', { isPrivate: true }, A.token)).status, 200)
  const f = await call('POST', `/users/${C.id}/follow`, null, C.token); eq(f.status, 400)
  const r = await call('POST', `/users/${A.id}/follow`, null, C.token); eq(r.data.followStatus, 'pending')
  const p = await call('GET', `/users/${A.id}`, null, C.token); eq(p.data.profile.canViewContent, false)
  eq((await call('GET', `/users/${A.id}/followers`, null, C.token)).status, 403)
  const reqs = await call('GET', '/users/follow-requests', null, A.token); if (!reqs.data.users.some((u) => u.id === C.id)) throw new Error('request missing')
  eq((await call('POST', `/users/follow-requests/${C.id}/accept`, null, A.token)).status, 200)
  const p2 = await call('GET', `/users/${A.id}`, null, C.token); eq(p2.data.profile.canViewContent, true)
})

const ids = [A.id, B.id, C.id]
await Promise.all([User.deleteMany({ _id: { $in: ids } }), Follow.deleteMany({ $or: [{ follower: { $in: ids } }, { following: { $in: ids } }] }), Block.deleteMany({ $or: [{ blocker: { $in: ids } }, { blocked: { $in: ids } }] }), OTP.deleteMany({ user: { $in: ids } })])
await mongoose.disconnect()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
