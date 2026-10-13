import { ApiError } from '../utils/ApiError.js'

// Only accept plain strings: blocks NoSQL operator injection like { "$ne": "" }
const str = (v) => (typeof v === 'string' ? v.trim() : '')
const normPhone = (p) => str(p).replace(/[\s-]/g, '')
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE = /^\+?\d{10,13}$/
const USERNAME = /^[a-zA-Z0-9_.]{3,20}$/

export function passwordError(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters'
  if (pw.length > 72) return 'Password is too long'
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password needs at least one letter and one number'
  return null
}

function fail(errors) {
  if (Object.keys(errors).length) throw new ApiError(400, 'Validation failed', { errors })
}

export function validateRegister(b = {}) {
  const v = {
    fullName: str(b.fullName),
    username: str(b.username).toLowerCase(),
    email: str(b.email).toLowerCase(),
    phone: normPhone(b.phone),
    password: typeof b.password === 'string' ? b.password : '',
  }
  const e = {}
  if (!v.fullName || v.fullName.length > 60) e.fullName = 'Full name is required (max 60 characters)'
  if (!USERNAME.test(v.username)) e.username = 'Username must be 3-20 letters, numbers, _ or .'
  if (!EMAIL.test(v.email)) e.email = 'Enter a valid email'
  if (v.phone && !PHONE.test(v.phone)) e.phone = 'Enter a valid phone number'
  const pe = passwordError(v.password)
  if (pe) e.password = pe
  fail(e)
  return v
}

// identifier = email OR phone. Returns a safe Mongo query object.
export function identifierQuery(identifier) {
  const raw = str(identifier)
  if (!raw || raw.length > 100) throw new ApiError(400, 'Validation failed', { errors: { identifier: 'Email or phone is required' } })
  return raw.includes('@') ? { email: raw.toLowerCase() } : { phone: normPhone(raw) }
}

export function validateLogin(b = {}) {
  const query = identifierQuery(b.identifier)
  if (typeof b.password !== 'string' || !b.password) fail({ password: 'Password is required' })
  return { query, password: b.password }
}

export function validateOtpInput(b = {}) {
  const query = identifierQuery(b.identifier)
  const otp = str(b.otp)
  if (!/^\d{6}$/.test(otp)) fail({ otp: 'Enter the 6-digit code' })
  return { query, otp }
}

export function validateReset(b = {}) {
  const { query, otp } = validateOtpInput(b)
  const pe = passwordError(b.newPassword)
  if (pe) fail({ newPassword: pe })
  return { query, otp, newPassword: b.newPassword }
}
