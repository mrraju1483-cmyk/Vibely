import Block from '../models/Block.js'
import Follow from '../models/Follow.js'
import { ApiError } from './ApiError.js'

export const toCard = (u, followStatus = 'none') => ({
  id: u._id.toString(), fullName: u.fullName, username: u.username,
  profilePhoto: u.profilePhoto, isPrivate: u.isPrivate, followStatus,
})

// ids of everyone blocked by the user OR who blocked the user (use to hide content both ways)
export async function blockedIdSet(userId) {
  const rows = await Block.find({ $or: [{ blocker: userId }, { blocked: userId }] }).select('blocker blocked')
  const set = new Set()
  rows.forEach((r) => { set.add(r.blocker.toString()); set.add(r.blocked.toString()) })
  set.delete(userId.toString())
  return set
}

export async function blockState(meId, otherId) {
  const [byMe, byThem] = await Promise.all([
    Block.exists({ blocker: meId, blocked: otherId }),
    Block.exists({ blocker: otherId, blocked: meId }),
  ])
  return { byMe: !!byMe, byThem: !!byThem }
}

// Map of userId -> 'following' | 'pending' for the viewer
export async function followStatusMap(viewerId, ids) {
  const rows = await Follow.find({ follower: viewerId, following: { $in: ids } }).select('following status')
  return new Map(rows.map((r) => [r.following.toString(), r.status === 'accepted' ? 'following' : 'pending']))
}

export const parsePaging = (q) => {
  const page = Math.min(Math.max(parseInt(q.page, 10) || 1, 1), 1000)
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 50)
  return { page, limit, skip: (page - 1) * limit }
}

// Cursor pagination: cursor = last seen _id (ObjectId order == creation order)
export const parseCursorPaging = (q, def = 10, max = 30) => {
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || def, 1), max)
  const raw = q.cursor
  if (raw !== undefined && !/^[a-f\d]{24}$/i.test(String(raw))) throw new ApiError(400, 'Invalid cursor')
  return { limit, cursor: raw || null }
}
