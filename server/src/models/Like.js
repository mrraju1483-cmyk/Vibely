import mongoose from 'mongoose'

// One collection for post likes and comment likes
const likeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['post', 'comment', 'reel'], required: true },
    target: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
)
likeSchema.index({ user: 1, targetType: 1, target: 1 }, { unique: true }) // no duplicate likes
likeSchema.index({ targetType: 1, target: 1 })

export default mongoose.model('Like', likeSchema)
