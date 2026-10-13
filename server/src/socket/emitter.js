// Lets services push events without importing the socket server (avoids circular imports)
let io = null
export const setIo = (instance) => { io = instance }
export const getIo = () => io
export function emitToUsers(userIds, event, payload) {
  if (!io) return
  for (const id of new Set(userIds.map(String))) io.to(`user:${id}`).emit(event, payload)
}
