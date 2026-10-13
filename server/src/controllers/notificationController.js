import { asyncHandler } from '../utils/ApiError.js'
import { send } from '../utils/respond.js'
import { parseCursorPaging } from '../utils/relations.js'
import * as n from '../services/notificationService.js'

export const list = asyncHandler(async (req, res) => send(res, 200, 'OK', await n.listNotifications(req.user, parseCursorPaging(req.query, 20, 50))))
export const unread = asyncHandler(async (req, res) => send(res, 200, 'OK', await n.getUnreadCount(req.user)))
export const read = asyncHandler(async (req, res) => send(res, 200, 'OK', await n.markRead(req.user, req.params.id)))
export const readAll = asyncHandler(async (req, res) => send(res, 200, 'OK', await n.markAllRead(req.user)))
