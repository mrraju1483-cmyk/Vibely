import { asyncHandler } from '../utils/ApiError.js'
import { send } from '../utils/respond.js'
import { parseCursorPaging } from '../utils/relations.js'
import * as calls from '../services/callService.js'

export const config = asyncHandler(async (req, res) => send(res, 200, 'OK', calls.getIceConfig(req.user._id.toString())))
export const history = asyncHandler(async (req, res) => send(res, 200, 'OK', await calls.listCalls(req.user, parseCursorPaging(req.query, 20, 50))))
