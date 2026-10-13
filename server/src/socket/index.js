import { Server } from 'socket.io'
import { env } from '../config/env.js'
import User from '../models/User.js'
import Conversation from '../models/Conversation.js'
import { verifyToken, tokenIsStale } from '../services/tokenService.js'
import { blockedIdSet } from '../utils/relations.js'
import { setIo, emitToUsers } from './emitter.js'
import { addSocket, removeSocket } from './presence.js'
import { markDeliveredOnConnect } from '../services/chat/messageService.js'
import { registerCallHandlers } from './callHandlers.js'
import { handleDisconnect } from '../services/callService.js'

const ID = /^[a-f\d]{24}$/i

// People who share a conversation with this user (and are not blocked either way)
async function partnerIds(userId) {
  const convs = await Conversation.find({ 'participants.user': userId }).select('participants.user').limit(300)
  const ids = new Set(convs.flatMap((c) => c.participants.map((p) => p.user.toString())))
  ids.delete(userId)
  const hidden = await blockedIdSet(userId)
  return [...ids].filter((id) => !hidden.has(id))
}

async function announce(userId, online) {
  try {
    const u = await User.findById(userId).select('showOnlineStatus showLastSeen lastSeenAt')
    if (!u || !u.showOnlineStatus) return // the user chose to hide their status
    emitToUsers(await partnerIds(userId), 'presence', { userId, online, lastSeenAt: !online && u.showLastSeen ? u.lastSeenAt : null })
  } catch (e) { console.error('Presence broadcast failed:', e.message) }
}

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientUrl.split(','), methods: ['GET', 'POST'] },
    maxHttpBufferSize: 1e5, // 100 KB: sockets carry only small events, uploads go through the REST API
  })
  setIo(io)

  // Every connection must present a valid JWT (the same one the REST API uses)
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      if (typeof token !== 'string' || !token) throw new Error('no token')
      const payload = verifyToken(token)
      const user = await User.findById(payload.sub).select('isActive passwordChangedAt')
      if (!user || !user.isActive || tokenIsStale(payload, user)) throw new Error('inactive')
      socket.data.userId = user._id.toString()
      next()
    } catch {
      next(new Error('unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.data.userId
    socket.join(`user:${userId}`)
    if (addSocket(userId, socket.id)) announce(userId, true)
    markDeliveredOnConnect(userId).catch((e) => console.error('Delivery sync failed:', e.message))

    // Flood protection: at most 60 events per 10 seconds per connection
    let windowStart = Date.now(), seen = 0
    socket.use((packet, next) => {
      if (Date.now() - windowStart > 10000) { windowStart = Date.now(); seen = 0 }
      next(++seen > 60 ? new Error('rate limited') : undefined)
    })

    registerCallHandlers(socket)

    let tokens = 10
    let last = Date.now()
    socket.on('typing', async (data) => {
      try {
        const now = Date.now()
        tokens = Math.min(10, tokens + (now - last) / 500) // simple rate limit: about 2 events per second
        last = now
        if (tokens < 1) return
        tokens -= 1
        if (!data || typeof data.conversationId !== 'string' || !ID.test(data.conversationId)) return
        const conv = await Conversation.findOne({ _id: data.conversationId, 'participants.user': userId }).select('participants.user')
        if (!conv) return // not a member: ignore silently
        const hidden = await blockedIdSet(userId)
        const to = conv.participants.map((p) => p.user.toString()).filter((id) => id !== userId && !hidden.has(id))
        emitToUsers(to, 'typing', { conversationId: data.conversationId, userId, isTyping: !!data.isTyping })
      } catch { /* ignore malformed events */ }
    })

    socket.on('disconnect', async () => {
      if (removeSocket(userId, socket.id)) {
        handleDisconnect(userId).catch(() => {}) // last tab closed: end any call in progress
        await User.updateOne({ _id: userId }, { lastSeenAt: new Date() }).catch(() => {})
        announce(userId, false)
      }
    })
  })
  return io
}
