import User from '../models/User.js'
import { ApiError, asyncHandler } from '../utils/ApiError.js'
import { verifyToken, tokenIsStale } from '../services/tokenService.js'

export const requireAuth = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ')
  if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Authentication required')
  let payload
  try {
    payload = verifyToken(token)
  } catch {
    throw new ApiError(401, 'Invalid or expired token')
  }
  const user = await User.findById(payload.sub)
  if (!user || tokenIsStale(payload, user)) throw new ApiError(401, 'Invalid or expired token')
  if (!user.isActive) throw new ApiError(403, 'This account is inactive')
  req.user = user
  next()
})

// Use after requireAuth. The role is read from the database on every request, so revoking admin takes effect immediately.
export const requireAdmin = (req, res, next) =>
  req.user?.role === 'admin' ? next() : next(new ApiError(403, 'Admin access required'))
