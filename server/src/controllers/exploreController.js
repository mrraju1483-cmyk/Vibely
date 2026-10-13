import { asyncHandler } from '../utils/ApiError.js'
import { send } from '../utils/respond.js'
import { parseCursorPaging } from '../utils/relations.js'
import * as explore from '../services/exploreService.js'

const pageParams = (q, def = 12, max = 30) => {
  const page = Math.min(Math.max(parseInt(q.page, 10) || 1, 1), 100)
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || def, 1), max)
  return { page, limit, skip: (page - 1) * limit }
}

export const trendingPosts = asyncHandler(async (req, res) => send(res, 200, 'OK', await explore.trendingPosts(req.user, pageParams(req.query))))
export const recentPosts = asyncHandler(async (req, res) => send(res, 200, 'OK', await explore.recentPosts(req.user, parseCursorPaging(req.query, 12))))
export const popularUsers = asyncHandler(async (req, res) => send(res, 200, 'OK', await explore.popularUsers(req.user)))
export const recommendedUsers = asyncHandler(async (req, res) => send(res, 200, 'OK', await explore.recommendedUsers(req.user)))
export const trendingHashtags = asyncHandler(async (req, res) => send(res, 200, 'OK', await explore.trendingHashtags()))
export const searchHashtags = asyncHandler(async (req, res) => send(res, 200, 'OK', await explore.searchHashtags(req.query.q)))
export const hashtagPosts = asyncHandler(async (req, res) => send(res, 200, 'OK', await explore.hashtagPosts(req.user, req.params.name, parseCursorPaging(req.query, 12))))
export const search = asyncHandler(async (req, res) => {
  const type = typeof req.query.type === 'string' ? req.query.type : 'users'
  send(res, 200, 'OK', await explore.searchAll(req.user, type, req.query.q, pageParams(req.query, type === 'users' ? 20 : 12, type === 'users' ? 50 : 30)))
})
