import { asyncHandler } from '../utils/ApiError.js'
import { send } from '../utils/respond.js'
import { parseCursorPaging } from '../utils/relations.js'
import * as posts from '../services/postService.js'
import * as comments from '../services/commentService.js'
import * as reports from '../services/reportService.js'

export const create = asyncHandler(async (req, res) => send(res, 201, 'Post created', { post: await posts.createPost(req.user, req.file, req.body) }))
export const feed = asyncHandler(async (req, res) => send(res, 200, 'OK', await posts.getFeed(req.user, parseCursorPaging(req.query))))
export const saved = asyncHandler(async (req, res) => send(res, 200, 'OK', await posts.listSaved(req.user, parseCursorPaging(req.query))))
export const userPosts = asyncHandler(async (req, res) => send(res, 200, 'OK', await posts.getUserPosts(req.user, req.params.id, parseCursorPaging(req.query, 12))))
export const getOne = asyncHandler(async (req, res) => send(res, 200, 'OK', { post: await posts.getPost(req.user, req.params.id) }))
export const remove = asyncHandler(async (req, res) => { await posts.deletePost(req.user, req.params.id); send(res, 200, 'Post deleted') })
export const like = asyncHandler(async (req, res) => send(res, 200, 'OK', await posts.likePost(req.user, req.params.id)))
export const unlike = asyncHandler(async (req, res) => send(res, 200, 'OK', await posts.unlikePost(req.user, req.params.id)))
export const save = asyncHandler(async (req, res) => send(res, 200, 'OK', await posts.savePost(req.user, req.params.id)))
export const unsave = asyncHandler(async (req, res) => send(res, 200, 'OK', await posts.unsavePost(req.user, req.params.id)))
export const share = asyncHandler(async (req, res) => send(res, 200, 'OK', await posts.sharePost(req.user, req.params.id)))
export const report = asyncHandler(async (req, res) => { await reports.reportPost(req.user, req.params.id, req.body); send(res, 201, 'Report submitted. Thank you.') })
export const addComment = asyncHandler(async (req, res) => send(res, 201, 'Comment added', { comment: await comments.addComment(req.user, req.params.id, req.body) }))
export const listComments = asyncHandler(async (req, res) => send(res, 200, 'OK', await comments.listComments(req.user, req.params.id, parseCursorPaging(req.query, 10, 30))))
