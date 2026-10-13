import { asyncHandler } from '../utils/ApiError.js'
import { send } from '../utils/respond.js'
import * as stories from '../services/storyService.js'

export const create = asyncHandler(async (req, res) => send(res, 201, 'Story posted', { story: await stories.createStory(req.user, req.file, req.body) }))
export const tray = asyncHandler(async (req, res) => send(res, 200, 'OK', await stories.getTray(req.user)))
export const userStories = asyncHandler(async (req, res) => send(res, 200, 'OK', await stories.getUserStories(req.user, req.params.id)))
export const view = asyncHandler(async (req, res) => send(res, 200, 'OK', await stories.viewStory(req.user, req.params.id)))
export const viewers = asyncHandler(async (req, res) => send(res, 200, 'OK', await stories.getViewers(req.user, req.params.id)))
export const remove = asyncHandler(async (req, res) => { await stories.deleteStory(req.user, req.params.id); send(res, 200, 'Story deleted') })
