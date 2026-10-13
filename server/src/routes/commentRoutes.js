import { Router } from 'express'
import * as c from '../controllers/commentController.js'
import { requireAuth } from '../middleware/auth.js'
import { checkId } from '../middleware/validateObjectId.js'

const r = Router()
r.param('id', checkId)
r.use(requireAuth)
r.get('/:id/replies', c.replies)
r.post('/:id/like', c.like)
r.delete('/:id/like', c.unlike)
r.delete('/:id', c.remove)
export default r
