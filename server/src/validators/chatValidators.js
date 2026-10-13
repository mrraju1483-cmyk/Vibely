import { ApiError } from '../utils/ApiError.js'
import { clean } from './userValidators.js'

const ID = /^[a-f\d]{24}$/i
const fail = (errors) => { throw new ApiError(400, 'Validation failed', { errors }) }

export const validateUserId = (v) => {
  if (typeof v !== 'string' || !ID.test(v)) fail({ userId: 'Invalid user' })
  return v
}

export function validateGroupName(v) {
  const name = typeof v === 'string' ? clean(v) : ''
  if (!name || name.length > 50) fail({ name: 'Group name is required (max 50 characters)' })
  return name
}

export function validateUserIds(list, { min = 1, max = 49 } = {}) {
  if (!Array.isArray(list) || list.length < min || list.length > max || !list.every((x) => typeof x === 'string' && ID.test(x))) {
    fail({ memberIds: `Choose between ${min} and ${max} people` })
  }
  return [...new Set(list)]
}

export function validateMessageText(v) {
  const text = v === undefined ? '' : typeof v === 'string' ? clean(v, true) : null
  if (text === null || text.length > 2000) fail({ text: 'Message must be 2000 characters or fewer' })
  return text
}

export const DISAPPEAR_OPTIONS = [0, 86400, 604800, 7776000] // off, 24 hours, 7 days, 90 days
export function validateDisappear(v) {
  if (!DISAPPEAR_OPTIONS.includes(v)) fail({ disappearAfter: 'Choose off, 24 hours, 7 days or 90 days' })
  return v
}
