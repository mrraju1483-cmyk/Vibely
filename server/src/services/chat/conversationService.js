import Conversation from '../../models/Conversation.js'
import Message from '../../models/Message.js'
import User from '../../models/User.js'
import Follow from '../../models/Follow.js'
import { ApiError } from '../../utils/ApiError.js'
import { blockState, blockedIdSet } from '../../utils/relations.js'
import { validateUpload } from '../media/validate.js'
import { uploadMedia, deleteMedia } from '../media/index.js'
import { emitToUsers } from '../../socket/emitter.js'
import { validateGroupName, validateUserId, validateUserIds, validateDisappear } from '../../validators/chatValidators.js'
import { USER_FIELDS, MAX_GROUP_MEMBERS, conversationDto, loadConversation, participantIds, broadcastConversation } from './shared.js'

// "Only people I follow can message me": the recipient must follow the sender
export async function assertCanMessage(sender, recipient) {
  if (recipient.messagePrivacy !== 'following') return
  const ok = await Follow.exists({ follower: recipient._id, following: sender._id, status: 'accepted' })
  if (!ok) throw new ApiError(403, 'This person only accepts messages from people they follow')
}

export async function listConversations(me, q) {
  const hidden = await blockedIdSet(me._id)
  const convs = await Conversation.find({
    'participants.user': me._id,
    $or: [{ type: 'group' }, { 'lastMessage.createdAt': { $ne: null } }, { createdBy: me._id }], // empty chats started by someone else stay hidden
  }).sort({ lastMessageAt: -1 }).limit(100).populate('participants.user', USER_FIELDS)

  let list = convs.filter((c) => c.type === 'group' || !c.participants.some((p) => p.user && hidden.has(p.user._id.toString())))
  const term = typeof q === 'string' ? q.trim().toLowerCase().slice(0, 50) : ''
  if (term) {
    list = list.filter((c) => c.name.toLowerCase().includes(term) || c.participants.some((p) => p.user && !p.user._id.equals(me._id) &&
      (p.user.fullName.toLowerCase().includes(term) || p.user.username.includes(term))))
  }
  const conversations = list.map((c) => conversationDto(c, me._id))
  return { conversations, totalUnread: conversations.reduce((n, c) => n + c.unread, 0) }
}

export async function getConversation(me, id) {
  return { conversation: conversationDto(await loadConversation(me._id, id), me._id) }
}

export async function getOrCreateDirect(me, rawUserId) {
  const otherId = validateUserId(rawUserId)
  if (me._id.equals(otherId)) throw new ApiError(400, 'You cannot message yourself')
  const other = await User.findOne({ _id: otherId, isActive: true })
  if (!other) throw new ApiError(404, 'User not found')
  const bs = await blockState(me._id, other._id)
  if (bs.byThem) throw new ApiError(404, 'User not found')
  if (bs.byMe) throw new ApiError(403, 'Unblock this user to message them')
  await assertCanMessage(me, other)

  const directKey = [me._id.toString(), other._id.toString()].sort().join(':')
  let conv = await Conversation.findOne({ directKey })
  let created = false
  if (!conv) {
    try {
      conv = await Conversation.create({ type: 'direct', directKey, createdBy: me._id, participants: [{ user: me._id }, { user: other._id }] })
      created = true
    } catch (e) {
      if (e.code !== 11000) throw e
      conv = await Conversation.findOne({ directKey }) // lost a race: reuse the one that won
    }
  }
  await conv.populate('participants.user', USER_FIELDS)
  return { conversation: conversationDto(conv, me._id), created }
}

export async function createGroup(me, body = {}) {
  const name = validateGroupName(body.name)
  const memberIds = validateUserIds(body.memberIds).filter((id) => id !== me._id.toString())
  if (!memberIds.length) throw new ApiError(400, 'Validation failed', { errors: { memberIds: 'Choose at least one other person' } })
  const users = await User.find({ _id: { $in: memberIds }, isActive: true }).select('_id username')
  if (users.length !== memberIds.length) throw new ApiError(404, 'One or more people were not found')
  const hidden = await blockedIdSet(me._id)
  const blocked = users.filter((u) => hidden.has(u._id.toString()))
  if (blocked.length) throw new ApiError(400, 'Validation failed', { errors: { memberIds: `You cannot add: ${blocked.map((u) => '@' + u.username).join(', ')}` } })

  const conv = await Conversation.create({
    type: 'group', name, createdBy: me._id,
    participants: [{ user: me._id, role: 'admin' }, ...users.map((u) => ({ user: u._id }))],
  })
  await broadcastConversation(conv)
  await conv.populate('participants.user', USER_FIELDS)
  return { conversation: conversationDto(conv, me._id) }
}

async function loadGroupAsAdmin(me, id) {
  const conv = await loadConversation(me._id, id)
  if (conv.type !== 'group') throw new ApiError(400, 'This action is only for group chats')
  const mine = conv.participants.find((p) => p.user._id.equals(me._id))
  if (mine.role !== 'admin') throw new ApiError(403, 'Only group admins can do this')
  return conv
}

export async function renameGroup(me, id, body = {}) {
  const conv = await loadGroupAsAdmin(me, id)
  conv.name = validateGroupName(body.name)
  await conv.save()
  await broadcastConversation(conv)
  return { conversation: conversationDto(conv, me._id) }
}

export async function setGroupPhoto(me, id, file) {
  const conv = await loadGroupAsAdmin(me, id)
  const info = validateUpload(file)
  if (info.mediaType !== 'image') throw new ApiError(400, 'Validation failed', { errors: { media: 'The group photo must be an image' } })
  const stored = await uploadMedia(file, info)
  const old = conv.photoKey
  conv.photo = stored.url
  conv.photoKey = stored.key
  await conv.save()
  await deleteMedia(old).catch(() => {})
  await broadcastConversation(conv)
  return { conversation: conversationDto(conv, me._id) }
}

export async function addMembers(me, id, body = {}) {
  const conv = await loadGroupAsAdmin(me, id)
  const ids = validateUserIds(body.userIds, { max: MAX_GROUP_MEMBERS })
  const existing = new Set(participantIds(conv))
  const fresh = ids.filter((x) => !existing.has(x))
  if (!fresh.length) throw new ApiError(409, 'Those people are already in the group')
  if (existing.size + fresh.length > MAX_GROUP_MEMBERS) throw new ApiError(400, `Groups can have at most ${MAX_GROUP_MEMBERS} members`)
  const users = await User.find({ _id: { $in: fresh }, isActive: true }).select('_id username')
  if (users.length !== fresh.length) throw new ApiError(404, 'One or more people were not found')
  const hidden = await blockedIdSet(me._id)
  const blocked = users.filter((u) => hidden.has(u._id.toString()))
  if (blocked.length) throw new ApiError(400, 'Validation failed', { errors: { userIds: `You cannot add: ${blocked.map((u) => '@' + u.username).join(', ')}` } })

  const now = new Date()
  const updated = await Conversation.findByIdAndUpdate(conv._id, { $push: { participants: { $each: users.map((u) => ({ user: u._id, joinedAt: now })) } } }, { new: true })
  await broadcastConversation(updated)
  await updated.populate('participants.user', USER_FIELDS)
  return { conversation: conversationDto(updated, me._id) }
}

// userId === me: leave the group. Otherwise an admin removes that member.
export async function removeMember(me, id, userId) {
  const conv = await loadConversation(me._id, id)
  if (conv.type !== 'group') throw new ApiError(400, 'This action is only for group chats')
  const leaving = me._id.equals(userId)
  const mine = conv.participants.find((p) => p.user._id.equals(me._id))
  if (!leaving && mine.role !== 'admin') throw new ApiError(403, 'Only group admins can remove members')
  const target = conv.participants.find((p) => p.user._id.equals(userId))
  if (!target) throw new ApiError(404, 'That person is not in this group')

  let remaining = conv.participants.filter((p) => !p.user._id.equals(userId))
  if (!remaining.length) { // last person left: delete the group and its messages
    const msgs = await Message.find({ conversation: conv._id, 'attachment.key': { $exists: true } }).select('attachment.key')
    await Promise.all(msgs.map((m) => deleteMedia(m.attachment.key).catch(() => {})))
    await Message.deleteMany({ conversation: conv._id })
    await deleteMedia(conv.photoKey).catch(() => {})
    await Conversation.deleteOne({ _id: conv._id })
    emitToUsers([userId], 'conversation:removed', { id: conv._id.toString() })
    return {}
  }
  if (target.role === 'admin' && !remaining.some((p) => p.role === 'admin')) {
    remaining = remaining.map((p, i) => (i === 0 ? Object.assign(p, { role: 'admin' }) : p)) // keep at least one admin
  }
  const updated = await Conversation.findByIdAndUpdate(conv._id, { participants: remaining.map((p) => ({ user: p.user._id, role: p.role, unread: p.unread, joinedAt: p.joinedAt })) }, { new: true })
  emitToUsers([userId], 'conversation:removed', { id: conv._id.toString() })
  await broadcastConversation(updated)
  return {}
}

export async function setDisappear(me, id, body = {}) {
  const seconds = validateDisappear(body.disappearAfter)
  const conv = await loadConversation(me._id, id)
  if (conv.type === 'group' && conv.participants.find((p) => p.user._id.equals(me._id)).role !== 'admin') throw new ApiError(403, 'Only group admins can change this')
  conv.disappearAfter = seconds
  await conv.save()
  await broadcastConversation(conv)
  return { conversation: conversationDto(conv, me._id) }
}
