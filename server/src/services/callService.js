import crypto from 'crypto'
import Call from '../models/Call.js'
import User from '../models/User.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { blockState, blockedIdSet } from '../utils/relations.js'
import { isOnline } from '../socket/presence.js'
import { emitToUsers } from '../socket/emitter.js'
import { assertCanMessage } from './chat/conversationService.js'
import { notify, safe } from './notificationService.js'

const ID = /^[a-f\d]{24}$/i
const RING_MS = 45000 // unanswered calls become "missed" after 45 seconds
const MAX_SIGNAL_BYTES = 16 * 1024

// Live call state (one server process). To scale out, move this to Redis together with the Socket.IO adapter.
const live = new Map() // callId -> { id, caller, receiver, type, status, answeredAt, timer }
const busy = new Map() // userId -> callId

const card = (u) => ({ id: u._id.toString(), fullName: u.fullName, username: u.username, profilePhoto: u.profilePhoto })

async function logMissed(callerId, receiverId, type, reason) {
  const call = await Call.create({ caller: callerId, receiver: receiverId, type, status: 'missed', endedAt: new Date(), endReason: reason })
  safe(notify({ recipient: receiverId, actor: callerId, type: 'missed_call', call: call._id, text: type }))
}

export async function startCall(callerId, { receiverId, type } = {}) {
  if (typeof receiverId !== 'string' || !ID.test(receiverId) || !['voice', 'video'].includes(type)) throw new ApiError(400, 'Invalid call request')
  if (receiverId === callerId) throw new ApiError(400, 'You cannot call yourself')
  const [caller, receiver] = await Promise.all([User.findById(callerId), User.findOne({ _id: receiverId, isActive: true })])
  if (!caller || !caller.isActive || !receiver) throw new ApiError(404, 'User not found')
  const bs = await blockState(callerId, receiverId)
  if (bs.byMe || bs.byThem) throw new ApiError(403, 'You cannot call this user')
  await assertCanMessage(caller, receiver) // same privacy rule as messages

  if (busy.has(callerId)) throw new ApiError(409, 'You are already in a call')
  if (busy.has(receiverId)) { await logMissed(callerId, receiverId, type, 'busy'); throw new ApiError(409, 'This person is on another call') }
  if (!isOnline(receiverId)) { await logMissed(callerId, receiverId, type, 'offline'); throw new ApiError(409, 'This person is not available right now') }

  const call = await Call.create({ caller: callerId, receiver: receiverId, type })
  const id = call._id.toString()
  const state = { id, caller: callerId, receiver: receiverId, type, status: 'ringing', answeredAt: null, timer: null }
  state.timer = setTimeout(() => finish(id, 'missed', 'timeout').catch(() => {}), RING_MS)
  live.set(id, state)
  busy.set(callerId, id); busy.set(receiverId, id)
  emitToUsers([receiverId], 'call:incoming', { call: { id, type, caller: card(caller) } })
  return { callId: id }
}

async function finish(id, status, reason) {
  const st = live.get(id)
  if (!st) return null
  live.delete(id); busy.delete(st.caller); busy.delete(st.receiver); clearTimeout(st.timer)
  const endedAt = new Date()
  const duration = st.answeredAt ? Math.round((endedAt - st.answeredAt) / 1000) : 0
  await Call.updateOne({ _id: id }, { status, endedAt, duration, endReason: reason }).catch(() => {})
  const payload = { callId: id, status, reason, duration }
  emitToUsers([st.caller, st.receiver], 'call:ended', payload)
  if (status === 'missed' || status === 'canceled') safe(notify({ recipient: st.receiver, actor: st.caller, type: 'missed_call', call: id, text: st.type }))
  return payload
}

function ownCall(userId, callId, role) {
  const st = typeof callId === 'string' ? live.get(callId) : null
  if (!st || (role === 'receiver' ? st.receiver !== userId : role === 'caller' ? st.caller !== userId : st.caller !== userId && st.receiver !== userId)) throw new ApiError(404, 'Call not found')
  return st
}

export async function acceptCall(userId, { callId } = {}) {
  const st = ownCall(userId, callId, 'receiver')
  if (st.status !== 'ringing') throw new ApiError(409, 'This call is no longer ringing')
  clearTimeout(st.timer)
  st.status = 'accepted'; st.answeredAt = new Date()
  await Call.updateOne({ _id: st.id }, { status: 'accepted', startedAt: st.answeredAt })
  emitToUsers([st.caller, st.receiver], 'call:accepted', { callId: st.id })
  return {}
}

export async function rejectCall(userId, { callId } = {}) {
  const st = ownCall(userId, callId, 'receiver')
  if (st.status !== 'ringing') throw new ApiError(409, 'This call is no longer ringing')
  await finish(st.id, 'rejected', 'declined')
  return {}
}

export async function cancelCall(userId, { callId } = {}) {
  const st = ownCall(userId, callId, 'caller')
  if (st.status !== 'ringing') throw new ApiError(409, 'This call was already answered')
  await finish(st.id, 'canceled', 'canceled')
  return {}
}

// "Hang up" from either side, whatever the state
export async function endCall(userId, { callId } = {}) {
  const st = ownCall(userId, callId)
  if (st.status === 'accepted') await finish(st.id, 'completed', 'ended')
  else if (st.caller === userId) await finish(st.id, 'canceled', 'canceled')
  else await finish(st.id, 'rejected', 'declined')
  return {}
}

// WebRTC offer / answer / ICE candidates are only relayed between the two people in an answered call
export function relaySignal(userId, { callId, data } = {}) {
  const st = ownCall(userId, callId)
  if (st.status !== 'accepted') throw new ApiError(409, 'Call is not active')
  if (!data || typeof data !== 'object' || !['offer', 'answer', 'candidate'].includes(data.type)) throw new ApiError(400, 'Invalid signal')
  if (JSON.stringify(data).length > MAX_SIGNAL_BYTES) throw new ApiError(400, 'Signal too large')
  emitToUsers([st.caller === userId ? st.receiver : st.caller], 'call:signal', { callId, data })
  return {}
}

// Called when a user's last connection closes
export async function handleDisconnect(userId) {
  const id = busy.get(userId)
  const st = id && live.get(id)
  if (!st) return
  if (st.status === 'accepted') await finish(id, 'completed', 'disconnected')
  else if (st.caller === userId) await finish(id, 'canceled', 'disconnected')
  else await finish(id, 'missed', 'disconnected')
}

// After a server restart nothing is really ringing or connected any more
export async function recoverStaleCalls() {
  const now = new Date()
  await Call.updateMany({ status: 'ringing' }, { status: 'missed', endedAt: now, endReason: 'server_restart' })
  await Call.updateMany({ status: 'accepted' }, { status: 'completed', endedAt: now, endReason: 'server_restart' })
}

// STUN is public. TURN credentials are minted per request (valid 1 hour) from a secret that never leaves the server.
export function getIceConfig(userId) {
  const iceServers = [{ urls: env.stunUrls }]
  if (env.turnUrl && env.turnSecret) {
    const username = `${Math.floor(Date.now() / 1000) + 3600}:${userId}`
    iceServers.push({ urls: env.turnUrl.split(',').map((s) => s.trim()), username, credential: crypto.createHmac('sha1', env.turnSecret).update(username).digest('base64') })
  }
  return { iceServers }
}

export async function listCalls(user, { cursor, limit }) {
  const query = { $or: [{ caller: user._id }, { receiver: user._id }] }
  if (cursor) query._id = { $lt: cursor }
  const rows = await Call.find(query).sort({ _id: -1 }).limit(limit + 1).populate('caller receiver', 'fullName username profilePhoto isActive')
  const hasMore = rows.length > limit
  const slice = rows.slice(0, limit)
  const hidden = await blockedIdSet(user._id)
  const calls = slice.filter((c) => c.caller && c.receiver).map((c) => {
    const outgoing = c.caller._id.equals(user._id)
    const other = outgoing ? c.receiver : c.caller
    return { id: c._id.toString(), type: c.type, status: c.status, direction: outgoing ? 'outgoing' : 'incoming', other: card(other), otherActive: other.isActive,
      startedAt: c.startedAt, endedAt: c.endedAt, duration: c.duration, createdAt: c.createdAt }
  }).filter((c) => !hidden.has(c.other.id))
  return { calls, nextCursor: hasMore ? slice[slice.length - 1]._id.toString() : null }
}
