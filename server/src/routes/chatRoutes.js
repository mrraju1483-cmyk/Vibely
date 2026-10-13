import { Router } from 'express'
import * as c from '../controllers/chatController.js'
import { requireAuth } from '../middleware/auth.js'
import { checkId } from '../middleware/validateObjectId.js'
import { createLimiter, messageLimiter } from '../middleware/rateLimiters.js'
import { mediaUpload } from '../middleware/mediaUpload.js'

const r = Router()
r.param('id', checkId)
r.param('messageId', checkId)
r.param('userId', checkId)
r.use(requireAuth)

r.get('/conversations', c.list)
r.post('/conversations/direct', c.direct)
r.post('/conversations/group', createLimiter, c.createGroup)
r.get('/conversations/:id', c.getOne)
r.put('/conversations/:id', c.update)
r.put('/conversations/:id/photo', createLimiter, mediaUpload.single('media'), c.updatePhoto)
r.put('/conversations/:id/settings', c.settings)
r.post('/conversations/:id/members', c.addMembers)
r.delete('/conversations/:id/members/:userId', c.removeMember)
r.get('/conversations/:id/messages', c.messages)
r.post('/conversations/:id/messages', messageLimiter, mediaUpload.single('media'), c.sendMessage)
r.post('/conversations/:id/read', c.read)
r.delete('/conversations/:id/messages/:messageId', c.deleteMessage)
export default r
