import Report from '../models/Report.js'
import User from '../models/User.js'
import { ApiError } from '../utils/ApiError.js'
import { validateReport } from '../validators/postValidators.js'
import { loadViewablePost } from './postService.js'
import { loadViewableReel } from './reelService.js'

async function create(user, targetType, target, v) {
  try {
    await Report.create({ reporter: user._id, targetType, target, ...v })
  } catch (e) {
    if (e.code === 11000) throw new ApiError(409, 'You already reported this')
    throw e
  }
}

export async function reportPost(user, postId, body) {
  const v = validateReport(body)
  const post = await loadViewablePost(user, postId)
  if (post.author._id.equals(user._id)) throw new ApiError(400, 'You cannot report your own post')
  await create(user, 'post', post._id, v)
}

export async function reportUser(user, userId, body) {
  const v = validateReport(body)
  if (user._id.equals(userId)) throw new ApiError(400, 'You cannot report yourself')
  if (!(await User.exists({ _id: userId, isActive: true }))) throw new ApiError(404, 'User not found')
  await create(user, 'user', userId, v)
}

export async function reportReel(user, reelId, body) {
  const v = validateReport(body)
  const reel = await loadViewableReel(user, reelId)
  if (reel.author._id.equals(user._id)) throw new ApiError(400, 'You cannot report your own reel')
  await create(user, 'reel', reel._id, v)
}
