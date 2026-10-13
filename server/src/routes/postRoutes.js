import { Router } from 'express'
import * as c from '../controllers/postController.js'
import { requireAuth } from '../middleware/auth.js'
import { checkId } from '../middleware/validateObjectId.js'
import { createLimiter } from '../middleware/rateLimiters.js'

import { mediaUpload as upload } from '../middleware/mediaUpload.js'

const r = Router()
r.param('id', checkId)
r.use(requireAuth)

r.post('/', createLimiter, upload.single('media'), c.create)
r.get('/feed', c.feed)
r.get('/saved', c.saved)
r.get('/user/:id', c.userPosts)

r.get('/:id', c.getOne)
r.delete('/:id', c.remove)
r.post('/:id/like', c.like)
r.delete('/:id/like', c.unlike)
r.post('/:id/comment', createLimiter, c.addComment)
r.get('/:id/comments', c.listComments)
r.post('/:id/save', c.save)
r.delete('/:id/save', c.unsave)
r.post('/:id/share', c.share)
r.post('/:id/report', createLimiter, c.report)
export default r
