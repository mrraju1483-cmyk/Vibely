import { asyncHandler } from '../utils/ApiError.js'
import { send } from '../utils/respond.js'
import * as ai from '../services/ai/aiService.js'

export const status = asyncHandler(async (req, res) => send(res, 200, 'OK', await ai.status()))
export const chat = asyncHandler(async (req, res) => send(res, 200, 'OK', await ai.chat(req.user, req.body)))
export const captions = asyncHandler(async (req, res) => send(res, 200, 'OK', await ai.captions(req.user, req.body)))
export const smartReplies = asyncHandler(async (req, res) => send(res, 200, 'OK', await ai.smartReplies(req.user, req.body)))
export const safety = asyncHandler(async (req, res) => send(res, 200, 'OK', await ai.safety(req.user, req.body)))
