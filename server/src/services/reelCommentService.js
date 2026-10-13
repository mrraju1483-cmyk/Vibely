import Reel from '../models/Reel.js'
import ReelComment from '../models/ReelComment.js'
import { ApiError } from '../utils/ApiError.js'
import { blockedIdSet } from '../utils/relations.js'
import { validateComment } from '../validators/postValidators.js'
import { loadViewableReel } from './reelService.js'
import { authorDto, AUTHOR_FIELDS } from './postService.js'
import { notify, notifyMentions, safe } from './notificationService.js'

const dto = (c, viewerId) => ({
  id: c._id.toString(), reelId: c.reel.toString(), author: authorDto(c.author), text: c.text,
  isMine: c.author._id.equals(viewerId), createdAt: c.createdAt,
})

export async function addComment(user, reelId, body) {
  const { text } = validateComment({ text: body?.text })
  const reel = await loadViewableReel(user, reelId)
  const comment = await ReelComment.create({ reel: reel._id, author: user._id, text })
  await Reel.updateOne({ _id: reel._id }, { $inc: { commentsCount: 1 } })
  safe(notify({ recipient: reel.author._id, actor: user._id, type: 'comment', reel: reel._id, text }))
  safe(notifyMentions({ actor: user._id, text, reel: reel._id, exclude: [reel.author._id] }))
  comment.author = user
  return dto(comment, user._id)
}

export async function listComments(user, reelId, { cursor, limit }) {
  const reel = await loadViewableReel(user, reelId)
  const query = { reel: reel._id }
  if (cursor) query._id = { $lt: cursor }
  const rows = await ReelComment.find(query).sort({ _id: -1 }).limit(limit + 1).populate('author', AUTHOR_FIELDS)
  const hasMore = rows.length > limit
  const slice = rows.slice(0, limit)
  const hidden = await blockedIdSet(user._id)
  const visible = slice.filter((c) => c.author && c.author.isActive && !hidden.has(c.author._id.toString()))
  return { comments: visible.map((c) => dto(c, user._id)), nextCursor: hasMore ? slice[slice.length - 1]._id.toString() : null }
}

export async function deleteComment(user, id) {
  const c = await ReelComment.findById(id)
  if (!c) throw new ApiError(404, 'Comment not found')
  if (!c.author.equals(user._id)) throw new ApiError(403, 'You can only delete your own comments')
  await ReelComment.deleteOne({ _id: c._id })
  await Reel.updateOne({ _id: c.reel }, { $inc: { commentsCount: -1 } })
}
