import mongoose from 'mongoose'

const receipt = { _id: false, user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } }

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // 'voice' is part of the structure so voice notes can be added later without a migration
    type: { type: String, enum: ['text', 'image', 'video', 'file', 'voice'], default: 'text' },
    text: { type: String, default: '', maxlength: 2000 },
    attachment: { url: String, key: String, name: String, size: Number, mimeType: String, duration: Number },
    deliveredTo: { type: [receipt], default: [] },
    readBy: { type: [receipt], default: [] },
    deletedFor: { type: [mongoose.Schema.Types.ObjectId], default: [] }, // "delete for me"
    deletedForEveryone: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null }, // disappearing messages
  },
  { timestamps: true }
)
messageSchema.index({ conversation: 1, _id: -1 })
messageSchema.index({ expiresAt: 1 }, { sparse: true })

export default mongoose.model('Message', messageSchema)
