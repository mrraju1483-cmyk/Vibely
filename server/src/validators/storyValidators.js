import { ApiError } from '../utils/ApiError.js'
import { clean } from './userValidators.js'

export function validateStoryInput(b = {}, defaultVisibility = 'public') {
  const e = {}
  const caption = b.caption === undefined ? '' : typeof b.caption === 'string' ? clean(b.caption) : null
  if (caption === null || caption.length > 200) e.caption = 'Caption must be 200 characters or fewer'
  const visibility = b.visibility === undefined || b.visibility === '' ? defaultVisibility : b.visibility
  if (!['public', 'followers'].includes(visibility)) e.visibility = 'Choose public or followers'
  if (Object.keys(e).length) throw new ApiError(400, 'Validation failed', { errors: e })
  return { caption, visibility }
}
