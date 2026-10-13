// Run with the server started: npm run test:smoke  (needs OTP_PROVIDER=dev, non-production)
import mongoose from 'mongoose'
import { env } from '../src/config/env.js'
import OTP from '../src/models/OTPVerification.js'
import User from '../src/models/User.js'

const BASE = process.env.API_URL || `http://localhost:${env.port}/api`
let pass = 0, fail = 0
const t = async (name, fn) => { try { await fn(); console.log('PASS', name); pass++ } catch (e) { console.log('FAIL', name, '-', e.message); fail++ } }
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${b}, got ${a}`) }
const call = async (method, path, body, token) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) })
  let j = {}; try { j = await r.json() } catch {}
  return { status: r.status, body: j }
}

const s = Date.now().toString(36)
const A = { fullName: 'Test One', username: `u${s}`, email: `u${s}@test.dev`, phone: '9' + String(Date.now()).slice(-9), password: 'Passw0rdOne' }
const B = { fullName: 'Test Two', username: `v${s}`, email: `v${s}@test.dev`, phone: '8' + String(Date.now()).slice(-9), password: 'Passw0rdTwo' }
let otpA, token

await mongoose.connect(env.mongoUri)

await t('1 register new user', async () => { const r = await call('POST', '/auth/register', A); eq(r.status, 201); otpA = r.body.data.devOtp; if (!otpA) throw new Error('no devOtp (is OTP_PROVIDER=dev?)') })
await t('2 duplicate email', async () => eq((await call('POST', '/auth/register', { ...B, email: A.email })).status, 409))
await t('3 duplicate username', async () => eq((await call('POST', '/auth/register', { ...B, username: A.username })).status, 409))
await t('4 duplicate phone', async () => eq((await call('POST', '/auth/register', { ...B, phone: A.phone })).status, 409))
await t('5 weak password rejected', async () => eq((await call('POST', '/auth/register', { ...B, password: 'short' })).status, 400))
await t('login blocked before verification', async () => { const r = await call('POST', '/auth/login', { identifier: A.email, password: A.password }); eq(r.status, 403); eq(r.body.code, 'ACCOUNT_NOT_VERIFIED') })
await t('13a wrong OTP rejected', async () => eq((await call('POST', '/auth/verify-otp', { identifier: A.email, otp: otpA === '000000' ? '111111' : '000000' })).status, 400))
await t('13b correct OTP verifies', async () => eq((await call('POST', '/auth/verify-otp', { identifier: A.email, otp: otpA })).status, 200))
await t('6 login with email', async () => { const r = await call('POST', '/auth/login', { identifier: A.email, password: A.password }); eq(r.status, 200); token = r.body.data.token; if (!token) throw new Error('no token (8 JWT)') })
await t('6b login with phone', async () => eq((await call('POST', '/auth/login', { identifier: A.phone, password: A.password })).status, 200))
await t('7 wrong password', async () => eq((await call('POST', '/auth/login', { identifier: A.email, password: 'Wrong1234' })).status, 401))
await t('7b unknown account gives same error', async () => { const r = await call('POST', '/auth/login', { identifier: 'nobody@test.dev', password: 'Wrong1234' }); eq(r.status, 401); eq(r.body.message, 'Invalid credentials') })
await t('9 /me without token', async () => eq((await call('GET', '/auth/me')).status, 401))
await t('9b /me with tampered token', async () => eq((await call('GET', '/auth/me', null, token + 'x')).status, 401))
await t('10/12 /me with token, no secrets', async () => { const r = await call('GET', '/auth/me', null, token); eq(r.status, 200); const u = r.body.data.user; if ('password' in u) throw new Error('password leaked'); eq(u.email, A.email) })
await t('NoSQL injection blocked', async () => { const r = await call('POST', '/auth/login', { identifier: { $ne: '' }, password: { $ne: '' } }); if (r.status === 200) throw new Error('injection worked') })
await t('11 logout', async () => eq((await call('POST', '/auth/logout', null, token)).status, 200))
await t('14 expired OTP', async () => {
  const r = await call('POST', '/auth/register', B); eq(r.status, 201)
  const user = await User.findOne({ email: B.email })
  await OTP.updateMany({ user: user._id }, { expiresAt: new Date(Date.now() - 1000) })
  const v = await call('POST', '/auth/verify-otp', { identifier: B.email, otp: r.body.data.devOtp })
  eq(v.status, 400); if (!/expired/i.test(v.body.message)) throw new Error('message: ' + v.body.message)
})
let resetOtp
await t('15 forgot password', async () => { const r = await call('POST', '/auth/forgot-password', { identifier: A.email }); eq(r.status, 200); resetOtp = r.body.data?.devOtp; if (!resetOtp) throw new Error('no devOtp') })
await t('16 reset password', async () => eq((await call('POST', '/auth/reset-password', { identifier: A.email, otp: resetOtp, newPassword: 'NewPassw0rd9' })).status, 200))
await t('16b reset code cannot be reused', async () => eq((await call('POST', '/auth/reset-password', { identifier: A.email, otp: resetOtp, newPassword: 'AnotherPass1' })).status, 400))
await t('16c old password no longer works', async () => eq((await call('POST', '/auth/login', { identifier: A.email, password: A.password })).status, 401))
await t('16d new password works', async () => eq((await call('POST', '/auth/login', { identifier: A.email, password: 'NewPassw0rd9' })).status, 200))

await User.deleteMany({ email: { $in: [A.email, B.email] } })
await mongoose.disconnect()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
