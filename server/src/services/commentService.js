import Post from '../models/Post.js'
import Comment from '../models/Comment.js'
import Like from '../models/Like.js'
import { ApiError } from '../utils/ApiError.js'
import { blockedIdSet } from '../utils/relations.js'
import { validateComment } from '../validators/postValidators.js'
import { loadViewablePost, authorDto, AUTHOR_FIELDS } from './postService.js'
import { notify, notifyMentions, safe } from './notificationService.js'

async function serialize(comments, viewerId) {
  const likes = await Like.find({ user: viewerId, targetType: 'comment', target: { $in: comments.map((c) => c._id) } }).select('target')
  const liked = new Set(likes.map((l) => l.target.toString()))
  return comments.filter((c) => c.author && c.author.isActive).map((c) => ({
    id: c._id.toString(), postId: c.post.toString(), parentId: c.parent ? c.parent.toString() : null,
    author: authorDto(c.author), text: c.text, likesCount: Math.max(0, c.likesCount), repliesCount: Math.max(0, c.repliesCount),
    likedByMe: liked.has(c._id.toString()), isMine: c.author._id.equals(viewerId), createdAt: c.createdAt,
  }))
}

export async function addComment(user, postId, body) {
  const { text, parentId } = validateComment(body)
  const post = await loadViewablePost(user, postId)
  let parent = null
  if (parentId) {
    parent = await Comment.findOne({ _id: parentId, post: post._id })
    if (!parent) throw new ApiError(404, 'Comment not found')
    if (parent.parent) parent = await Comment.findById(parent.parent) // replies to replies attach to the top-level comment
    if (!parent) throw new ApiError(404, 'Comment not found')
  }
  const comment = await Comment.create({ post: post._id, author: user._id, text, parent: parent ? parent._id : null })
  await Promise.all([
    Post.updateOne({ _id: post._id }, { $inc: { commentsCount: 1 } }),
    parent ? Comment.updateOne({ _id: parent._id }, { $inc: { repliesCount: 1 } }) : null,
  ])
  const told = new Set()
  if (parent) { safe(notify({ recipient: parent.author, actor: user._id, type: 'reply', post: post._id, text })); told.add(String(parent.author)) }
  if (!told.has(String(post.author._id))) { safe(notify({ recipient: post.author._id, actor: user._id, type: 'comment', post: post._id, text })); told.add(String(post.author._id)) }
  safe(notifyMentions({ actor: user._id, text, post: post._id, exclude: [...told] }))
  await comment.populate('author', AUTHOR_FIELDS)
  return (await serialize([comment], user._id))[0]
}

async function list(user, filter, order, cursor, limit) {
  const query = { ...filter }
  if (cursor) query._id = order === -1 ? { $lt: cursor } : { $gt: cursor }
  const rows = await Comment.find(query).sort({ _id: order }).limit(limit + 1).populate('author', AUTHOR_FIELDS)
  const hasMore = rows.length > limit
  const slice = rows.slice(0, limit)
  const hidden = await blockedIdSet(user._id)
  const visible = slice.filter((c) => !hidden.has(c.author?._id?.toString()))
  return { comments: await serialize(visible, user._id), nextCursor: hasMore ? slice[slice.length - 1]._id.toString() : null }
}

export async function listComments(user, postId, { cursor, limit }) {
  const post = await loadViewablePost(user, postId)
  return list(user, { post: post._id, parent: null }, -1, cursor, limit)
}

export async function listReplies(user, commentId, { cursor, limit }) {
  const parent = await Comment.findById(commentId)
  if (!parent) throw new ApiError(404, 'Comment not found')
  await loadViewablePost(user, parent.post)
  return list(user, { parent: parent._id }, 1, cursor, limit)
}

async function loadViewableComment(user, id) {
  const comment = await Comment.findById(id)
  if (!comment) throw new ApiError(404, 'Comment not found')
  await loadViewablePost(user, comment.post)
  return comment
}

export async function likeComment(user, id) {
  const c = await loadViewableComment(user, id)
  try {
    await Like.create({ user: user._id, targetType: 'comment', target: c._id })
    await Comment.updateOne({ _id: c._id }, { $inc: { likesCount: 1 } })
    safe(notify({ recipient: c.author, actor: user._id, type: 'like', post: c.post, text: 'liked your comment', dedupe: true, dedupeTarget: `c${c._id}` }))
  } catch (e) { if (e.code !== 11000) throw e }
  const fresh = await Comment.findById(c._id).select('likesCount')
  return { liked: true, likesCount: Math.max(0, fresh.likesCount) }
}

export async function unlikeComment(user, id) {
  const removed = await Like.findOneAndDelete({ user: user._id, targetType: 'comment', target: id })
  if (removed) await Comment.updateOne({ _id: id }, { $inc: { likesCount: -1 } })
  const fresh = await Comment.findById(id).select('likesCount')
  return { liked: false, likesCount: Math.max(0, fresh?.likesCount || 0) }
}

export async function deleteComment(user, id) {
  const c = await Comment.findById(id)
  if (!c) throw new ApiError(404, 'Comment not found')
  if (!c.author.equals(user._id)) throw new ApiError(403, 'You can only delete your own comments')
  let ids = [c._id]
  if (!c.parent) ids = ids.concat(await Comment.find({ parent: c._id }).distinct('_id')) // replies go with their parent
  await Promise.all([
    Comment.deleteMany({ _id: { $in: ids } }),
    Like.deleteMany({ targetType: 'comment', target: { $in: ids } }),
    Post.updateOne({ _id: c.post }, { $inc: { commentsCount: -ids.length } }),
    c.parent ? Comment.updateOne({ _id: c.parent }, { $inc: { repliesCount: -1 } }) : null,
  ])
  return { removed: ids.length }
}
