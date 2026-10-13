import { ApiError } from '../utils/ApiError.js'
import { clean } from './userValidators.js'
import { extractHashtags } from './postValidators.js'

export function validateReelInput(b = {}) {
  const e = {}
  const text = (v) => (v === undefined ? '' : typeof v === 'string' ? v : null)
  const caption = text(b.caption) === null ? null : clean(text(b.caption), true)
  if (caption === null || caption.length > 500) e.caption = 'Caption must be 500 characters or fewer'
  const location = text(b.location) === null ? null : clean(text(b.location))
  if (location === null || location.length > 100) e.location = 'Location must be 100 characters or fewer'
  if (text(b.hashtags) === null) e.hashtags = 'Invalid hashtags'
  if (Object.keys(e).length) throw new ApiError(400, 'Validation failed', { errors: e })
  const claimed = Number(b.duration) // sent by the browser: only a fallback when the file's own duration cannot be read
  return { caption, location, hashtags: extractHashtags(caption, b.hashtags), clientDuration: Number.isFinite(claimed) && claimed > 0 ? Math.round(claimed * 10) / 10 : null }
}
