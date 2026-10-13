import { asyncHandler } from '../utils/ApiError.js'
import { send } from '../utils/respond.js'
import { parseCursorPaging } from '../utils/relations.js'
import * as comments from '../services/commentService.js'

export const replies = asyncHandler(async (req, res) => send(res, 200, 'OK', await comments.listReplies(req.user, req.params.id, parseCursorPaging(req.query, 10, 30))))
export const like = asyncHandler(async (req, res) => send(res, 200, 'OK', await comments.likeComment(req.user, req.params.id)))
export const unlike = asyncHandler(async (req, res) => send(res, 200, 'OK', await comments.unlikeComment(req.user, req.params.id)))
export const remove = asyncHandler(async (req, res) => send(res, 200, 'Comment deleted', await comments.deleteComment(req.user, req.params.id)))
