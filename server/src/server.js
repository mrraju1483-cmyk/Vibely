import { env } from './config/env.js'
import { connectDB } from './config/db.js'
import app from './app.js'
import { initSocket } from './socket/index.js'
import { cleanupExpiredStories } from './services/storyService.js'
import { cleanupExpiredMessages } from './services/chat/messageService.js'
import { recoverStaleCalls } from './services/callService.js'

await connectDB()
await recoverStaleCalls() // calls cut off by a restart must not stay 'ringing' forever
const server = app.listen(env.port, () => console.log(`Vibely API running on http://localhost:${env.port}`))
const io = initSocket(server) // Socket.IO shares the same port and the same JWT auth

// Expired stories and disappearing messages are already hidden by every query; this sweep also frees rows and media files
const sweep = () => {
  cleanupExpiredStories().catch((e) => console.error('Story cleanup failed:', e.message))
  cleanupExpiredMessages().catch((e) => console.error('Message cleanup failed:', e.message))
}
sweep()
setInterval(sweep, 10 * 60 * 1000).unref()

const shutdown = () => { io.close(); server.close(() => process.exit(0)) }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
