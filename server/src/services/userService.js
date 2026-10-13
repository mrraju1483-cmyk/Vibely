import User from '../models/User.js'
import Follow from '../models/Follow.js'
import Post from '../models/Post.js'
import Reel from '../models/Reel.js'
import { adjustForPrivacy } from './hashtagService.js'
import { ApiError } from '../utils/ApiError.js'
import { validateProfileUpdate, validateSearchQuery } from '../validators/userValidators.js'
import { blockState, blockedIdSet, followStatusMap, toCard } from '../utils/relations.js'

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export async function getProfile(viewer, id) {
  const target = await User.findOne({ _id: id, isActive: true })
  if (!target) throw new ApiError(404, 'User not found')
  const isMe = viewer._id.equals(target._id)
  const bs = isMe ? { byMe: false, byThem: false } : await blockState(viewer._id, target._id)
  if (bs.byThem) throw new ApiError(404, 'User not found') // blocked users cannot see the profile

  const [followersCount, followingCount, rel] = await Promise.all([
    Follow.countDocuments({ following: target._id, status: 'accepted' }),
    Follow.countDocuments({ follower: target._id, status: 'accepted' }),
    isMe ? null : Follow.findOne({ follower: viewer._id, following: target._id }),
  ])
  const followStatus = rel ? (rel.status === 'accepted' ? 'following' : 'pending') : 'none'
  const canViewContent = !bs.byMe && (isMe || !target.isPrivate || followStatus === 'following')

  const vis = isMe ? ['public', 'followers', 'private']
    : !bs.byMe && followStatus === 'following' ? ['public', 'followers']
    : !bs.byMe && !target.isPrivate ? ['public'] : []
  const postsCount = vis.length ? await Post.countDocuments({ author: target._id, visibility: { $in: vis } }) : 0

  return {
    id: target._id.toString(), fullName: target.fullName, username: target.username, bio: target.bio,
    profilePhoto: target.profilePhoto, isPrivate: target.isPrivate, createdAt: target.createdAt,
    followersCount, followingCount, postsCount,
    isMe, followStatus, isBlockedByMe: bs.byMe, canViewContent,
  }
}

export async function updateProfile(user, body) {
  const v = validateProfileUpdate(body)
  const errors = {}
  if (v.username && v.username !== user.username && (await User.exists({ username: v.username, _id: { $ne: user._id } }))) {
    errors.username = 'Username already taken'
  }
  if (v.phone && v.phone !== user.phone && (await User.exists({ phone: v.phone, _id: { $ne: user._id } }))) {
    errors.phone = 'Phone already registered'
  }
  if (Object.keys(errors).length) throw new ApiError(409, 'Already in use', { errors })

  for (const [k, val] of Object.entries(v)) user[k] = k === 'phone' && val === '' ? undefined : val
  await user.save()
  return user.toSafeJSON()
}

export async function setPrivacy(user, isPrivate) {
  if (typeof isPrivate !== 'boolean') throw new ApiError(400, 'Validation failed', { errors: { isPrivate: 'Must be true or false' } })
  const changed = user.isPrivate !== isPrivate
  user.isPrivate = isPrivate
  await user.save()
  if (changed) {
    await Post.updateMany({ author: user._id }, { authorPrivate: isPrivate })
    await Reel.updateMany({ author: user._id }, { authorPrivate: isPrivate })
    await adjustForPrivacy(user._id, isPrivate).catch(() => {})
  }
  // Going public approves everything waiting in the request queue
  if (!isPrivate) await Follow.updateMany({ following: user._id, status: 'pending' }, { status: 'accepted' })
  return user.toSafeJSON()
}

export async function searchUsers(viewer, rawQuery, { limit, skip }) {
  const q = validateSearchQuery(rawQuery)
  const rx = new RegExp(escapeRegex(q), 'i') // case-insensitive, user input escaped
  const exclude = [...(await blockedIdSet(viewer._id))]
  const rows = await User.find({
    isActive: true, isVerified: true, _id: { $nin: exclude },
    $or: [{ username: rx }, { fullName: rx }],
  }).sort({ username: 1 }).skip(skip).limit(limit + 1).select('fullName username profilePhoto isPrivate')

  const hasMore = rows.length > limit
  const page = rows.slice(0, limit)
  const statuses = await followStatusMap(viewer._id, page.map((u) => u._id))
  return { users: page.map((u) => toCard(u, statuses.get(u._id.toString()) || 'none')), hasMore }
}

export async function setStoryPrivacy(user, visibility) {
  if (!['public', 'followers'].includes(visibility)) throw new ApiError(400, 'Validation failed', { errors: { visibility: 'Choose public or followers' } })
  user.storyVisibility = visibility
  await user.save()
  return user.toSafeJSON()
}

export async function setChatPrivacy(user, body = {}) {
  const e = {}
  const next = {}
  for (const k of ['showOnlineStatus', 'showLastSeen']) {
    if (body[k] === undefined) continue
    if (typeof body[k] !== 'boolean') e[k] = 'Must be true or false'
    else next[k] = body[k]
  }
  if (body.messagePrivacy !== undefined) {
    if (!['everyone', 'following'].includes(body.messagePrivacy)) e.messagePrivacy = 'Choose everyone or following'
    else next.messagePrivacy = body.messagePrivacy
  }
  if (Object.keys(e).length) throw new ApiError(400, 'Validation failed', { errors: e })
  if (!Object.keys(next).length) throw new ApiError(400, 'Nothing to update')
  Object.assign(user, next)
  await user.save()
  return user.toSafeJSON()
}
