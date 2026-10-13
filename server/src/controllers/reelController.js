import { asyncHandler } from '../utils/ApiError.js'
import { send } from '../utils/respond.js'
import { parseCursorPaging } from '../utils/relations.js'
import * as reels from '../services/reelService.js'
import * as comments from '../services/reelCommentService.js'
import * as reports from '../services/reportService.js'

export const create = asyncHandler(async (req, res) => send(res, 201, 'Reel posted', { reel: await reels.createReel(req.user, req.file, req.body) }))
export const feed = asyncHandler(async (req, res) => send(res, 200, 'OK', await reels.getFeed(req.user, parseCursorPaging(req.query, 5, 15))))
export const userReels = asyncHandler(async (req, res) => send(res, 200, 'OK', await reels.getUserReels(req.user, req.params.id, parseCursorPaging(req.query, 12))))
export const saved = asyncHandler(async (req, res) => send(res, 200, 'OK', await reels.listSaved(req.user, parseCursorPaging(req.query, 12))))
export const getOne = asyncHandler(async (req, res) => send(res, 200, 'OK', { reel: await reels.getReel(req.user, req.params.id) }))
export const remove = asyncHandler(async (req, res) => { await reels.deleteReel(req.user, req.params.id); send(res, 200, 'Reel deleted') })
export const like = asyncHandler(async (req, res) => send(res, 200, 'OK', await reels.likeReel(req.user, req.params.id)))
export const unlike = asyncHandler(async (req, res) => send(res, 200, 'OK', await reels.unlikeReel(req.user, req.params.id)))
export const save = asyncHandler(async (req, res) => send(res, 200, 'OK', await reels.saveReel(req.user, req.params.id)))
export const unsave = asyncHandler(async (req, res) => send(res, 200, 'OK', await reels.unsaveReel(req.user, req.params.id)))
export const share = asyncHandler(async (req, res) => send(res, 200, 'OK', await reels.shareReel(req.user, req.params.id)))
export const view = asyncHandler(async (req, res) => send(res, 200, 'OK', await reels.viewReel(req.user, req.params.id)))
export const report = asyncHandler(async (req, res) => { await reports.reportReel(req.user, req.params.id, req.body); send(res, 201, 'Report submitted. Thank you.') })
export const addComment = asyncHandler(async (req, res) => send(res, 201, 'Comment added', { comment: await comments.addComment(req.user, req.params.id, req.body) }))
export const listComments = asyncHandler(async (req, res) => send(res, 200, 'OK', await comments.listComments(req.user, req.params.id, parseCursorPaging(req.query, 10, 30))))
export const removeComment = asyncHandler(async (req, res) => { await comments.deleteComment(req.user, req.params.id); send(res, 200, 'Comment deleted') })
