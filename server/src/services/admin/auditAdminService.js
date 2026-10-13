import ModerationLog from '../../models/ModerationLog.js'

export async function listAudit({ cursor, limit }) {
  const query = cursor ? { _id: { $lt: cursor } } : {}
  const rows = await ModerationLog.find(query).sort({ _id: -1 }).limit(limit + 1).populate('admin', 'username')
  const slice = rows.slice(0, limit)
  return {
    entries: slice.map((e) => ({ id: e._id.toString(), admin: e.admin?.username || 'unknown', action: e.action, targetType: e.targetType, target: e.target.toString(), targetLabel: e.targetLabel, reason: e.reason, meta: e.meta, createdAt: e.createdAt })),
    nextCursor: rows.length > limit ? slice[slice.length - 1]._id.toString() : null,
  }
}
