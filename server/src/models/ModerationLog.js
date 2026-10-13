import mongoose from 'mongoose'

export const MOD_ACTIONS = ['user_deactivate', 'user_activate', 'user_remove', 'post_remove', 'reel_remove', 'comment_remove', 'report_update']

// Append-only record of every admin action (who, what, why)
const logSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: MOD_ACTIONS, required: true },
    targetType: { type: String, enum: ['user', 'post', 'reel', 'comment', 'report'], required: true },
    target: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetLabel: { type: String, default: '', maxlength: 100 }, // e.g. the username, kept even after the target is gone
    reason: { type: String, default: '', maxlength: 500 },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)
logSchema.index({ createdAt: -1 })

export default mongoose.model('ModerationLog', logSchema)
