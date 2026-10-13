import ModerationLog from '../../models/ModerationLog.js'

// An audit failure must never be silent for destructive actions, so this one is awaited (and may throw)
export const logAction = (admin, action, targetType, target, { targetLabel = '', reason = '', meta = null } = {}) =>
  ModerationLog.create({ admin: admin._id, action, targetType, target, targetLabel: String(targetLabel).slice(0, 100), reason, meta })
