import { asyncHandler } from '../utils/ApiError.js'
import { send } from '../utils/respond.js'
import { parseCursorPaging } from '../utils/relations.js'
import { validateReason, validateActive } from '../validators/adminValidators.js'
import { getStats } from '../services/admin/statsService.js'
import * as users from '../services/admin/userAdminService.js'
import * as content from '../services/admin/contentAdminService.js'
import * as reports from '../services/admin/reportAdminService.js'
import { listAudit } from '../services/admin/auditAdminService.js'

const paging = (req) => parseCursorPaging(req.query, 20, 50)

export const stats = asyncHandler(async (req, res) => send(res, 200, 'OK', await getStats()))

export const listUsers = asyncHandler(async (req, res) => send(res, 200, 'OK', await users.listUsers(req.query, paging(req))))
export const getUser = asyncHandler(async (req, res) => send(res, 200, 'OK', await users.getUser(req.params.id)))
export const setUserStatus = asyncHandler(async (req, res) => {
  const { active, reason } = validateActive(req.body)
  send(res, 200, active ? 'Account reactivated' : 'Account deactivated', { user: await users.setActive(req.user, req.params.id, active, reason) })
})
export const removeUser = asyncHandler(async (req, res) => send(res, 200, 'Account removed', await users.removeUser(req.user, req.params.id, validateReason(req.body))))

export const listPosts = asyncHandler(async (req, res) => send(res, 200, 'OK', await content.listPosts(req.query, paging(req))))
export const listReels = asyncHandler(async (req, res) => send(res, 200, 'OK', await content.listReels(req.query, paging(req))))
export const listComments = asyncHandler(async (req, res) => send(res, 200, 'OK', await content.listComments(req.query, paging(req))))
export const removePost = asyncHandler(async (req, res) => { await content.removePost(req.user, req.params.id, validateReason(req.body)); send(res, 200, 'Post removed') })
export const removeReel = asyncHandler(async (req, res) => { await content.removeReel(req.user, req.params.id, validateReason(req.body)); send(res, 200, 'Reel removed') })
export const removeComment = asyncHandler(async (req, res) => send(res, 200, 'Comment removed', await content.removeComment(req.user, req.params.id, req.body?.kind, validateReason(req.body))))

export const listReports = asyncHandler(async (req, res) => send(res, 200, 'OK', await reports.listReports(req.query, paging(req))))
export const getReport = asyncHandler(async (req, res) => send(res, 200, 'OK', { report: await reports.getReport(req.params.id) }))
export const updateReport = asyncHandler(async (req, res) => send(res, 200, 'Report updated', { report: await reports.updateReport(req.user, req.params.id, req.body) }))

export const audit = asyncHandler(async (req, res) => send(res, 200, 'OK', await listAudit(paging(req))))
