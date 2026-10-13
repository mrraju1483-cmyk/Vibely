import { Router } from 'express'
import * as c from '../controllers/storyController.js'
import { requireAuth } from '../middleware/auth.js'
import { checkId } from '../middleware/validateObjectId.js'
import { createLimiter } from '../middleware/rateLimiters.js'
import { mediaUpload } from '../middleware/mediaUpload.js'

const r = Router()
r.param('id', checkId)
r.use(requireAuth)

r.post('/', createLimiter, mediaUpload.single('media'), c.create)
r.get('/', c.tray)
r.get('/user/:id', c.userStories)
r.post('/:id/view', c.view)
r.get('/:id/viewers', c.viewers)
r.delete('/:id', c.remove)
export default r
