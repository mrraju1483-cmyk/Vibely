// One-off, safe to re-run: syncs Post.authorPrivate and rebuilds the Hashtag collection for posts made before Phase 5.
// Usage: npm run backfill:discovery
import mongoose from 'mongoose'
import { env } from '../src/config/env.js'
import User from '../src/models/User.js'
import Post from '../src/models/Post.js'
import Hashtag from '../src/models/Hashtag.js'

await mongoose.connect(env.mongoUri)
const priv = await User.find({ isPrivate: true }).distinct('_id')
const a = await Post.updateMany({ author: { $in: priv } }, { authorPrivate: true })
const b = await Post.updateMany({ author: { $nin: priv } }, { authorPrivate: false })
const rows = await Post.aggregate([
  { $match: { visibility: 'public', authorPrivate: { $ne: true }, 'hashtags.0': { $exists: true } } },
  { $unwind: '$hashtags' }, { $group: { _id: '$hashtags', n: { $sum: 1 }, last: { $max: '$createdAt' } } },
])
await Hashtag.deleteMany({})
if (rows.length) await Hashtag.insertMany(rows.map((r) => ({ name: r._id, postsCount: r.n, lastUsedAt: r.last })))
await Post.syncIndexes()
console.log(`posts flagged private: ${a.modifiedCount}, public: ${b.modifiedCount}, hashtags rebuilt: ${rows.length}`)
await mongoose.disconnect()
