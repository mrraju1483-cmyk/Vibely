// In-memory presence (one server process). To run several instances, replace with the Socket.IO Redis adapter + a shared store.
const online = new Map() // userId -> Set(socketId)

export function addSocket(userId, socketId) {
  let set = online.get(userId)
  const first = !set
  if (!set) { set = new Set(); online.set(userId, set) }
  set.add(socketId)
  return first // true when this is the user's first open connection
}

export function removeSocket(userId, socketId) {
  const set = online.get(userId)
  if (!set) return false
  set.delete(socketId)
  if (set.size === 0) { online.delete(userId); return true } // true when that was the last connection
  return false
}

export const isOnline = (userId) => online.has(String(userId))
