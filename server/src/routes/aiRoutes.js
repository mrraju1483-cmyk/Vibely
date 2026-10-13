import { Router } from 'express'
import * as c from '../controllers/aiController.js'
import { requireAuth } from '../middleware/auth.js'
import { aiLimiter } from '../middleware/rateLimiters.js'

const r = Router()
r.use(requireAuth)
r.get('/status', c.status)
r.post('/chat', aiLimiter, c.chat)
r.post('/captions', aiLimiter, c.captions)
r.post('/smart-replies', aiLimiter, c.smartReplies)
r.post('/safety', aiLimiter, c.safety)
export default r
