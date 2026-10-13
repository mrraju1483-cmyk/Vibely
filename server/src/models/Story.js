import mongoose from 'mongoose'

const storySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    media: { type: String, required: true }, // public URL
    mediaKey: { type: String, default: '' }, // provider key, used for deletion
    mediaType: { type: String, enum: ['image', 'video'], required: true },
    caption: { type: String, default: '', maxlength: 200 },
    visibility: { type: String, enum: ['public', 'followers'], default: 'public' },
    viewers: { type: [{ _id: false, user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, viewedAt: { type: Date, default: Date.now } }], default: [] },
    viewersCount: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true }, // createdAt + 24h. Every query filters on this, so expired stories are never served
  },
  { timestamps: true }
)
storySchema.index({ user: 1, expiresAt: 1 })
storySchema.index({ expiresAt: 1 }) // cleanup sweep

export default mongoose.model('Story', storySchema)
