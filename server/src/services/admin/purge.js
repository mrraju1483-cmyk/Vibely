import Post from '../../models/Post.js'
import Comment from '../../models/Comment.js'
import ReelComment from '../../models/ReelComment.js'
import Reel from '../../models/Reel.js'
import Like from '../../models/Like.js'
import SavedPost from '../../models/SavedPost.js'
import SavedReel from '../../models/SavedReel.js'
import ReelView from '../../models/ReelView.js'
import Story from '../../models/Story.js'
import Follow from '../../models/Follow.js'
import Block from '../../models/Block.js'
import Notification from '../../models/Notification.js'
import OTPVerification from '../../models/OTPVerification.js'
import AIRequest from '../../models/AIRequest.js'
import { purgePost } from '../postService.js'
import { purgeReel } from '../reelService.js'
import { deleteMedia } from '../media/index.js'

const bump = (map, key) => map.set(String(key), (map.get(String(key)) || 0) + 1)
const decrement = (Model, map, field) =>
  map.size ? Model.bulkWrite([...map].map(([id, n]) => ({ updateOne: { filter: { _id: id }, update: { $inc: { [field]: -n } } } }))) : null

// Deletes post comments matching `filter` plus their replies, and keeps the counters right
export async function purgeComments(filter) {
  const tops = await Comment.find(filter).select('_id post parent')
  if (!tops.length) return 0
  const topIds = tops.map((c) => c._id)
  const replies = await Comment.find({ parent: { $in: topIds }, _id: { $nin: topIds } }).select('_id post parent')
  const all = [...tops, ...replies]
  const gone = new Set(all.map((c) => String(c._id)))
  const postDec = new Map(), parentDec = new Map()
  for (const c of all) {
    bump(postDec, c.post)
    if (c.parent && !gone.has(String(c.parent))) bump(parentDec, c.parent)
  }
  const ids = all.map((c) => c._id)
  await Promise.all([
    Comment.deleteMany({ _id: { $in: ids } }),
    Like.deleteMany({ targetType: 'comment', target: { $in: ids } }),
    decrement(Post, postDec, 'commentsCount'),
    decrement(Comment, parentDec, 'repliesCount'),
  ])
  return ids.length
}

export async function purgeReelComments(filter) {
  const rows = await ReelComment.find(filter).select('_id reel')
  if (!rows.length) return 0
  const dec = new Map()
  rows.forEach((c) => bump(dec, c.reel))
  await Promise.all([ReelComment.deleteMany({ _id: { $in: rows.map((r) => r._id) } }), decrement(Reel, dec, 'commentsCount')])
  return rows.length
}

// Removes everything a user created or took part in. Used when an admin removes an account.
export async function purgeUserContent(userId) {
  const counts = { posts: 0, reels: 0, stories: 0, comments: 0 }
  for await (const post of Post.find({ author: userId })) { await purgePost(post); counts.posts++ }
  for await (const reel of Reel.find({ author: userId })) { await purgeReel(reel); counts.reels++ }

  const stories = await Story.find({ user: userId }).select('mediaKey')
  await Promise.all(stories.map((s) => deleteMedia(s.mediaKey).catch(() => {})))
  await Story.deleteMany({ user: userId })
  counts.stories = stories.length
  await Story.updateMany({ 'viewers.user': userId }, { $pull: { viewers: { user: userId } }, $inc: { viewersCount: -1 } })

  counts.comments = (await purgeComments({ author: userId })) + (await purgeReelComments({ author: userId }))

  // Likes they gave: take them back off the counters
  const likes = await Like.find({ user: userId }).select('targetType target')
  const by = { post: new Map(), comment: new Map(), reel: new Map() }
  likes.forEach((l) => bump(by[l.targetType], l.target))
  await Promise.all([decrement(Post, by.post, 'likesCount'), decrement(Comment, by.comment, 'likesCount'), decrement(Reel, by.reel, 'likesCount')])

  await Promise.all([
    Like.deleteMany({ user: userId }), SavedPost.deleteMany({ user: userId }), SavedReel.deleteMany({ user: userId }),
    ReelView.deleteMany({ user: userId }), OTPVerification.deleteMany({ user: userId }), AIRequest.deleteMany({ user: userId }),
    Follow.deleteMany({ $or: [{ follower: userId }, { following: userId }] }),
    Block.deleteMany({ $or: [{ blocker: userId }, { blocked: userId }] }),
    Notification.deleteMany({ $or: [{ recipient: userId }, { actor: userId }] }),
  ])
  return counts
}
