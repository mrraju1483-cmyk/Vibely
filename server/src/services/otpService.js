import crypto from 'crypto'
import OTPVerification from '../models/OTPVerification.js'
import { env, isProd } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'

const hashOtp = (otp) => crypto.createHmac('sha256', env.jwtSecret).update(otp).digest('hex')

// Provider hook. Add real SMS/email providers here later (OTP_PROVIDER, OTP_API_KEY).
async function deliverOtp(user, otp, purpose) {
  if (env.otpProvider === 'dev') {
    // DEVELOPMENT ONLY: nothing is actually sent.
    if (!isProd) console.log(`[DEV OTP] ${purpose} code for ${user.email}: ${otp} (no SMS/email provider configured)`)
    return { dev: true, delivered: false }
  }
  throw new ApiError(501, `OTP provider "${env.otpProvider}" is not implemented yet`)
}

export async function issueOtp(user, purpose) {
  const last = await OTPVerification.findOne({ user: user._id, purpose }).sort({ createdAt: -1 })
  if (last && Date.now() - last.createdAt.getTime() < env.otpResendCooldownSec * 1000) {
    throw new ApiError(429, 'Please wait a moment before requesting another code')
  }
  await OTPVerification.deleteMany({ user: user._id, purpose })
  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
  await OTPVerification.create({
    user: user._id, email: user.email, phone: user.phone, purpose,
    otpHash: hashOtp(otp), expiresAt: new Date(Date.now() + env.otpExpiresMin * 60000),
  })
  const delivery = await deliverOtp(user, otp, purpose)
  return { devOtp: delivery.dev && !isProd ? otp : undefined }
}

export async function checkOtp(user, purpose, otp) {
  const doc = await OTPVerification.findOne({ user: user._id, purpose, verified: false }).sort({ createdAt: -1 })
  if (!doc) throw new ApiError(400, 'Invalid or expired code')
  if (doc.expiresAt.getTime() < Date.now()) throw new ApiError(400, 'Code expired. Please request a new one.')
  if (doc.attempts >= env.otpMaxAttempts) throw new ApiError(429, 'Too many attempts. Please request a new code.')
  const a = Buffer.from(hashOtp(otp))
  const b = Buffer.from(doc.otpHash)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    doc.attempts += 1
    await doc.save()
    throw new ApiError(400, 'Incorrect code')
  }
  doc.verified = true
  await doc.save()
}

export const clearOtps = (user, purpose) => OTPVerification.deleteMany({ user: user._id, purpose })
