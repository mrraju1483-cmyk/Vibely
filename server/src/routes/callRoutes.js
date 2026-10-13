import { Router } from 'express'
import * as c from '../controllers/callController.js'
import { requireAuth } from '../middleware/auth.js'

// Starting, answering and signalling calls happens over Socket.IO (see socket/callHandlers.js). REST only serves config and history.
const r = Router()
r.use(requireAuth)
r.get('/config', c.config)
r.get('/', c.history)
export default r
