import Hashtag from '../models/Hashtag.js'
import Post from '../models/Post.js'

const cleanup = () => Hashtag.deleteMany({ postsCount: { $lte: 0 } })

export async function addForPost(tags) {
  if (!tags?.length) return
  const now = new Date()
  await Hashtag.bulkWrite(tags.map((name) => ({
    updateOne: { filter: { name }, update: { $inc: { postsCount: 1 }, $set: { lastUsedAt: now } }, upsert: true },
  })))
}

export async function removeForPost(tags) {
  if (!tags?.length) return
  await Hashtag.bulkWrite(tags.map((name) => ({ updateOne: { filter: { name }, update: { $inc: { postsCount: -1 } } } })))
  await cleanup()
}

// When an account goes private, its public posts stop counting toward hashtags (and count again when public)
export async function adjustForPrivacy(userId, nowPrivate) {
  const rows = await Post.aggregate([
    { $match: { author: userId, visibility: 'public', 'hashtags.0': { $exists: true } } },
    { $unwind: '$hashtags' },
    { $group: { _id: '$hashtags', n: { $sum: 1 } } },
  ])
  if (!rows.length) return
  const sign = nowPrivate ? -1 : 1
  await Hashtag.bulkWrite(rows.map((r) => ({
    updateOne: { filter: { name: r._id }, update: { $inc: { postsCount: sign * r.n } }, upsert: !nowPrivate },
  })))
  await cleanup()
}
