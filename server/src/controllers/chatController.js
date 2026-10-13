import { asyncHandler } from '../utils/ApiError.js'
import { send } from '../utils/respond.js'
import { parseCursorPaging } from '../utils/relations.js'
import * as convs from '../services/chat/conversationService.js'
import * as msgs from '../services/chat/messageService.js'

export const list = asyncHandler(async (req, res) => send(res, 200, 'OK', await convs.listConversations(req.user, req.query.q)))
export const getOne = asyncHandler(async (req, res) => send(res, 200, 'OK', await convs.getConversation(req.user, req.params.id)))
export const direct = asyncHandler(async (req, res) => {
  const r = await convs.getOrCreateDirect(req.user, req.body?.userId)
  send(res, r.created ? 201 : 200, 'OK', { conversation: r.conversation })
})
export const createGroup = asyncHandler(async (req, res) => send(res, 201, 'Group created', await convs.createGroup(req.user, req.body)))
export const update = asyncHandler(async (req, res) => send(res, 200, 'Group updated', await convs.renameGroup(req.user, req.params.id, req.body)))
export const updatePhoto = asyncHandler(async (req, res) => send(res, 200, 'Group photo updated', await convs.setGroupPhoto(req.user, req.params.id, req.file)))
export const settings = asyncHandler(async (req, res) => send(res, 200, 'Settings updated', await convs.setDisappear(req.user, req.params.id, req.body)))
export const addMembers = asyncHandler(async (req, res) => send(res, 200, 'Members added', await convs.addMembers(req.user, req.params.id, req.body)))
export const removeMember = asyncHandler(async (req, res) => { await convs.removeMember(req.user, req.params.id, req.params.userId); send(res, 200, 'Done') })

export const messages = asyncHandler(async (req, res) => send(res, 200, 'OK', await msgs.listMessages(req.user, req.params.id, parseCursorPaging(req.query, 30, 50))))
export const sendMessage = asyncHandler(async (req, res) => send(res, 201, 'Sent', { message: await msgs.sendMessage(req.user, req.params.id, req.file, req.body) }))
export const read = asyncHandler(async (req, res) => { await msgs.markRead(req.user, req.params.id); send(res, 200, 'OK') })
export const deleteMessage = asyncHandler(async (req, res) => { await msgs.deleteMessage(req.user, req.params.id, req.params.messageId, req.query.scope || 'me'); send(res, 200, 'Message deleted') })
