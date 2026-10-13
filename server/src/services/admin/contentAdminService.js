import Post from '../../models/Post.js'
import Reel from '../../models/Reel.js'
import Comment from '../../models/Comment.js'
import ReelComment from '../../models/ReelComment.js'
import Report from '../../models/Report.js'
import { ApiError } from '../../utils/ApiError.js'
import { purgePost } from '../postService.js'
import { purgeReel } from '../reelService.js'
import { logAction } from './audit.js'
import { purgeComments, purgeReelComments } from './purge.js'
import { qString, oneOf } from '../../validators/adminValidators.js'

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const who = (u) => (u ? { id: u._id.toString(), username: u.username } : { id: null, username: 'unknown' })
const page = (rows, limit, map) => {
  const slice = rows.slice(0, limit)
  return { items: slice.map(map), nextCursor: rows.length > limit ? slice[slice.length - 1]._id.toString() : null }
}

async function openReportCounts(type, ids) {
  const rows = await Report.aggregate([{ $match: { targetType: type, target: { $in: ids }, status: 'open' } }, { $group: { _id: '$target', n: { $sum: 1 } } }])
  return new Map(rows.map((r) => [r._id.toString(), r.n]))
}

export async function listPosts(q, { cursor, limit }) {
  const search = qString(q.q, 'q')
  const query = {}
  if (search) query.$or = [{ caption: new RegExp(escapeRegex(search), 'i') }, { hashtags: search.replace(/^#/, '').toLowerCase() }]
  if (cursor) query._id = { $lt: cursor }
  const rows = await Post.find(query).sort({ _id: -1 }).limit(limit + 1).populate('author', 'username')
  const counts = await openReportCounts('post', rows.map((r) => r._id))
  return page(rows, limit, (p) => ({ id: p._id.toString(), author: who(p.author), caption: p.caption.slice(0, 200), mediaUrl: p.media, mediaType: p.mediaType, visibility: p.visibility, likesCount: p.likesCount, commentsCount: p.commentsCount, createdAt: p.createdAt, openReports: counts.get(p._id.toString()) || 0 }))
}

export async function listReels(q, { cursor, limit }) {
  const search = qString(q.q, 'q')
  const query = {}
  if (search) query.$or = [{ caption: new RegExp(escapeRegex(search), 'i') }, { hashtags: search.replace(/^#/, '').toLowerCase() }]
  if (cursor) query._id = { $lt: cursor }
  const rows = await Reel.find(query).sort({ _id: -1 }).limit(limit + 1).populate('author', 'username')
  const counts = await openReportCounts('reel', rows.map((r) => r._id))
  return page(rows, limit, (r) => ({ id: r._id.toString(), author: who(r.author), caption: r.caption.slice(0, 200), mediaUrl: r.video, mediaType: 'video', likesCount: r.likesCount, commentsCount: r.commentsCount, createdAt: r.createdAt, openReports: counts.get(r._id.toString()) || 0 }))
}

export async function listComments(q, { cursor, limit }) {
  const kind = oneOf(q.kind, ['post', 'reel'], 'kind', 'post')
  const search = qString(q.q, 'q')
  const Model = kind === 'reel' ? ReelComment : Comment
  const query = {}
  if (search) query.text = new RegExp(escapeRegex(search), 'i')
  if (cursor) query._id = { $lt: cursor }
  const rows = await Model.find(query).sort({ _id: -1 }).limit(limit + 1).populate('author', 'username')
  return { kind, ...page(rows, limit, (c) => ({ id: c._id.toString(), author: who(c.author), text: c.text, targetId: (kind === 'reel' ? c.reel : c.post).toString(), isReply: !!c.parent, createdAt: c.createdAt })) }
}

// Closing the open reports about removed content keeps the report queue honest
async function closeReports(admin, type, target, note) {
  await Report.updateMany({ targetType: type, target, status: 'open' }, { status: 'resolved', adminResponse: note, reviewedBy: admin._id, reviewedAt: new Date() })
}

export async function removePost(admin, id, reason) {
  const post = await Post.findById(id).populate('author', 'username')
  if (!post) throw new ApiError(404, 'Post not found')
  await purgePost(post)
  await closeReports(admin, 'post', post._id, 'Content removed by a moderator.')
  await logAction(admin, 'post_remove', 'post', post._id, { targetLabel: post.author?.username, reason, meta: { caption: post.caption.slice(0, 100) } })
}

export async function removeReel(admin, id, reason) {
  const reel = await Reel.findById(id).populate('author', 'username')
  if (!reel) throw new ApiError(404, 'Reel not found')
  await purgeReel(reel)
  await closeReports(admin, 'reel', reel._id, 'Content removed by a moderator.')
  await logAction(admin, 'reel_remove', 'reel', reel._id, { targetLabel: reel.author?.username, reason, meta: { caption: reel.caption.slice(0, 100) } })
}

export async function removeComment(admin, id, kind, reason) {
  kind = oneOf(kind, ['post', 'reel'], 'kind', 'post')
  const Model = kind === 'reel' ? ReelComment : Comment
  const c = await Model.findById(id).populate('author', 'username')
  if (!c) throw new ApiError(404, 'Comment not found')
  const removed = kind === 'reel' ? await purgeReelComments({ _id: c._id }) : await purgeComments({ _id: c._id })
  await logAction(admin, 'comment_remove', 'comment', c._id, { targetLabel: c.author?.username, reason, meta: { kind, text: c.text.slice(0, 100), removed } })
  return { removed }
}
