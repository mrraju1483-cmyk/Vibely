import crypto from 'crypto'
import User from '../../models/User.js'
import Post from '../../models/Post.js'
import Reel from '../../models/Reel.js'
import Story from '../../models/Story.js'
import Comment from '../../models/Comment.js'
import Follow from '../../models/Follow.js'
import Report from '../../models/Report.js'
import { ApiError } from '../../utils/ApiError.js'
import { getIo } from '../../socket/emitter.js'
import { logAction } from './audit.js'
import { purgeUserContent } from './purge.js'
import { qString, oneOf } from '../../validators/adminValidators.js'

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const dto = (u) => ({
  id: u._id.toString(), fullName: u.fullName, username: u.username, email: u.email, phone: u.phone || '', role: u.role,
  isVerified: u.isVerified, isActive: u.isActive, removed: !!u.removedAt, createdAt: u.createdAt, lastSeenAt: u.lastSeenAt,
})

export async function listUsers(q, { cursor, limit }) {
  const search = qString(q.q, 'q')
  const status = oneOf(q.status, ['active', 'inactive', 'removed'], 'status')
  const role = oneOf(q.role, ['user', 'admin'], 'role')
  const query = {}
  if (search) { const rx = new RegExp(escapeRegex(search), 'i'); query.$or = [{ username: rx }, { fullName: rx }, { email: rx }] }
  if (status === 'active') query.isActive = true
  if (status === 'inactive') { query.isActive = false; query.removedAt = null }
  if (status === 'removed') query.removedAt = { $ne: null }
  if (role) query.role = role
  if (cursor) query._id = { $lt: cursor }
  const rows = await User.find(query).sort({ _id: -1 }).limit(limit + 1)
  const slice = rows.slice(0, limit)
  return { users: slice.map(dto), nextCursor: rows.length > limit ? slice[slice.length - 1]._id.toString() : null }
}

export async function getUser(id) {
  const u = await User.findById(id)
  if (!u) throw new ApiError(404, 'User not found')
  const [posts, reels, stories, comments, followers, following, reportsAgainst, reportsMade, recentPosts] = await Promise.all([
    Post.countDocuments({ author: u._id }), Reel.countDocuments({ author: u._id }), Story.countDocuments({ user: u._id, expiresAt: { $gt: new Date() } }),
    Comment.countDocuments({ author: u._id }), Follow.countDocuments({ following: u._id, status: 'accepted' }), Follow.countDocuments({ follower: u._id, status: 'accepted' }),
    Report.countDocuments({ targetType: 'user', target: u._id }), Report.countDocuments({ reporter: u._id }),
    Post.find({ author: u._id }).sort({ _id: -1 }).limit(6).select('caption media mediaType createdAt'),
  ])
  return {
    user: { ...dto(u), bio: u.bio, isPrivate: u.isPrivate },
    activity: { posts, reels, activeStories: stories, comments, followers, following, reportsAgainst, reportsMade },
    recentPosts: recentPosts.map((p) => ({ id: p._id.toString(), caption: p.caption.slice(0, 120), mediaUrl: p.media, mediaType: p.mediaType, createdAt: p.createdAt })),
  }
}

// Admins can only be changed from the command line (npm run admin:grant / admin:revoke), never through the API
function guardTarget(admin, u) {
  if (!u) throw new ApiError(404, 'User not found')
  if (u._id.equals(admin._id)) throw new ApiError(400, 'You cannot do this to your own account')
  if (u.role === 'admin') throw new ApiError(403, 'Admin accounts cannot be changed from the dashboard')
  if (u.removedAt) throw new ApiError(400, 'This account was already removed')
}

export async function setActive(admin, id, active, reason) {
  const u = await User.findById(id)
  guardTarget(admin, u)
  if (u.isActive === active) return dto(u)
  u.isActive = active
  await u.save()
  if (!active) getIo()?.in(`user:${u._id}`).disconnectSockets(true) // cut live connections right away; REST calls already fail
  await logAction(admin, active ? 'user_activate' : 'user_deactivate', 'user', u._id, { targetLabel: u.username, reason })
  return dto(u)
}

// Permanent: deletes their content and anonymizes the account (messages stay in other people's chats, shown as "Removed user")
export async function removeUser(admin, id, reason) {
  const u = await User.findById(id)
  guardTarget(admin, u)
  const label = u.username
  getIo()?.in(`user:${u._id}`).disconnectSockets(true)
  const removed = await purgeUserContent(u._id)
  u.fullName = 'Removed user'
  u.username = `removed_${crypto.randomBytes(4).toString('hex')}`
  u.email = `removed+${u._id}@removed.invalid`
  u.phone = undefined
  u.bio = ''
  u.profilePhoto = ''
  u.password = crypto.randomBytes(32).toString('hex') // unusable; hashed by the pre-save hook
  u.isActive = false
  u.isVerified = false
  u.removedAt = new Date()
  u.passwordChangedAt = new Date()
  await u.save()
  await logAction(admin, 'user_remove', 'user', u._id, { targetLabel: label, reason, meta: removed })
  return { removed }
}
