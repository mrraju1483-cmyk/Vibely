import { ApiError } from '../utils/ApiError.js'
import { clean } from './userValidators.js'

const fail = (errors) => { throw new ApiError(400, 'Validation failed', { errors }) }

export function validateReason(b = {}) {
  const reason = typeof b.reason === 'string' ? clean(b.reason) : ''
  if (reason.length < 3 || reason.length > 300) fail({ reason: 'Give a reason (3-300 characters). It is saved in the audit log.' })
  return reason
}

// Query values must be plain strings (arrays/objects are rejected)
export function qString(v, name, max = 50) {
  if (v === undefined || v === '') return ''
  if (typeof v !== 'string' || v.length > max) fail({ [name]: `Invalid ${name}` })
  return v.trim()
}

export function oneOf(v, list, name, fallback = '') {
  if (v === undefined || v === '') return fallback
  if (!list.includes(v)) fail({ [name]: `${name} must be one of: ${list.join(', ')}` })
  return v
}

export function validateActive(b = {}) {
  if (typeof b.active !== 'boolean') fail({ active: 'active must be true or false' })
  return { active: b.active, reason: validateReason(b) }
}

export function validateReportUpdate(b = {}) {
  const status = oneOf(b.status, ['open', 'resolved', 'rejected'], 'status')
  if (!status) fail({ status: 'Choose a status' })
  const adminResponse = b.adminResponse === undefined ? '' : typeof b.adminResponse === 'string' ? clean(b.adminResponse, true) : null
  if (adminResponse === null || adminResponse.length > 500) fail({ adminResponse: 'Response must be 500 characters or fewer' })
  const action = oneOf(b.action, ['none', 'remove_content', 'deactivate_user'], 'action', 'none')
  const reason = action === 'none' ? '' : validateReason(b) // destructive actions need a reason
  return { status, adminResponse, action, reason }
}
