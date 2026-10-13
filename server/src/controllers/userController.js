import { asyncHandler } from '../utils/ApiError.js'
import { send } from '../utils/respond.js'
import { parsePaging } from '../utils/relations.js'
import * as users from '../services/userService.js'
import * as follows from '../services/followService.js'
import * as reports from '../services/reportService.js'
import * as blocks from '../services/blockService.js'

export const getMe = asyncHandler(async (req, res) => send(res, 200, 'OK', { user: req.user.toSafeJSON() }))
export const getProfile = asyncHandler(async (req, res) => send(res, 200, 'OK', { profile: await users.getProfile(req.user, req.params.id) }))
export const updateProfile = asyncHandler(async (req, res) => send(res, 200, 'Profile updated', { user: await users.updateProfile(req.user, req.body) }))
export const setPrivacy = asyncHandler(async (req, res) => send(res, 200, 'Privacy updated', { user: await users.setPrivacy(req.user, req.body?.isPrivate) }))
export const search = asyncHandler(async (req, res) => send(res, 200, 'OK', await users.searchUsers(req.user, req.query.q, parsePaging(req.query))))

export const follow = asyncHandler(async (req, res) => send(res, 200, 'OK', await follows.followUser(req.user, req.params.id)))
export const unfollow = asyncHandler(async (req, res) => { await follows.unfollowUser(req.user, req.params.id); send(res, 200, 'Unfollowed') })
export const followers = asyncHandler(async (req, res) => send(res, 200, 'OK', await follows.getFollowers(req.user, req.params.id, parsePaging(req.query))))
export const following = asyncHandler(async (req, res) => send(res, 200, 'OK', await follows.getFollowing(req.user, req.params.id, parsePaging(req.query))))
export const requests = asyncHandler(async (req, res) => send(res, 200, 'OK', await follows.getRequests(req.user)))
export const acceptRequest = asyncHandler(async (req, res) => { await follows.acceptRequest(req.user, req.params.id); send(res, 200, 'Request accepted') })
export const rejectRequest = asyncHandler(async (req, res) => { await follows.rejectRequest(req.user, req.params.id); send(res, 200, 'Request declined') })

export const block = asyncHandler(async (req, res) => { await blocks.blockUser(req.user, req.params.id); send(res, 200, 'User blocked') })
export const unblock = asyncHandler(async (req, res) => { await blocks.unblockUser(req.user, req.params.id); send(res, 200, 'User unblocked') })
export const blocked = asyncHandler(async (req, res) => send(res, 200, 'OK', await blocks.listBlocked(req.user)))
export const reportUser = asyncHandler(async (req, res) => { await reports.reportUser(req.user, req.params.id, req.body); send(res, 201, 'Report submitted. Thank you.') })
export const setStoryPrivacy = asyncHandler(async (req, res) => send(res, 200, 'Story privacy updated', { user: await users.setStoryPrivacy(req.user, req.body?.visibility) }))
export const setChatPrivacy = asyncHandler(async (req, res) => send(res, 200, 'Chat privacy updated', { user: await users.setChatPrivacy(req.user, req.body) }))
