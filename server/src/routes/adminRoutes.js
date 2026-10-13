import { Router } from 'express'
import * as c from '../controllers/adminController.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { checkId } from '../middleware/validateObjectId.js'

// Every admin route needs a valid login AND the admin role (checked against the database, not the token)
const r = Router()
r.param('id', checkId)
r.use(requireAuth, requireAdmin)

r.get('/stats', c.stats)

r.get('/users', c.listUsers)
r.get('/users/:id', c.getUser)
r.put('/users/:id/status', c.setUserStatus)
r.post('/users/:id/remove', c.removeUser)

r.get('/posts', c.listPosts)
r.post('/posts/:id/remove', c.removePost)
r.get('/reels', c.listReels)
r.post('/reels/:id/remove', c.removeReel)
r.get('/comments', c.listComments)
r.post('/comments/:id/remove', c.removeComment)

r.get('/reports', c.listReports)
r.get('/reports/:id', c.getReport)
r.put('/reports/:id', c.updateReport)

r.get('/audit', c.audit)
export default r
