import User from '../models/User.js'
import Block from '../models/Block.js'
import Follow from '../models/Follow.js'
import { ApiError } from '../utils/ApiError.js'
import { toCard } from '../utils/relations.js'

export async function blockUser(me, targetId) {
  if (me._id.equals(targetId)) throw new ApiError(400, 'You cannot block yourself')
  const target = await User.exists({ _id: targetId })
  if (!target) throw new ApiError(404, 'User not found')
  await Block.updateOne({ blocker: me._id, blocked: targetId }, { $setOnInsert: { blocker: me._id, blocked: targetId } }, { upsert: true })
  // Blocking cuts the follow relationship in both directions
  await Follow.deleteMany({ $or: [{ follower: me._id, following: targetId }, { follower: targetId, following: me._id }] })
}

export async function unblockUser(me, targetId) {
  const removed = await Block.findOneAndDelete({ blocker: me._id, blocked: targetId })
  if (!removed) throw new ApiError(404, 'This user is not blocked')
}

export async function listBlocked(me) {
  const rows = await Block.find({ blocker: me._id }).sort({ createdAt: -1 }).limit(200).populate('blocked', 'fullName username profilePhoto isPrivate')
  return { users: rows.filter((r) => r.blocked).map((r) => toCard(r.blocked)) }
}
