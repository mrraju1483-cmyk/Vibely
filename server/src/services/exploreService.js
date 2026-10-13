import mongoose from 'mongoose'
import Post from '../models/Post.js'
import User from '../models/User.js'
import Follow from '../models/Follow.js'
import Like from '../models/Like.js'
import Hashtag from '../models/Hashtag.js'
import { ApiError } from '../utils/ApiError.js'
import { cached } from '../utils/cache.js'
import { blockedIdSet, followStatusMap, toCard } from '../utils/relations.js'
import { serialize, AUTHOR_FIELDS } from './postService.js'
import { validateSearchQuery } from '../validators/userValidators.js'
import { searchUsers } from './userService.js'

const { ObjectId } = mongoose.Types
const DAY = 86400000
const TRENDING_DAYS = 14
const TRENDING_CANDIDATES = 1000 // newest N discoverable posts are scored: keeps the work bounded
const TAG = /^[\p{L}\p{N}_]{1,50}$/u
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const sinceId = (days) => ObjectId.createFromTime(Math.floor((Date.now() - days * DAY) / 1000)) // _id order == time order
const fmtCount = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n))

export const parseTag = (name) => {
  const tag = String(name || '').replace(/^#+/, '').toLowerCase()
  if (!TAG.test(tag)) throw new ApiError(400, 'Invalid hashtag')
  return tag
}

// Explore only ever shows public posts from public accounts, minus anyone blocked either way
async function discoverable(viewer) {
  const hidden = [...(await blockedIdSet(viewer._id))].map((id) => new ObjectId(id))
  return { visibility: 'public', authorPrivate: { $ne: true }, ...(hidden.length && { author: { $nin: hidden } }) }
}

async function hydrate(ids, viewerId) {
  if (!ids.length) return []
  const docs = await Post.find({ _id: { $in: ids } }).populate('author', AUTHOR_FIELDS)
  const byId = new Map(docs.map((d) => [d._id.toString(), d]))
  return serialize(ids.map((id) => byId.get(id.toString())).filter(Boolean), viewerId)
}

async function cursorPage(filter, cursor, limit, viewerId) {
  const query = { ...filter }
  if (cursor) query._id = { $lt: cursor }
  const rows = await Post.find(query).sort({ _id: -1 }).limit(limit + 1).populate('author', AUTHOR_FIELDS)
  const hasMore = rows.length > limit
  const slice = rows.slice(0, limit)
  return { posts: await serialize(slice, viewerId), nextCursor: hasMore ? slice[slice.length - 1]._id.toString() : null }
}

// ---------- Posts ----------
// score = (likes + 2*comments + 3*shares + 1) / (ageHours + 2)^1.5   -> engagement, decayed by age
export async function trendingPosts(viewer, { page, limit }) {
  const skip = (page - 1) * limit
  if (skip >= TRENDING_CANDIDATES) return { posts: [], nextPage: null }
  const filter = await discoverable(viewer)
  const rows = await Post.aggregate([
    { $match: { ...filter, _id: { $gte: sinceId(TRENDING_DAYS) } } },
    { $sort: { _id: -1 } },
    { $limit: TRENDING_CANDIDATES },
    { $addFields: { score: { $divide: [
      { $add: [{ $max: ['$likesCount', 0] }, { $multiply: [2, { $max: ['$commentsCount', 0] }] }, { $multiply: [3, '$sharesCount'] }, 1] },
      { $pow: [{ $add: [{ $divide: [{ $subtract: [new Date(), '$createdAt'] }, 3600000] }, 2] }, 1.5] },
    ] } } },
    { $sort: { score: -1, _id: -1 } },
    { $skip: skip },
    { $limit: limit + 1 },
    { $project: { _id: 1 } },
  ])
  const ids = rows.map((r) => r._id)
  return { posts: await hydrate(ids.slice(0, limit), viewer._id), nextPage: ids.length > limit ? page + 1 : null }
}

export async function recentPosts(viewer, { cursor, limit }) {
  return cursorPage(await discoverable(viewer), cursor, limit, viewer._id)
}

export async function hashtagPosts(viewer, name, { cursor, limit }) {
  const tag = parseTag(name)
  const [result, meta] = await Promise.all([
    cursorPage({ ...(await discoverable(viewer)), hashtags: tag }, cursor, limit, viewer._id),
    Hashtag.findOne({ name: tag }),
  ])
  return { hashtag: { name: tag, postsCount: meta?.postsCount || 0 }, ...result }
}

export async function searchPosts(viewer, rawQuery, { page, limit }) {
  const q = validateSearchQuery(rawQuery)
  const filter = await discoverable(viewer)
  const skip = (page - 1) * limit
  let query
  if (q.startsWith('#')) {
    const tag = q.slice(1).toLowerCase()
    if (!TAG.test(tag)) return { posts: [], nextPage: null }
    query = Post.find({ ...filter, hashtags: tag }).sort({ _id: -1 })
  } else {
    const text = q.replace(/["\\]/g, ' ').replace(/(^|\s)-+/g, '$1').trim() // no phrase/negation operators from users
    if (!text) return { posts: [], nextPage: null }
    query = Post.find({ ...filter, $text: { $search: text } }, { score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } })
  }
  const rows = await query.skip(skip).limit(limit + 1).populate('author', AUTHOR_FIELDS)
  const slice = rows.slice(0, limit)
  return { posts: await serialize(slice, viewer._id), nextPage: rows.length > limit ? page + 1 : null }
}

// ---------- Hashtags ----------
export const trendingHashtags = () => cached('trendingHashtags', 5 * 60 * 1000, async () => {
  const rows = await Post.aggregate([
    { $match: { visibility: 'public', authorPrivate: { $ne: true }, _id: { $gte: sinceId(TRENDING_DAYS) }, 'hashtags.0': { $exists: true } } },
    { $sort: { _id: -1 } },
    { $limit: 5000 },
    { $unwind: '$hashtags' },
    { $group: { _id: '$hashtags', posts: { $sum: 1 }, engagement: { $sum: { $add: [{ $max: ['$likesCount', 0] }, { $multiply: [2, { $max: ['$commentsCount', 0] }] }] } } } },
    { $addFields: { score: { $add: [{ $multiply: ['$posts', 3] }, '$engagement'] } } },
    { $sort: { score: -1, _id: 1 } },
    { $limit: 12 },
  ])
  return { hashtags: rows.map((r) => ({ name: r._id, recentPosts: r.posts })) }
})

export async function searchHashtags(rawQuery) {
  const q = validateSearchQuery(rawQuery)
  const tag = q.replace(/^#+/, '').toLowerCase()
  if (!TAG.test(tag)) return { hashtags: [] }
  const rows = await Hashtag.find({ name: new RegExp('^' + escapeRegex(tag)), postsCount: { $gt: 0 } }).sort({ postsCount: -1, name: 1 }).limit(20)
  return { hashtags: rows.map((h) => ({ name: h.name, postsCount: h.postsCount })) }
}

// ---------- People ----------
const getPopular = () => cached('popularUsers', 5 * 60 * 1000, async () => {
  const rows = await Follow.aggregate([
    { $match: { status: 'accepted' } },
    { $group: { _id: '$following', followers: { $sum: 1 } } },
    { $sort: { followers: -1, _id: 1 } },
    { $limit: 60 },
  ])
  return rows.map((r) => ({ id: r._id.toString(), followers: r.followers }))
})

export async function popularUsers(viewer, limit = 12) {
  const [pop, hidden] = await Promise.all([getPopular(), blockedIdSet(viewer._id)])
  const picked = pop.filter((p) => p.id !== viewer._id.toString() && !hidden.has(p.id)).slice(0, limit * 2)
  const users = await User.find({ _id: { $in: picked.map((p) => p.id) }, isActive: true, isVerified: true }).select('fullName username profilePhoto isPrivate')
  const byId = new Map(users.map((u) => [u._id.toString(), u]))
  const statuses = await followStatusMap(viewer._id, users.map((u) => u._id))
  const cards = picked.filter((p) => byId.has(p.id)).slice(0, limit)
    .map((p) => ({ ...toCard(byId.get(p.id), statuses.get(p.id) || 'none'), note: `${fmtCount(p.followers)} followers` }))
  return { users: cards }
}

// Recommendation score (easy to read and tune):
//   3 x mutual followers   (people you follow also follow them)
// + 2 x your recent likes on their posts
// + 1 + 0.5 x recent posts (max 3)   if they posted in the last 14 days
// + log2(1 + followers)    popularity
export async function recommendedUsers(viewer, limit = 12) {
  const me = viewer._id
  const [rels, hidden] = await Promise.all([Follow.find({ follower: me }).select('following status'), blockedIdSet(me)])
  const followingIds = rels.filter((r) => r.status === 'accepted').map((r) => r.following)
  const excluded = new Set([me.toString(), ...rels.map((r) => r.following.toString()), ...hidden])
  const excludedIds = [...excluded].map((id) => new ObjectId(id))

  const [mutualRows, likeRows, activeRows, popular] = await Promise.all([
    followingIds.length ? Follow.aggregate([
      { $match: { follower: { $in: followingIds }, status: 'accepted', following: { $nin: excludedIds } } },
      { $group: { _id: '$following', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 60 },
    ]) : [],
    Like.aggregate([
      { $match: { user: me, targetType: 'post' } }, { $sort: { _id: -1 } }, { $limit: 200 },
      { $lookup: { from: 'posts', localField: 'target', foreignField: '_id', as: 'p' } }, { $unwind: '$p' },
      { $match: { 'p.author': { $nin: excludedIds } } },
      { $group: { _id: '$p.author', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 60 },
    ]),
    Post.aggregate([
      { $match: { visibility: 'public', authorPrivate: { $ne: true }, _id: { $gte: sinceId(14) }, author: { $nin: excludedIds } } },
      { $group: { _id: '$author', posts: { $sum: 1 } } }, { $sort: { posts: -1 } }, { $limit: 60 },
    ]),
    getPopular(),
  ])

  const score = new Map()
  const reason = new Map()
  const bump = (id, pts, why) => { score.set(id, (score.get(id) || 0) + pts); if (!reason.has(id)) reason.set(id, why) }
  mutualRows.forEach((r) => bump(r._id.toString(), 3 * r.n, `${r.n} mutual ${r.n === 1 ? 'follower' : 'followers'}`))
  likeRows.forEach((r) => bump(r._id.toString(), 2 * r.n, 'You liked their posts'))
  activeRows.forEach((r) => bump(r._id.toString(), 1 + 0.5 * Math.min(r.posts, 3), 'Active recently'))
  popular.forEach((p) => { if (!excluded.has(p.id)) bump(p.id, 0, 'Popular on Vibely') })
  if (!score.size) return { users: [] }

  const ids = [...score.keys()]
  const [users, counts] = await Promise.all([
    User.find({ _id: { $in: ids }, isActive: true, isVerified: true }).select('fullName username profilePhoto isPrivate'),
    Follow.aggregate([{ $match: { following: { $in: ids.map((i) => new ObjectId(i)) }, status: 'accepted' } }, { $group: { _id: '$following', n: { $sum: 1 } } }]),
  ])
  const followers = new Map(counts.map((c) => [c._id.toString(), c.n]))
  const ranked = users
    .map((u) => ({ u, total: score.get(u._id.toString()) + Math.log2(1 + (followers.get(u._id.toString()) || 0)) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
  return { users: ranked.map(({ u }) => ({ ...toCard(u, 'none'), note: reason.get(u._id.toString()) })) }
}

export async function searchAll(viewer, type, q, paging) {
  if (type === 'users') return searchUsers(viewer, q, paging)
  if (type === 'posts') return searchPosts(viewer, q, paging)
  if (type === 'hashtags') return searchHashtags(q)
  throw new ApiError(400, 'type must be users, posts or hashtags')
}
