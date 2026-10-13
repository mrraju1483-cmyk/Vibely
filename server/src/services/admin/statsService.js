import User from '../../models/User.js'
import Post from '../../models/Post.js'
import Reel from '../../models/Reel.js'
import Story from '../../models/Story.js'
import Comment from '../../models/Comment.js'
import ReelComment from '../../models/ReelComment.js'
import Like from '../../models/Like.js'
import Message from '../../models/Message.js'
import Report from '../../models/Report.js'

const DAY = 24 * 60 * 60 * 1000
const DAYS = 14

// Counts per UTC day for the last 14 days, zero-filled so charts have no gaps
async function daily(Model) {
  const days = []
  const start = new Date(); start.setUTCHours(0, 0, 0, 0)
  for (let i = DAYS - 1; i >= 0; i--) days.push(new Date(start.getTime() - i * DAY).toISOString().slice(0, 10))
  const rows = await Model.aggregate([
    { $match: { createdAt: { $gte: new Date(`${days[0]}T00:00:00.000Z`) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
  ])
  const map = new Map(rows.map((r) => [r._id, r.n]))
  return days.map((d) => ({ date: d, value: map.get(d) || 0 }))
}

export async function getStats() {
  const now = new Date()
  const d1 = new Date(now - DAY), d7 = new Date(now - 7 * DAY)
  const [
    users, activeAccounts, verified, deactivated, newUsers7, seen24, seen7,
    posts, posts7, reels, reels7, activeStories, comments, reelComments, likes, messages7,
    reportsByStatus, reportsByReason, series,
  ] = await Promise.all([
    User.estimatedDocumentCount(), User.countDocuments({ isActive: true }), User.countDocuments({ isVerified: true }),
    User.countDocuments({ isActive: false, removedAt: null }), User.countDocuments({ createdAt: { $gte: d7 } }),
    User.countDocuments({ isActive: true, lastSeenAt: { $gte: d1 } }), User.countDocuments({ isActive: true, lastSeenAt: { $gte: d7 } }),
    Post.estimatedDocumentCount(), Post.countDocuments({ createdAt: { $gte: d7 } }),
    Reel.estimatedDocumentCount(), Reel.countDocuments({ createdAt: { $gte: d7 } }),
    Story.countDocuments({ expiresAt: { $gt: now } }),
    Comment.estimatedDocumentCount(), ReelComment.estimatedDocumentCount(), Like.estimatedDocumentCount(),
    Message.countDocuments({ createdAt: { $gte: d7 } }),
    Report.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Report.aggregate([{ $match: { status: 'open' } }, { $group: { _id: '$reason', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    Promise.all([daily(User), daily(Post), daily(Comment), daily(Like)]),
  ])
  const rep = Object.fromEntries(reportsByStatus.map((r) => [r._id, r.n]))
  return {
    users: { total: users, activeAccounts, verified, deactivated, newLast7Days: newUsers7, seenLast24h: seen24, seenLast7Days: seen7 },
    content: { posts, postsLast7Days: posts7, reels, reelsLast7Days: reels7, activeStories, comments: comments + reelComments, likes, messagesLast7Days: messages7 },
    reports: { open: rep.open || 0, resolved: rep.resolved || 0, rejected: rep.rejected || 0, openByReason: reportsByReason.map((r) => ({ reason: r._id, count: r.n })) },
    series: { newUsers: series[0], newPosts: series[1], newComments: series[2], newLikes: series[3] },
    generatedAt: now,
  }
}
