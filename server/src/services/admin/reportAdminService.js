import Report from '../../models/Report.js'
import Post from '../../models/Post.js'
import Reel from '../../models/Reel.js'
import User from '../../models/User.js'
import { ApiError } from '../../utils/ApiError.js'
import { REPORT_REASONS } from '../../models/Report.js'
import { validateReportUpdate, qString, oneOf } from '../../validators/adminValidators.js'
import { purgePost } from '../postService.js'
import { purgeReel } from '../reelService.js'
import { logAction } from './audit.js'
import { setActive } from './userAdminService.js'

// What the report is about, even if the target is hidden from normal users
async function previews(reports) {
  const ids = (type) => reports.filter((r) => r.targetType === type).map((r) => r.target)
  const [posts, reels, users] = await Promise.all([
    Post.find({ _id: { $in: ids('post') } }).populate('author', 'username'),
    Reel.find({ _id: { $in: ids('reel') } }).populate('author', 'username'),
    User.find({ _id: { $in: ids('user') } }).select('username fullName bio profilePhoto isActive removedAt'),
  ])
  const map = new Map()
  posts.forEach((p) => map.set(`post:${p._id}`, { exists: true, label: `Post by @${p.author?.username}`, snippet: p.caption.slice(0, 200), mediaUrl: p.media, mediaType: p.mediaType, authorId: p.author?._id.toString(), authorUsername: p.author?.username }))
  reels.forEach((r) => map.set(`reel:${r._id}`, { exists: true, label: `Reel by @${r.author?.username}`, snippet: r.caption.slice(0, 200), mediaUrl: r.video, mediaType: 'video', authorId: r.author?._id.toString(), authorUsername: r.author?.username }))
  users.forEach((u) => map.set(`user:${u._id}`, { exists: true, label: `User @${u.username}`, snippet: u.bio?.slice(0, 200) || '', authorId: u._id.toString(), authorUsername: u.username, deactivated: !u.isActive }))
  return (r) => map.get(`${r.targetType}:${r.target}`) || { exists: false, label: `${r.targetType} (already removed)` }
}

const dto = (r, preview, reviewer) => ({
  id: r._id.toString(), reporter: r.reporter ? { id: r.reporter._id.toString(), username: r.reporter.username } : { id: null, username: 'unknown' },
  targetType: r.targetType, target: r.target.toString(), reason: r.reason, details: r.details, status: r.status, adminResponse: r.adminResponse,
  createdAt: r.createdAt, reviewedAt: r.reviewedAt, reviewedBy: reviewer ? reviewer.username : null, preview: preview(r),
})

export async function listReports(q, { cursor, limit }) {
  const query = {}
  const status = oneOf(q.status, ['open', 'resolved', 'rejected', 'all'], 'status', 'open')
  const type = oneOf(q.type, ['post', 'reel', 'user'], 'type')
  const reason = oneOf(q.reason, REPORT_REASONS, 'reason')
  if (status !== 'all') query.status = status
  if (type) query.targetType = type
  if (reason) query.reason = reason
  if (cursor) query._id = { $lt: cursor }
  const rows = await Report.find(query).sort({ _id: -1 }).limit(limit + 1).populate('reporter', 'username').populate('reviewedBy', 'username')
  const slice = rows.slice(0, limit)
  const preview = await previews(slice)
  return { reports: slice.map((r) => dto(r, preview, r.reviewedBy)), nextCursor: rows.length > limit ? slice[slice.length - 1]._id.toString() : null }
}

async function load(id) {
  const r = await Report.findById(id).populate('reporter', 'username').populate('reviewedBy', 'username')
  if (!r) throw new ApiError(404, 'Report not found')
  return r
}

export async function getReport(id) {
  const r = await load(id)
  return dto(r, await previews([r]), r.reviewedBy)
}

// Update the status/response and optionally act on the reported content or user in one step
export async function updateReport(admin, id, body) {
  const v = validateReportUpdate(body)
  const r = await load(id)
  const outcome = {}

  if (v.action === 'remove_content') {
    if (r.targetType === 'user') throw new ApiError(400, 'This report is about a user. Use "deactivate user" instead.')
    const Model = r.targetType === 'post' ? Post : Reel
    const item = await Model.findById(r.target)
    if (item) { await (r.targetType === 'post' ? purgePost(item) : purgeReel(item)); outcome.contentRemoved = true } else outcome.contentRemoved = false
    await Report.updateMany({ targetType: r.targetType, target: r.target, status: 'open', _id: { $ne: r._id } }, { status: 'resolved', adminResponse: 'Content removed by a moderator.', reviewedBy: admin._id, reviewedAt: new Date() })
  }
  if (v.action === 'deactivate_user') {
    let userId = r.target
    if (r.targetType !== 'user') {
      const item = await (r.targetType === 'post' ? Post : Reel).findById(r.target).select('author')
      userId = item?.author
    }
    if (!userId) throw new ApiError(400, 'The author could not be found (the content may already be removed).')
    await setActive(admin, userId, false, v.reason)
    outcome.userDeactivated = true
  }

  r.status = v.status
  r.adminResponse = v.adminResponse
  r.reviewedBy = admin._id
  r.reviewedAt = new Date()
  await r.save()
  await logAction(admin, 'report_update', 'report', r._id, { targetLabel: `${r.targetType}:${r.reason}`, reason: v.reason || v.adminResponse.slice(0, 200), meta: { status: v.status, action: v.action, ...outcome } })
  const fresh = await load(id)
  return dto(fresh, await previews([fresh]), fresh.reviewedBy)
}
