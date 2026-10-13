import path from 'path'
import Conversation from '../../models/Conversation.js'
import Message from '../../models/Message.js'
import User from '../../models/User.js'
import { ApiError } from '../../utils/ApiError.js'
import { blockState, blockedIdSet } from '../../utils/relations.js'
import { validateChatAttachment } from '../media/validate.js'
import { uploadMedia, deleteMedia } from '../media/index.js'
import { isOnline } from '../../socket/presence.js'
import { emitToUsers } from '../../socket/emitter.js'
import { validateMessageText } from '../../validators/chatValidators.js'
import { AUTHOR_FIELDS, authorDto } from '../postService.js'
import { live, loadConversation, participantIds } from './shared.js'
import { notifyMessage, safe } from '../notificationService.js'
import { assertCanMessage } from './conversationService.js'

const PREVIEW = { image: '📷 Photo', video: '🎬 Video', file: '📄 Document', voice: '🎤 Voice message' }

export function messageDto(m, recipientCount) {
  const gone = m.deletedForEveryone
  return {
    id: m._id.toString(), conversationId: m.conversation.toString(), sender: authorDto(m.sender), type: m.type,
    text: gone ? '' : m.text,
    attachment: gone || !m.attachment?.url ? null : { url: m.attachment.url, name: m.attachment.name, size: m.attachment.size, mimeType: m.attachment.mimeType, duration: m.attachment.duration },
    deleted: gone, createdAt: m.createdAt, expiresAt: m.expiresAt,
    deliveredTo: m.deliveredTo.map((d) => d.user.toString()), readBy: m.readBy.map((r) => r.user.toString()), recipientCount,
  }
}

const safeName = (n) => path.basename(String(n || 'file')).replace(/[\u0000-\u001f<>:"|?*\\/]/g, '').slice(0, 100) || 'file'

export async function sendMessage(me, convId, file, body = {}) {
  const conv = await loadConversation(me._id, convId, { populate: false })
  const ids = participantIds(conv)
  const others = ids.filter((id) => id !== me._id.toString())

  if (conv.type === 'direct') { // direct chats re-check blocks and privacy on every send
    const other = await User.findOne({ _id: others[0], isActive: true })
    if (!other) throw new ApiError(403, 'This account is unavailable')
    const bs = await blockState(me._id, other._id)
    if (bs.byMe || bs.byThem) throw new ApiError(403, 'You cannot message this user')
    await assertCanMessage(me, other)
  }

  const text = validateMessageText(body.text)
  if (!text && !file) throw new ApiError(400, 'Validation failed', { errors: { text: 'Write a message or attach a file' } })
  const info = file ? validateChatAttachment(file) : null
  const stored = info ? await uploadMedia(file, info) : null

  const hidden = await blockedIdSet(me._id)
  const reachable = others.filter((id) => !hidden.has(id))
  const now = new Date()
  const type = info ? info.mediaType : 'text'
  const expiresAt = conv.disappearAfter > 0 ? new Date(now.getTime() + conv.disappearAfter * 1000) : null
  let msg
  try {
    msg = await Message.create({
      conversation: conv._id, sender: me._id, type, text, expiresAt,
      deliveredTo: reachable.filter(isOnline).map((user) => ({ user, at: now })), // online recipients get it immediately
      ...(stored && { attachment: { url: stored.url, key: stored.key, name: safeName(file.originalname), size: file.size, mimeType: info.mime } }),
    })
  } catch (e) {
    if (stored) await deleteMedia(stored.key).catch(() => {})
    throw e
  }
  await Conversation.updateOne(
    { _id: conv._id },
    { $set: { lastMessage: { sender: me._id, text: (text || PREVIEW[type] || '').slice(0, 120), kind: type, createdAt: msg.createdAt, expiresAt }, lastMessageAt: msg.createdAt }, $inc: { 'participants.$[p].unread': 1 } },
    { arrayFilters: [{ 'p.user': { $ne: me._id } }] }
  )
  await msg.populate('sender', AUTHOR_FIELDS)
  const dto = messageDto(msg, others.length)
  emitToUsers([...reachable, me._id.toString()], 'message:new', dto) // recipients + the sender's other open tabs
  for (const rid of reachable) if (!isOnline(rid)) safe(notifyMessage({ recipient: rid, actor: me._id, conversation: conv._id, text: (text || PREVIEW[type] || '').slice(0, 100) }))
  return dto
}

export async function listMessages(me, convId, { cursor, limit }) {
  const conv = await loadConversation(me._id, convId, { populate: false })
  const mine = conv.participants.find((p) => p.user.equals(me._id))
  const query = { conversation: conv._id, createdAt: { $gte: mine.joinedAt }, deletedFor: { $ne: me._id }, ...live() }
  if (cursor) query._id = { $lt: cursor }
  const rows = await Message.find(query).sort({ _id: -1 }).limit(limit + 1).populate('sender', AUTHOR_FIELDS)
  const hasMore = rows.length > limit
  const slice = rows.slice(0, limit).filter((m) => m.sender)
  return { messages: slice.map((m) => messageDto(m, conv.participants.length - 1)), nextCursor: hasMore ? rows[limit - 1]._id.toString() : null }
}

export async function markRead(me, convId) {
  const conv = await loadConversation(me._id, convId, { populate: false })
  const now = new Date()
  const base = { conversation: conv._id, sender: { $ne: me._id } }
  await Message.updateMany({ ...base, 'deliveredTo.user': { $ne: me._id } }, { $push: { deliveredTo: { user: me._id, at: now } } })
  await Message.updateMany({ ...base, 'readBy.user': { $ne: me._id } }, { $push: { readBy: { user: me._id, at: now } } })
  await Conversation.updateOne({ _id: conv._id, 'participants.user': me._id }, { $set: { 'participants.$.unread': 0 } })
  const others = participantIds(conv).filter((id) => id !== me._id.toString())
  emitToUsers([...others, me._id.toString()], 'conversation:read', { conversationId: conv._id.toString(), userId: me._id.toString(), at: now })
  return {}
}

export async function deleteMessage(me, convId, messageId, scope) {
  const conv = await loadConversation(me._id, convId, { populate: false })
  const msg = await Message.findOne({ _id: messageId, conversation: conv._id })
  if (!msg) throw new ApiError(404, 'Message not found')

  if (scope === 'everyone') {
    if (!msg.sender.equals(me._id)) throw new ApiError(403, 'You can only delete your own messages for everyone')
    if (msg.deletedForEveryone) return {}
    const key = msg.attachment?.key
    msg.deletedForEveryone = true
    msg.text = ''
    msg.attachment = undefined
    await msg.save()
    if (key) await deleteMedia(key).catch(() => {})
    if (conv.lastMessage?.createdAt && conv.lastMessage.createdAt.getTime() === msg.createdAt.getTime()) {
      await Conversation.updateOne({ _id: conv._id }, { $set: { 'lastMessage.text': 'This message was deleted', 'lastMessage.kind': 'text' } })
    }
    emitToUsers(participantIds(conv), 'message:deleted', { conversationId: conv._id.toString(), messageId: msg._id.toString() })
    return {}
  }
  if (scope !== 'me') throw new ApiError(400, 'Validation failed', { errors: { scope: 'Use scope=me or scope=everyone' } })
  await Message.updateOne({ _id: msg._id }, { $addToSet: { deletedFor: me._id } })
  return {}
}

// Messages sent while someone was offline become "delivered" when they reconnect
export async function markDeliveredOnConnect(userId) {
  const convs = await Conversation.find({ 'participants.user': userId }).select('_id').limit(300)
  if (!convs.length) return
  const pending = await Message.find({
    conversation: { $in: convs.map((c) => c._id) }, sender: { $ne: userId }, 'deliveredTo.user': { $ne: userId }, ...live(),
  }).select('_id conversation sender').limit(1000)
  if (!pending.length) return
  await Message.updateMany({ _id: { $in: pending.map((m) => m._id) } }, { $push: { deliveredTo: { user: userId, at: new Date() } } })
  const groups = new Map()
  for (const m of pending) {
    const key = `${m.conversation}:${m.sender}`
    if (!groups.has(key)) groups.set(key, { conversationId: m.conversation.toString(), sender: m.sender.toString(), messageIds: [] })
    groups.get(key).messageIds.push(m._id.toString())
  }
  for (const g of groups.values()) emitToUsers([g.sender], 'message:delivered', { conversationId: g.conversationId, messageIds: g.messageIds, userId: String(userId) })
}

// Expired (disappearing) messages are already hidden by every query; this frees rows and attachments.
export async function cleanupExpiredMessages() {
  let removed = 0
  for (let i = 0; i < 20; i++) {
    const batch = await Message.find({ expiresAt: { $lte: new Date() } }).limit(100).select('_id attachment.key')
    if (!batch.length) break
    await Promise.all(batch.map((m) => deleteMedia(m.attachment?.key).catch(() => {})))
    await Message.deleteMany({ _id: { $in: batch.map((m) => m._id) } })
    removed += batch.length
    if (batch.length < 100) break
  }
  return removed
}
