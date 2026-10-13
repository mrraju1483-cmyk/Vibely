import Conversation from '../../models/Conversation.js'
import { ApiError } from '../../utils/ApiError.js'
import { isOnline } from '../../socket/presence.js'
import { emitToUsers } from '../../socket/emitter.js'
import { authorDto, AUTHOR_FIELDS } from '../postService.js'

export const USER_FIELDS = `${AUTHOR_FIELDS} showOnlineStatus showLastSeen lastSeenAt`
export const MAX_GROUP_MEMBERS = 50
// Matches messages with no expiry or an expiry in the future (expired messages are never served)
export const live = () => ({ expiresAt: { $not: { $lte: new Date() } } })

export function presenceOf(user) {
  if (!user.showOnlineStatus) return { online: false, lastSeenAt: null } // hidden by the user's own privacy setting
  const online = isOnline(user._id)
  return { online, lastSeenAt: !online && user.showLastSeen ? user.lastSeenAt || null : null }
}

export function conversationDto(conv, viewerId) {
  const parts = conv.participants.filter((p) => p.user)
  const mine = parts.find((p) => p.user._id.equals(viewerId))
  const lm = conv.lastMessage
  const lastMessage = lm?.createdAt && !(lm.expiresAt && lm.expiresAt <= new Date())
    ? { senderId: lm.sender?.toString(), text: lm.text, kind: lm.kind, createdAt: lm.createdAt } : null
  const dto = {
    id: conv._id.toString(), type: conv.type, name: conv.name, photo: conv.photo, disappearAfter: conv.disappearAfter,
    lastMessage, lastMessageAt: conv.lastMessageAt, unread: mine?.unread || 0, isAdmin: mine?.role === 'admin',
    participants: parts.map((p) => ({ user: authorDto(p.user), role: p.role })),
  }
  if (conv.type === 'direct') {
    const other = parts.find((p) => !p.user._id.equals(viewerId))
    if (other) dto.other = { user: authorDto(other.user), ...presenceOf(other.user) }
  }
  return dto
}

// Loads a conversation only if the user is a member (non-members get 404)
export async function loadConversation(userId, id, { populate = true } = {}) {
  const q = Conversation.findOne({ _id: id, 'participants.user': userId })
  const conv = await (populate ? q.populate('participants.user', USER_FIELDS) : q)
  if (!conv) throw new ApiError(404, 'Conversation not found')
  return conv
}

export const participantIds = (conv) => conv.participants.map((p) => (p.user._id || p.user).toString())

// Push each member their own view of the conversation (unread counts differ per person)
export async function broadcastConversation(conv) {
  const full = conv.populated?.('participants.user') ? conv : await conv.populate('participants.user', USER_FIELDS)
  for (const id of participantIds(full)) emitToUsers([id], 'conversation:updated', conversationDto(full, id))
}
