import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { ApiError } from '../utils/ApiError.js'
import { validateRegister, validateLogin, validateOtpInput, validateReset, identifierQuery } from '../validators/authValidators.js'
import { issueOtp, checkOtp, clearOtps } from './otpService.js'
import { signToken } from './tokenService.js'

// Used so "unknown account" takes about as long as "wrong password"
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12)

export async function registerUser(body) {
  const v = validateRegister(body)
  const or = [{ email: v.email }, { username: v.username }]
  if (v.phone) or.push({ phone: v.phone })
  const existing = await User.find({ $or: or }).select('email username phone')
  const errors = {}
  for (const u of existing) {
    if (u.email === v.email) errors.email = 'Email already registered'
    if (u.username === v.username) errors.username = 'Username already taken'
    if (v.phone && u.phone === v.phone) errors.phone = 'Phone already registered'
  }
  if (Object.keys(errors).length) throw new ApiError(409, 'Account already exists', { errors })

  const user = await User.create({
    fullName: v.fullName, username: v.username, email: v.email, password: v.password,
    ...(v.phone ? { phone: v.phone } : {}),
  })
  const { devOtp } = await issueOtp(user, 'verify')
  return { user, devOtp }
}

export async function loginUser(body) {
  const { query, password } = validateLogin(body)
  const user = await User.findOne(query).select('+password')
  const valid = user ? await user.comparePassword(password) : await bcrypt.compare(password, DUMMY_HASH).then(() => false)
  if (!user || !valid) throw new ApiError(401, 'Invalid credentials')
  if (!user.isActive) throw new ApiError(403, 'This account is inactive. Contact support.', { code: 'ACCOUNT_INACTIVE' })
  if (!user.isVerified) {
    throw new ApiError(403, 'Please verify your account first', { code: 'ACCOUNT_NOT_VERIFIED', errors: { identifier: user.email } })
  }
  return { token: signToken(user), user }
}

export async function verifyAccount(body) {
  const { query, otp } = validateOtpInput(body)
  const user = await User.findOne(query)
  if (!user) throw new ApiError(400, 'Invalid or expired code')
  if (user.isVerified) return user
  await checkOtp(user, 'verify', otp)
  user.isVerified = true
  await user.save()
  await clearOtps(user, 'verify')
  return user
}

// Always succeeds from the caller's view, so it never reveals whether an account exists.
export async function resendOtp(body) {
  const query = identifierQuery(body?.identifier)
  const user = await User.findOne(query)
  if (!user || user.isVerified || !user.isActive) return {}
  try {
    return await issueOtp(user, 'verify')
  } catch (e) {
    if (e.status === 429) return {}
    throw e
  }
}

export async function requestPasswordReset(body) {
  const query = identifierQuery(body?.identifier)
  const user = await User.findOne(query)
  if (!user || !user.isActive) return {}
  try {
    return await issueOtp(user, 'reset')
  } catch (e) {
    if (e.status === 429) return {}
    throw e
  }
}

export async function resetPassword(body) {
  const { query, otp, newPassword } = validateReset(body)
  const user = await User.findOne(query)
  if (!user || !user.isActive) throw new ApiError(400, 'Invalid or expired code')
  await checkOtp(user, 'reset', otp)
  user.password = newPassword // hashed by the pre-save hook
  user.passwordChangedAt = new Date() // signs out every session that existed before the reset
  await user.save()
  await clearOtps(user, 'reset') // used code can never be reused
}
