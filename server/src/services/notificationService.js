import Notification from '../models/Notification.js'
import User from '../models/User.js'
import { blockState, blockedIdSet } from '../utils/relations.js'
import { emitToUsers } from '../socket/emitter.js'
import { ApiError } from '../utils/ApiError.js'

const ACTOR_FIELDS = 'fullName username profilePhoto isPrivate isActive'
const actorDto = (u) => ({ id: u._id.toString(), fullName: u.fullName, username: u.username, profilePhoto: u.profilePhoto })

// Notifications must never break the action that triggered them
export const safe = (promise) => promise.catch((e) => console.error('Notification failed:', e.message))

export const dto = (n) => ({
  id: n._id.toString(), type: n.type, actor: actorDto(n.actor), text: n.text, count: n.count,
  postId: n.post ? n.post.toString() : null, reelId: n.reel ? n.reel.toString() : null,
  conversationId: n.conversation ? n.conversation.toString() : null, callId: n.call ? n.call.toString() : null,
  read: n.read, createdAt: n.createdAt,
})

const unreadCount = (userId) => Notification.countDocuments({ recipient: userId, read: false })

async function push(recipient, doc) {
  await doc.populate('actor', ACTOR_FIELDS)
  emitToUsers([recipient], 'notification:new', { notification: dto(doc), unreadCount: await unreadCount(recipient) })
}

// Creates a notification (and pushes it live). Never notifies yourself or anyone blocked either way.
export async function notify({ recipient, actor, type, post, reel, conversation, call, text = '', dedupe = false, dedupeTarget }) {
  const rid = String(recipient)
  const aid = String(actor)
  if (rid === aid) return null
  const bs = await blockState(rid, aid)
  if (bs.byMe || bs.byThem) return null
  if (!(await User.exists({ _id: rid, isActive: true }))) return null

  const fields = { actor, type, post: post || null, reel: reel || null, conversation: conversation || null, call: call || null, text: String(text).slice(0, 120) }
  let doc
  if (dedupe) {
    const key = `${type}:${aid}:${dedupeTarget || post || reel || ''}`
    const res = await Notification.updateOne({ recipient: rid, dedupeKey: key }, { $setOnInsert: fields }, { upsert: true })
    if (!res.upsertedCount) return null // already notified about this exact event
    doc = await Notification.findById(res.upsertedId)
  } else {
    doc = await Notification.create({ recipient: rid, ...fields })
  }
  await push(rid, doc)
  return doc
}

// Messages collapse into one unread notification per conversation ("3 new messages")
export async function notifyMessage({ recipient, actor, conversation, text }) {
  const rid = String(recipient)
  const bs = await blockState(rid, actor)
  if (bs.byMe || bs.byThem) return null
  const existing = await Notification.findOne({ recipient: rid, type: 'message', conversation, read: false })
  const count = (existing?.count || 0) + 1
  if (existing) await existing.deleteOne()
  const doc = await Notification.create({ recipient: rid, actor, type: 'message', conversation, text: String(text).slice(0, 120), count })
  await push(rid, doc)
  return doc
}

const MENTION = /(^|[^\w@])@([a-zA-Z0-9_.]{3,20})/g
export async function notifyMentions({ actor, text, post, reel, exclude = [] }) {
  const names = [...new Set([...String(text || '').matchAll(MENTION)].map((m) => m[2].toLowerCase()))].slice(0, 5)
  if (!names.length) return
  const skip = new Set(exclude.map(String))
  const users = await User.find({ username: { $in: names }, isActive: true }).select('_id')
  for (const u of users) if (!skip.has(u._id.toString())) await notify({ recipient: u._id, actor, type: 'mention', post, reel, text })
}

export async function listNotifications(user, { cursor, limit }) {
  const query = { recipient: user._id }
  if (cursor) query._id = { $lt: cursor }
  const rows = await Notification.find(query).sort({ _id: -1 }).limit(limit + 1).populate('actor', ACTOR_FIELDS)
  const hasMore = rows.length > limit
  const slice = rows.slice(0, limit)
  const hidden = await blockedIdSet(user._id)
  const visible = slice.filter((n) => n.actor && n.actor.isActive && !hidden.has(n.actor._id.toString()))
  return { notifications: visible.map(dto), nextCursor: hasMore ? slice[slice.length - 1]._id.toString() : null, unreadCount: await unreadCount(user._id) }
}

export const getUnreadCount = async (user) => ({ unreadCount: await unreadCount(user._id) })

async function syncOtherTabs(user) {
  const count = await unreadCount(user._id)
  emitToUsers([user._id], 'notification:sync', { unreadCount: count })
  return { unreadCount: count }
}

export async function markRead(user, id) {
  const res = await Notification.updateOne({ _id: id, recipient: user._id }, { read: true, readAt: new Date() })
  if (!res.matchedCount) throw new ApiError(404, 'Notification not found')
  return syncOtherTabs(user)
}

export async function markAllRead(user) {
  await Notification.updateMany({ recipient: user._id, read: false }, { read: true, readAt: new Date() })
  return syncOtherTabs(user)
}
