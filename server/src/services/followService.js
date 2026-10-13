import User from '../models/User.js'
import Follow from '../models/Follow.js'
import { ApiError } from '../utils/ApiError.js'
import { blockState, blockedIdSet, followStatusMap, toCard } from '../utils/relations.js'
import { notify, safe } from './notificationService.js'

const CARD = 'fullName username profilePhoto isPrivate isActive'

export async function followUser(me, targetId) {
  if (me._id.equals(targetId)) throw new ApiError(400, 'You cannot follow yourself')
  const target = await User.findOne({ _id: targetId, isActive: true })
  if (!target) throw new ApiError(404, 'User not found')
  const bs = await blockState(me._id, target._id)
  if (bs.byThem) throw new ApiError(404, 'User not found')
  if (bs.byMe) throw new ApiError(403, 'Unblock this user before following')

  const status = target.isPrivate ? 'pending' : 'accepted'
  try {
    await Follow.create({ follower: me._id, following: target._id, status })
  } catch (e) {
    if (e.code === 11000) throw new ApiError(409, 'You already follow or have requested this user')
    throw e
  }
  safe(notify({ recipient: target._id, actor: me._id, type: status === 'accepted' ? 'follow' : 'follow_request', dedupe: true }))
  return { followStatus: status === 'accepted' ? 'following' : 'pending' }
}

export async function unfollowUser(me, targetId) {
  const removed = await Follow.findOneAndDelete({ follower: me._id, following: targetId })
  if (!removed) throw new ApiError(404, 'You are not following this user')
}

async function listRelation(viewer, targetId, field, { limit, skip }) {
  const target = await User.findOne({ _id: targetId, isActive: true })
  if (!target) throw new ApiError(404, 'User not found')
  const isMe = viewer._id.equals(target._id)
  if (!isMe) {
    if ((await blockState(viewer._id, target._id)).byThem) throw new ApiError(404, 'User not found')
    if (target.isPrivate) {
      const ok = await Follow.exists({ follower: viewer._id, following: target._id, status: 'accepted' })
      if (!ok) throw new ApiError(403, 'This account is private')
    }
  }
  const other = field === 'follower' ? 'following' : 'follower' // we list the opposite side
  const rows = await Follow.find({ [other]: target._id, status: 'accepted' })
    .sort({ createdAt: -1 }).skip(skip).limit(limit + 1).populate(field, CARD)
  const hasMore = rows.length > limit
  const hidden = await blockedIdSet(viewer._id)
  const people = rows.slice(0, limit).map((r) => r[field]).filter((u) => u && u.isActive && !hidden.has(u._id.toString()))
  const statuses = await followStatusMap(viewer._id, people.map((u) => u._id))
  return { users: people.map((u) => toCard(u, statuses.get(u._id.toString()) || 'none')), hasMore }
}

export const getFollowers = (viewer, id, paging) => listRelation(viewer, id, 'follower', paging)
export const getFollowing = (viewer, id, paging) => listRelation(viewer, id, 'following', paging)

// ---- Follow requests (private accounts) ----
export async function getRequests(me) {
  const rows = await Follow.find({ following: me._id, status: 'pending' }).sort({ createdAt: -1 }).limit(50).populate('follower', CARD)
  const hidden = await blockedIdSet(me._id)
  return { users: rows.map((r) => r.follower).filter((u) => u && u.isActive && !hidden.has(u._id.toString())).map((u) => toCard(u)) }
}

export async function acceptRequest(me, followerId) {
  const doc = await Follow.findOneAndUpdate({ follower: followerId, following: me._id, status: 'pending' }, { status: 'accepted' })
  if (!doc) throw new ApiError(404, 'Request not found')
  safe(notify({ recipient: followerId, actor: me._id, type: 'follow_accept', dedupe: true }))
}

export async function rejectRequest(me, followerId) {
  const doc = await Follow.findOneAndDelete({ follower: followerId, following: me._id, status: 'pending' })
  if (!doc) throw new ApiError(404, 'Request not found')
}
