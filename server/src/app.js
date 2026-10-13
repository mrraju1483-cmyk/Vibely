import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { env, isProd } from './config/env.js'
import authRoutes from './routes/authRoutes.js'
import userRoutes from './routes/userRoutes.js'
import postRoutes from './routes/postRoutes.js'
import commentRoutes from './routes/commentRoutes.js'
import exploreRoutes from './routes/exploreRoutes.js'
import storyRoutes from './routes/storyRoutes.js'
import reelRoutes from './routes/reelRoutes.js'
import chatRoutes from './routes/chatRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import callRoutes from './routes/callRoutes.js'
import aiRoutes from './routes/aiRoutes.js'
import { UPLOAD_DIR } from './services/media/localProvider.js'
import adminRoutes from './routes/adminRoutes.js'
import { apiLimiter, searchLimiter, adminLimiter } from './middleware/rateLimiters.js'
import { sanitizeInput, noStore } from './middleware/sanitizeInput.js'
import { notFound, errorHandler } from './middleware/errorHandler.js'

const app = express()
if (isProd) app.set('trust proxy', 1)
app.use(helmet())
app.use(compression()) // smaller JSON answers
app.use(cors({ origin: env.clientUrl.split(','), methods: ['GET', 'POST', 'PUT', 'DELETE'] }))
app.use('/api/ai', express.json({ limit: '64kb' })) // AI chats are longer than normal requests
app.use(express.json({ limit: '10kb' }))
app.use(sanitizeInput)
app.use('/api', noStore)

// Local development media. In production use MEDIA_PROVIDER=cloudinary (disk is ephemeral on most hosts).
if (env.mediaProvider === 'local') {
  app.use('/uploads', express.static(UPLOAD_DIR, {
    index: false, dotfiles: 'deny', maxAge: '7d',
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin') // frontend runs on another port
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Security-Policy', "default-src 'none'")
    },
  }))
}

app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/users', apiLimiter, userRoutes)
app.use('/api/posts', apiLimiter, postRoutes)
app.use('/api/comments', apiLimiter, commentRoutes)
app.use('/api/explore', searchLimiter, exploreRoutes)
app.use('/api/stories', apiLimiter, storyRoutes)
app.use('/api/reels', apiLimiter, reelRoutes)
app.use('/api/chat', apiLimiter, chatRoutes)
app.use('/api/notifications', apiLimiter, notificationRoutes)
app.use('/api/calls', apiLimiter, callRoutes)
app.use('/api/ai', apiLimiter, aiRoutes)
app.use('/api/admin', adminLimiter, adminRoutes)

app.use(notFound)
app.use(errorHandler)
export default app
