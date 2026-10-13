import Story from '../models/Story.js'
import User from '../models/User.js'
import Follow from '../models/Follow.js'
import { ApiError } from '../utils/ApiError.js'
import { blockState, blockedIdSet } from '../utils/relations.js'
import { validateUpload } from './media/validate.js'
import { uploadMedia, deleteMedia } from './media/index.js'
import { validateStoryInput } from '../validators/storyValidators.js'
import { authorDto, AUTHOR_FIELDS } from './postService.js'

const DAY = 24 * 60 * 60 * 1000
const MAX_ACTIVE = 30
const active = () => ({ expiresAt: { $gt: new Date() } }) // backend expiry filter: never trust a frontend timer

async function viewedSet(viewerId, stories) {
  const rows = await Story.find({ _id: { $in: stories.map((s) => s._id) }, 'viewers.user': viewerId }).select('_id')
  return new Set(rows.map((r) => r._id.toString()))
}

function dto(s, viewerId, viewed) {
  const isMine = s.user._id.equals(viewerId)
  return {
    id: s._id.toString(), mediaUrl: s.media, mediaType: s.mediaType, caption: s.caption, visibility: s.visibility,
    createdAt: s.createdAt, expiresAt: s.expiresAt, isMine,
    viewedByMe: isMine || viewed.has(s._id.toString()),
    ...(isMine && { viewersCount: s.viewersCount }), // only the owner sees view counts
  }
}

const toGroup = (user, stories) => ({ user: authorDto(user), stories, hasUnseen: stories.some((s) => !s.viewedByMe) })

export async function createStory(user, file, body) {
  const info = validateUpload(file)
  const v = validateStoryInput(body, user.storyVisibility)
  if ((await Story.countDocuments({ user: user._id, ...active() })) >= MAX_ACTIVE) {
    throw new ApiError(400, `You can have at most ${MAX_ACTIVE} active stories`)
  }
  const stored = await uploadMedia(file, info)
  try {
    const story = await Story.create({ user: user._id, ...v, media: stored.url, mediaKey: stored.key, mediaType: info.mediaType, expiresAt: new Date(Date.now() + DAY) })
    story.user = user
    return dto(story, user._id, new Set())
  } catch (e) {
    await deleteMedia(stored.key).catch(() => {})
    throw e
  }
}

// Stories tray: my stories + stories from people I follow
export async function getTray(me) {
  const [following, hidden] = await Promise.all([
    Follow.find({ follower: me._id, status: 'accepted' }).select('following'),
    blockedIdSet(me._id),
  ])
  const ids = [me._id, ...following.map((f) => f.following).filter((id) => !hidden.has(id.toString()))]
  const rows = await Story.find({ user: { $in: ids }, ...active() }).sort({ createdAt: 1 }).limit(500).populate('user', AUTHOR_FIELDS)
  const viewed = await viewedSet(me._id, rows)

  const byUser = new Map()
  for (const s of rows) {
    if (!s.user || !s.user.isActive) continue
    const key = s.user._id.toString()
    if (!byUser.has(key)) byUser.set(key, { user: s.user, stories: [] })
    byUser.get(key).stories.push(dto(s, me._id, viewed))
  }
  const groups = [...byUser.values()].map((g) => toGroup(g.user, g.stories))
  const latest = (g) => new Date(g.stories[g.stories.length - 1].createdAt).getTime()
  groups.sort((a, b) => {
    if (a.user.id === me._id.toString()) return -1
    if (b.user.id === me._id.toString()) return 1
    return (b.hasUnseen - a.hasUnseen) || (latest(b) - latest(a))
  })
  return { groups }
}

export async function getUserStories(viewer, userId) {
  const author = await User.findOne({ _id: userId, isActive: true })
  if (!author) throw new ApiError(404, 'User not found')
  const isMe = author._id.equals(viewer._id)
  const query = { user: author._id, ...active() }
  if (!isMe) {
    const bs = await blockState(viewer._id, author._id)
    if (bs.byMe || bs.byThem) throw new ApiError(404, 'User not found')
    const follows = await Follow.exists({ follower: viewer._id, following: author._id, status: 'accepted' })
    if (author.isPrivate && !follows) throw new ApiError(403, 'This account is private')
    if (!follows) query.visibility = 'public'
  }
  const rows = await Story.find(query).sort({ createdAt: 1 }).limit(100).populate('user', AUTHOR_FIELDS)
  if (!rows.length) return { group: null }
  const viewed = await viewedSet(viewer._id, rows)
  return { group: toGroup(rows[0].user, rows.map((s) => dto(s, viewer._id, viewed))) }
}

// Loads an unexpired story only if the viewer may see it. Anything hidden looks like 404.
async function loadViewable(viewer, id) {
  const story = await Story.findOne({ _id: id, ...active() }).populate('user', AUTHOR_FIELDS)
  const owner = story?.user
  if (!story || !owner || !owner.isActive) throw new ApiError(404, 'Story not found')
  if (owner._id.equals(viewer._id)) return story
  const bs = await blockState(viewer._id, owner._id)
  if (bs.byMe || bs.byThem) throw new ApiError(404, 'Story not found')
  if (story.visibility === 'followers' || owner.isPrivate) {
    const ok = await Follow.exists({ follower: viewer._id, following: owner._id, status: 'accepted' })
    if (!ok) throw new ApiError(404, 'Story not found')
  }
  return story
}

export async function viewStory(viewer, id) {
  const story = await loadViewable(viewer, id)
  if (story.user._id.equals(viewer._id)) return { viewed: true }
  // Atomic and idempotent: the filter makes a second view a no-op
  await Story.updateOne(
    { _id: story._id, 'viewers.user': { $ne: viewer._id }, viewersCount: { $lt: 5000 } },
    { $push: { viewers: { user: viewer._id, viewedAt: new Date() } }, $inc: { viewersCount: 1 } }
  )
  return { viewed: true }
}

export async function getViewers(owner, id) {
  const story = await Story.findById(id)
  if (!story || story.expiresAt <= new Date()) throw new ApiError(404, 'Story not found')
  if (!story.user.equals(owner._id)) throw new ApiError(403, 'Only the owner can see who viewed a story')
  await story.populate('viewers.user', AUTHOR_FIELDS)
  const hidden = await blockedIdSet(owner._id)
  const viewers = story.viewers
    .filter((v) => v.user && v.user.isActive && !hidden.has(v.user._id.toString()))
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .map((v) => ({ user: authorDto(v.user), viewedAt: v.viewedAt }))
  return { viewers, total: story.viewersCount }
}

export async function deleteStory(user, id) {
  const story = await Story.findById(id)
  if (!story) throw new ApiError(404, 'Story not found')
  if (!story.user.equals(user._id)) throw new ApiError(403, 'You can only delete your own stories')
  await Story.deleteOne({ _id: story._id })
  await deleteMedia(story.mediaKey).catch(() => {})
}

// Removes expired stories and their media files. Runs on a timer (see server.js). Hidden-by-expiry is already enforced in every query.
export async function cleanupExpiredStories() {
  let removed = 0
  for (let i = 0; i < 20; i++) {
    const batch = await Story.find({ expiresAt: { $lte: new Date() } }).limit(100).select('_id mediaKey')
    if (!batch.length) break
    await Promise.all(batch.map((s) => deleteMedia(s.mediaKey).catch(() => {})))
    await Story.deleteMany({ _id: { $in: batch.map((s) => s._id) } })
    removed += batch.length
    if (batch.length < 100) break
  }
  return removed
}
