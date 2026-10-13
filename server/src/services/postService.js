import Post from '../models/Post.js'
import Comment from '../models/Comment.js'
import Like from '../models/Like.js'
import SavedPost from '../models/SavedPost.js'
import User from '../models/User.js'
import Follow from '../models/Follow.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { blockState, blockedIdSet } from '../utils/relations.js'
import { validateUpload } from './media/validate.js'
import { uploadMedia, deleteMedia } from './media/index.js'
import { validatePostInput } from '../validators/postValidators.js'
import { notify, notifyMentions, safe } from './notificationService.js'
import * as hashtags from './hashtagService.js'

export const AUTHOR_FIELDS = 'fullName username profilePhoto isPrivate isActive'
export const authorDto = (u) => ({ id: u._id.toString(), fullName: u.fullName, username: u.username, profilePhoto: u.profilePhoto, isPrivate: u.isPrivate })

// Loads a post (author populated) only if the viewer may see it. Hidden posts look like 404.
export async function loadViewablePost(viewer, id) {
  const post = await Post.findById(id).populate('author', AUTHOR_FIELDS)
  const author = post?.author
  if (!post || !author || !author.isActive) throw new ApiError(404, 'Post not found')
  if (author._id.equals(viewer._id)) return post
  const bs = await blockState(viewer._id, author._id)
  if (bs.byMe || bs.byThem || post.visibility === 'private') throw new ApiError(404, 'Post not found')
  if (post.visibility === 'followers' || author.isPrivate) {
    const ok = await Follow.exists({ follower: viewer._id, following: author._id, status: 'accepted' })
    if (!ok) throw new ApiError(404, 'Post not found')
  }
  return post
}

export async function serialize(posts, viewerId) {
  const ids = posts.map((p) => p._id)
  const [likes, saves] = await Promise.all([
    Like.find({ user: viewerId, targetType: 'post', target: { $in: ids } }).select('target'),
    SavedPost.find({ user: viewerId, post: { $in: ids } }).select('post'),
  ])
  const liked = new Set(likes.map((l) => l.target.toString()))
  const saved = new Set(saves.map((s) => s.post.toString()))
  return posts.filter((p) => p.author && p.author.isActive).map((p) => ({
    id: p._id.toString(), author: authorDto(p.author), caption: p.caption, mediaUrl: p.media, mediaType: p.mediaType,
    hashtags: p.hashtags, location: p.location, visibility: p.visibility,
    likesCount: Math.max(0, p.likesCount), commentsCount: Math.max(0, p.commentsCount), sharesCount: p.sharesCount,
    createdAt: p.createdAt, likedByMe: liked.has(p._id.toString()), savedByMe: saved.has(p._id.toString()),
    isMine: p.author._id.equals(viewerId),
  }))
}

const page = async (query, viewerId, limit) => {
  const rows = await Post.find(query).sort({ _id: -1 }).limit(limit + 1).populate('author', AUTHOR_FIELDS)
  const hasMore = rows.length > limit
  const slice = rows.slice(0, limit)
  return { posts: await serialize(slice, viewerId), nextCursor: hasMore ? slice[slice.length - 1]._id.toString() : null }
}

export async function createPost(user, file, body) {
  const info = validateUpload(file) // real type + size check
  const v = validatePostInput(body)
  const stored = await uploadMedia(file, info)
  try {
    const post = await Post.create({ author: user._id, ...v, authorPrivate: user.isPrivate, media: stored.url, mediaKey: stored.key, mediaType: info.mediaType })
    if (post.visibility === 'public' && !user.isPrivate) await hashtags.addForPost(post.hashtags).catch(() => {})
    await post.populate('author', AUTHOR_FIELDS)
    safe(notifyMentions({ actor: user._id, text: v.caption, post: post._id }))
    return (await serialize([post], user._id))[0]
  } catch (e) {
    await deleteMedia(stored.key).catch(() => {}) // do not leave orphan files
    throw e
  }
}

export async function getFeed(user, { cursor, limit }) {
  const [following, hidden] = await Promise.all([
    Follow.find({ follower: user._id, status: 'accepted' }).select('following'),
    blockedIdSet(user._id),
  ])
  const ids = following.map((f) => f.following).filter((id) => !hidden.has(id.toString()))
  const query = { $or: [{ author: user._id }, { author: { $in: ids }, visibility: { $in: ['public', 'followers'] } }] }
  if (cursor) query._id = { $lt: cursor }
  return page(query, user._id, limit)
}

export async function getPost(user, id) {
  return (await serialize([await loadViewablePost(user, id)], user._id))[0]
}

export async function getUserPosts(viewer, userId, { cursor, limit }) {
  const author = await User.findOne({ _id: userId, isActive: true })
  if (!author) throw new ApiError(404, 'User not found')
  const query = { author: author._id }
  if (!author._id.equals(viewer._id)) {
    const bs = await blockState(viewer._id, author._id)
    if (bs.byMe || bs.byThem) throw new ApiError(404, 'User not found')
    const follows = await Follow.exists({ follower: viewer._id, following: author._id, status: 'accepted' })
    if (author.isPrivate && !follows) throw new ApiError(403, 'This account is private')
    query.visibility = { $in: follows ? ['public', 'followers'] : ['public'] }
  }
  if (cursor) query._id = { $lt: cursor }
  return page(query, viewer._id, limit)
}

// Removes a post and everything attached to it. Used by the owner (deletePost) and by admin moderation.
export async function purgePost(post) {
  const commentIds = await Comment.find({ post: post._id }).distinct('_id')
  await Promise.all([
    Post.deleteOne({ _id: post._id }),
    Comment.deleteMany({ post: post._id }),
    Like.deleteMany({ $or: [{ targetType: 'post', target: post._id }, { targetType: 'comment', target: { $in: commentIds } }] }),
    SavedPost.deleteMany({ post: post._id }),
  ])
  await deleteMedia(post.mediaKey).catch(() => {})
  if (post.visibility === 'public' && !post.authorPrivate) await hashtags.removeForPost(post.hashtags).catch(() => {})
}

export async function deletePost(user, id) {
  const post = await loadViewablePost(user, id)
  if (!post.author._id.equals(user._id)) throw new ApiError(403, 'You can only delete your own posts')
  await purgePost(post)
}

export async function likePost(user, id) {
  const post = await loadViewablePost(user, id)
  try {
    await Like.create({ user: user._id, targetType: 'post', target: post._id })
    await Post.updateOne({ _id: post._id }, { $inc: { likesCount: 1 } })
    safe(notify({ recipient: post.author._id, actor: user._id, type: 'like', post: post._id, dedupe: true }))
  } catch (e) {
    if (e.code !== 11000) throw e // already liked: stay idempotent
  }
  const fresh = await Post.findById(post._id).select('likesCount')
  return { liked: true, likesCount: Math.max(0, fresh.likesCount) }
}

export async function unlikePost(user, id) {
  const removed = await Like.findOneAndDelete({ user: user._id, targetType: 'post', target: id })
  if (removed) await Post.updateOne({ _id: id }, { $inc: { likesCount: -1 } })
  const fresh = await Post.findById(id).select('likesCount')
  return { liked: false, likesCount: Math.max(0, fresh?.likesCount || 0) }
}

export async function savePost(user, id) {
  const post = await loadViewablePost(user, id)
  try { await SavedPost.create({ user: user._id, post: post._id }) } catch (e) { if (e.code !== 11000) throw e }
  return { saved: true }
}

export async function unsavePost(user, id) {
  await SavedPost.deleteOne({ user: user._id, post: id })
  return { saved: false }
}

export async function listSaved(user, { cursor, limit }) {
  const query = { user: user._id }
  if (cursor) query._id = { $lt: cursor }
  const rows = await SavedPost.find(query).sort({ _id: -1 }).limit(limit + 1)
    .populate({ path: 'post', populate: { path: 'author', select: AUTHOR_FIELDS } })
  const hasMore = rows.length > limit
  const slice = rows.slice(0, limit)
  const hidden = await blockedIdSet(user._id)
  const authorIds = slice.map((r) => r.post?.author?._id).filter(Boolean)
  const followed = new Set((await Follow.find({ follower: user._id, status: 'accepted', following: { $in: authorIds } }).select('following')).map((f) => f.following.toString()))
  const viewable = slice.map((r) => r.post).filter((p) => {
    if (!p || !p.author || !p.author.isActive) return false
    if (p.author._id.equals(user._id)) return true
    if (hidden.has(p.author._id.toString()) || p.visibility === 'private') return false
    return !((p.visibility === 'followers' || p.author.isPrivate) && !followed.has(p.author._id.toString()))
  })
  return { posts: await serialize(viewable, user._id), nextCursor: hasMore ? slice[slice.length - 1]._id.toString() : null }
}

export async function sharePost(user, id) {
  const post = await loadViewablePost(user, id)
  const updated = await Post.findByIdAndUpdate(post._id, { $inc: { sharesCount: 1 } }, { new: true })
  return { sharesCount: updated.sharesCount, url: `${env.clientUrl.split(',')[0]}/post/${post._id}` }
}
