import { Router } from 'express'
import * as c from '../controllers/notificationController.js'
import { requireAuth } from '../middleware/auth.js'
import { checkId } from '../middleware/validateObjectId.js'

const r = Router()
r.param('id', checkId)
r.use(requireAuth)

r.get('/', c.list)
r.get('/unread-count', c.unread)
r.put('/read-all', c.readAll)
r.put('/:id/read', c.read)
export default r
