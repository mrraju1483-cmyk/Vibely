import { Router } from 'express'
import * as c from '../controllers/userController.js'
import { requireAuth } from '../middleware/auth.js'
import { createLimiter } from '../middleware/rateLimiters.js'
import { checkId } from '../middleware/validateObjectId.js'

const r = Router()
r.param('id', checkId) // every :id is validated as a MongoDB ObjectId
r.use(requireAuth)

// Fixed paths first, then /:id routes
r.get('/me', c.getMe)
r.get('/search', c.search)
r.get('/blocked', c.blocked)
r.get('/follow-requests', c.requests)
r.put('/profile', c.updateProfile) // always edits the logged-in user, never another
r.put('/privacy', c.setPrivacy)
r.put('/story-privacy', c.setStoryPrivacy)
r.put('/chat-privacy', c.setChatPrivacy)
r.post('/follow-requests/:id/accept', c.acceptRequest)
r.delete('/follow-requests/:id', c.rejectRequest)

r.get('/:id', c.getProfile)
r.post('/:id/follow', c.follow)
r.delete('/:id/follow', c.unfollow)
r.get('/:id/followers', c.followers)
r.get('/:id/following', c.following)
r.post('/:id/report', createLimiter, c.reportUser)
r.post('/:id/block', c.block)
r.delete('/:id/block', c.unblock)
export default r
