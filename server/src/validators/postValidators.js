import { ApiError } from '../utils/ApiError.js'
import { clean } from './userValidators.js'
import { REPORT_REASONS } from '../models/Report.js'

const fail = (errors) => { throw new ApiError(400, 'Validation failed', { errors }) }
const TAG = /^[\p{L}\p{N}_]{1,50}$/u

export function extractHashtags(caption, field) {
  const tags = new Set()
  for (const m of caption.matchAll(/#([\p{L}\p{N}_]{1,50})/gu)) tags.add(m[1].toLowerCase())
  for (const raw of String(field || '').split(/[\s,]+/)) {
    const t = raw.replace(/^#+/, '').toLowerCase()
    if (TAG.test(t)) tags.add(t)
  }
  return [...tags].slice(0, 30)
}

export function validatePostInput(b = {}) {
  const e = {}
  const str = (v) => (v === undefined ? '' : typeof v === 'string' ? v : null)
  const caption = str(b.caption) === null ? null : clean(str(b.caption), true)
  if (caption === null || caption.length > 2200) e.caption = 'Caption must be 2200 characters or fewer'
  const loc = str(b.location) === null ? null : clean(str(b.location))
  if (loc === null || loc.length > 100) e.location = 'Location must be 100 characters or fewer'
  const visibility = b.visibility === undefined ? 'public' : b.visibility
  if (!['public', 'followers', 'private'].includes(visibility)) e.visibility = 'Choose public, followers or private'
  if (str(b.hashtags) === null) e.hashtags = 'Invalid hashtags'
  if (Object.keys(e).length) fail(e)
  return { caption, location: loc, visibility, hashtags: extractHashtags(caption, b.hashtags) }
}

export function validateComment(b = {}) {
  const text = typeof b.text === 'string' ? clean(b.text, true) : ''
  if (!text || text.length > 500) fail({ text: 'Comment must be 1-500 characters' })
  if (b.parentId !== undefined && !/^[a-f\d]{24}$/i.test(String(b.parentId))) fail({ parentId: 'Invalid reply target' })
  return { text, parentId: b.parentId || null }
}

export function validateReport(b = {}) {
  if (!REPORT_REASONS.includes(b.reason)) fail({ reason: `Reason must be one of: ${REPORT_REASONS.join(', ')}` })
  const details = b.details === undefined ? '' : typeof b.details === 'string' ? clean(b.details, true) : null
  if (details === null || details.length > 500) fail({ details: 'Details must be 500 characters or fewer' })
  return { reason: b.reason, details }
}
