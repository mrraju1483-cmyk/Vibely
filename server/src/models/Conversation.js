import mongoose from 'mongoose'

const participantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    unread: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now }, // members only see messages from after they joined
  },
  { _id: false }
)

const lastMessageSchema = new mongoose.Schema(
  { sender: mongoose.Schema.Types.ObjectId, text: String, kind: String, createdAt: Date, expiresAt: Date },
  { _id: false }
)

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['direct', 'group'], required: true },
    // Sorted "idA:idB" for direct chats. The unique index guarantees there is never a duplicate conversation.
    directKey: { type: String, unique: true, sparse: true },
    name: { type: String, default: '', maxlength: 50 },
    photo: { type: String, default: '' },
    photoKey: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participants: { type: [participantSchema], default: [] },
    disappearAfter: { type: Number, default: 0 }, // seconds, 0 = off
    lastMessage: { type: lastMessageSchema },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)
conversationSchema.index({ 'participants.user': 1, lastMessageAt: -1 })

export default mongoose.model('Conversation', conversationSchema)
