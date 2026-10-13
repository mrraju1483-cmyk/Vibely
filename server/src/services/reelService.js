import Reel from '../models/Reel.js'
import ReelComment from '../models/ReelComment.js'
import Like from '../models/Like.js'
import SavedReel from '../models/SavedReel.js'
import ReelView from '../models/ReelView.js'
import User from '../models/User.js'
import Follow from '../models/Follow.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { blockState, blockedIdSet } from '../utils/relations.js'
import { validateUpload } from './media/validate.js'
import { getVideoDuration, MAX_REEL_SECONDS } from './media/duration.js'
import { uploadMedia, deleteMedia } from './media/index.js'
import { validateReelInput } from '../validators/reelValidators.js'
import { authorDto, AUTHOR_FIELDS } from './postService.js'
import { notify, notifyMentions, safe } from './notificationService.js'

// Loads a reel (author populated) only if the viewer may see it. Hidden reels look like 404.
export async function loadViewableReel(viewer, id) {
  const reel = await Reel.findById(id).populate('author', AUTHOR_FIELDS)
  const author = reel?.author
  if (!reel || !author || !author.isActive) throw new ApiError(404, 'Reel not found')
  if (author._id.equals(viewer._id)) return reel
  const bs = await blockState(viewer._id, author._id)
  if (bs.byMe || bs.byThem) throw new ApiError(404, 'Reel not found')
  if (author.isPrivate) {
    const ok = await Follow.exists({ follower: viewer._id, following: author._id, status: 'accepted' })
    if (!ok) throw new ApiError(404, 'Reel not found')
  }
  return reel
}

export async function serialize(reels, viewerId) {
  const ids = reels.map((r) => r._id)
  const [likes, saves] = await Promise.all([
    Like.find({ user: viewerId, targetType: 'reel', target: { $in: ids } }).select('target'),
    SavedReel.find({ user: viewerId, reel: { $in: ids } }).select('reel'),
  ])
  const liked = new Set(likes.map((l) => l.target.toString()))
  const saved = new Set(saves.map((s) => s.reel.toString()))
  return reels.filter((r) => r.author && r.author.isActive).map((r) => ({
    id: r._id.toString(), author: authorDto(r.author), videoUrl: r.video, caption: r.caption, hashtags: r.hashtags,
    location: r.location, duration: r.duration, viewsCount: r.viewsCount,
    likesCount: Math.max(0, r.likesCount), commentsCount: Math.max(0, r.commentsCount), sharesCount: r.sharesCount,
    createdAt: r.createdAt, likedByMe: liked.has(r._id.toString()), savedByMe: saved.has(r._id.toString()), isMine: r.author._id.equals(viewerId),
  }))
}

const page = async (query, viewerId, limit) => {
  const rows = await Reel.find(query).sort({ _id: -1 }).limit(limit + 1).populate('author', AUTHOR_FIELDS)
  const hasMore = rows.length > limit
  const slice = rows.slice(0, limit)
  return { reels: await serialize(slice, viewerId), nextCursor: hasMore ? slice[slice.length - 1]._id.toString() : null }
}

export async function createReel(user, file, body) {
  const info = validateUpload(file) // real type + size check
  if (info.mediaType !== 'video') throw new ApiError(400, 'Validation failed', { errors: { media: 'Reels must be videos (MP4, MOV or WebM).' } })
  const v = validateReelInput(body)
  const duration = getVideoDuration(file.buffer, info.ext) ?? v.clientDuration // the file's own duration wins over the browser's claim
  if (duration !== null && duration > MAX_REEL_SECONDS) {
    throw new ApiError(400, 'Validation failed', { errors: { media: `Reels can be at most ${MAX_REEL_SECONDS} seconds long` } })
  }
  const stored = await uploadMedia(file, info)
  try {
    const reel = await Reel.create({ author: user._id, caption: v.caption, location: v.location, hashtags: v.hashtags, duration, authorPrivate: user.isPrivate, video: stored.url, mediaKey: stored.key })
    await reel.populate('author', AUTHOR_FIELDS)
    safe(notifyMentions({ actor: user._id, text: v.caption, reel: reel._id }))
    return (await serialize([reel], user._id))[0]
  } catch (e) {
    await deleteMedia(stored.key).catch(() => {})
    throw e
  }
}

// Discovery feed: public accounts + people you follow + you. Blocked users (either way) are excluded.
export async function getFeed(user, { cursor, limit }) {
  const [following, hidden] = await Promise.all([
    Follow.find({ follower: user._id, status: 'accepted' }).select('following'),
    blockedIdSet(user._id),
  ])
  const query = {
    author: { $nin: [...hidden] },
    $or: [{ author: user._id }, { author: { $in: following.map((f) => f.following) } }, { authorPrivate: false }],
  }
  if (cursor) query._id = { $lt: cursor }
  return page(query, user._id, limit)
}

export async function getUserReels(viewer, userId, { cursor, limit }) {
  const author = await User.findOne({ _id: userId, isActive: true })
  if (!author) throw new ApiError(404, 'User not found')
  if (!author._id.equals(viewer._id)) {
    const bs = await blockState(viewer._id, author._id)
    if (bs.byMe || bs.byThem) throw new ApiError(404, 'User not found')
    const follows = await Follow.exists({ follower: viewer._id, following: author._id, status: 'accepted' })
    if (author.isPrivate && !follows) throw new ApiError(403, 'This account is private')
  }
  const query = { author: author._id }
  if (cursor) query._id = { $lt: cursor }
  return page(query, viewer._id, limit)
}

export async function getReel(user, id) {
  return (await serialize([await loadViewableReel(user, id)], user._id))[0]
}

export async function listSaved(user, { cursor, limit }) {
  const query = { user: user._id }
  if (cursor) query._id = { $lt: cursor }
  const rows = await SavedReel.find(query).sort({ _id: -1 }).limit(limit + 1).populate({ path: 'reel', populate: { path: 'author', select: AUTHOR_FIELDS } })
  const hasMore = rows.length > limit
  const slice = rows.slice(0, limit)
  const hidden = await blockedIdSet(user._id)
  const authorIds = slice.map((r) => r.reel?.author?._id).filter(Boolean)
  const followed = new Set((await Follow.find({ follower: user._id, status: 'accepted', following: { $in: authorIds } }).select('following')).map((f) => f.following.toString()))
  const viewable = slice.map((r) => r.reel).filter((r) => {
    if (!r || !r.author || !r.author.isActive) return false
    if (r.author._id.equals(user._id)) return true
    if (hidden.has(r.author._id.toString())) return false
    return !r.author.isPrivate || followed.has(r.author._id.toString())
  })
  return { reels: await serialize(viewable, user._id), nextCursor: hasMore ? slice[slice.length - 1]._id.toString() : null }
}

// Removes a reel and everything attached to it. Used by the owner (deleteReel) and by admin moderation.
export async function purgeReel(reel) {
  await Promise.all([
    Reel.deleteOne({ _id: reel._id }), ReelComment.deleteMany({ reel: reel._id }), SavedReel.deleteMany({ reel: reel._id }),
    ReelView.deleteMany({ reel: reel._id }), Like.deleteMany({ targetType: 'reel', target: reel._id }),
  ])
  await deleteMedia(reel.mediaKey).catch(() => {})
}

export async function deleteReel(user, id) {
  const reel = await loadViewableReel(user, id)
  if (!reel.author._id.equals(user._id)) throw new ApiError(403, 'You can only delete your own reels')
  await purgeReel(reel)
}

export async function likeReel(user, id) {
  const reel = await loadViewableReel(user, id)
  try {
    await Like.create({ user: user._id, targetType: 'reel', target: reel._id })
    await Reel.updateOne({ _id: reel._id }, { $inc: { likesCount: 1 } })
    safe(notify({ recipient: reel.author._id, actor: user._id, type: 'like', reel: reel._id, dedupe: true }))
  } catch (e) { if (e.code !== 11000) throw e } // already liked: idempotent
  const fresh = await Reel.findById(reel._id).select('likesCount')
  return { liked: true, likesCount: Math.max(0, fresh.likesCount) }
}

export async function unlikeReel(user, id) {
  const removed = await Like.findOneAndDelete({ user: user._id, targetType: 'reel', target: id })
  if (removed) await Reel.updateOne({ _id: id }, { $inc: { likesCount: -1 } })
  const fresh = await Reel.findById(id).select('likesCount')
  return { liked: false, likesCount: Math.max(0, fresh?.likesCount || 0) }
}

export async function saveReel(user, id) {
  const reel = await loadViewableReel(user, id)
  try { await SavedReel.create({ user: user._id, reel: reel._id }) } catch (e) { if (e.code !== 11000) throw e }
  return { saved: true }
}

export async function unsaveReel(user, id) {
  await SavedReel.deleteOne({ user: user._id, reel: id })
  return { saved: false }
}

export async function shareReel(user, id) {
  const reel = await loadViewableReel(user, id)
  const updated = await Reel.findByIdAndUpdate(reel._id, { $inc: { sharesCount: 1 } }, { new: true })
  return { sharesCount: updated.sharesCount, url: `${env.clientUrl.split(',')[0]}/reels/${reel._id}` }
}

// Counted once per person (unique index). Your own views do not count.
export async function viewReel(user, id) {
  const reel = await loadViewableReel(user, id)
  if (reel.author._id.equals(user._id)) return { counted: false }
  try {
    await ReelView.create({ reel: reel._id, user: user._id })
    await Reel.updateOne({ _id: reel._id }, { $inc: { viewsCount: 1 } })
    return { counted: true }
  } catch (e) {
    if (e.code === 11000) return { counted: false }
    throw e
  }
}
