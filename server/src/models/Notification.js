import mongoose from 'mongoose'

export const NOTIFICATION_TYPES = ['like', 'comment', 'reply', 'mention', 'follow', 'follow_request', 'follow_accept', 'message', 'missed_call']
const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model, default: null })

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    post: ref('Post'), reel: ref('Reel'), conversation: ref('Conversation'), call: ref('Call'),
    text: { type: String, default: '', maxlength: 200 }, // short preview (comment text, message snippet)
    count: { type: Number, default: 1 }, // collapsed message notifications count the messages
    dedupeKey: { type: String }, // set for one-time events (likes, follows) so repeats do not spam
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)
notificationSchema.index({ recipient: 1, _id: -1 })
notificationSchema.index({ recipient: 1, read: 1 })
notificationSchema.index({ recipient: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } })
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }) // old notifications clean themselves up

export default mongoose.model('Notification', notificationSchema)
