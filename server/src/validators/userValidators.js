import { ApiError } from '../utils/ApiError.js'

// Remove HTML tags and control characters (newlines kept when allowNewlines)
export const clean = (s, allowNewlines = false) =>
  s.replace(/<[^>]*>/g, '').replace(allowNewlines ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '').trim()
const USERNAME = /^[a-zA-Z0-9_.]{3,20}$/
const PHONE = /^\+?\d{10,13}$/

export function validateProfileUpdate(b = {}) {
  const out = {}
  const e = {}
  const isStr = (v) => typeof v === 'string'

  if (b.fullName !== undefined) {
    const v = isStr(b.fullName) ? clean(b.fullName) : ''
    if (!v || v.length > 60) e.fullName = 'Full name is required (max 60 characters)'
    else out.fullName = v
  }
  if (b.username !== undefined) {
    const v = isStr(b.username) ? b.username.trim().toLowerCase() : ''
    if (!USERNAME.test(v)) e.username = 'Username must be 3-20 letters, numbers, _ or .'
    else out.username = v
  }
  if (b.bio !== undefined) {
    const v = isStr(b.bio) ? clean(b.bio, true) : null
    if (v === null || v.length > 160) e.bio = 'Bio must be 160 characters or fewer'
    else out.bio = v
  }
  if (b.phone !== undefined) {
    const v = isStr(b.phone) ? b.phone.replace(/[\s-]/g, '') : null
    if (v === null || (v !== '' && !PHONE.test(v))) e.phone = 'Enter a valid phone number'
    else out.phone = v
  }
  if (b.profilePhoto !== undefined) {
    const v = isStr(b.profilePhoto) ? b.profilePhoto.trim() : null
    let ok = v === ''
    if (v && v.length <= 500) {
      try { ok = ['http:', 'https:'].includes(new URL(v).protocol) } catch { ok = false }
    }
    if (!ok) e.profilePhoto = 'Enter a valid http(s) image URL'
    else out.profilePhoto = v
  }
  if (Object.keys(e).length) throw new ApiError(400, 'Validation failed', { errors: e })
  if (!Object.keys(out).length) throw new ApiError(400, 'Nothing to update')
  return out
}

export function validateSearchQuery(q) {
  const v = typeof q === 'string' ? q.trim() : ''
  if (!v || v.length > 50) throw new ApiError(400, 'Enter a search term (1-50 characters)')
  return v
}
