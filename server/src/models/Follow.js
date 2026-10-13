import mongoose from 'mongoose'

const followSchema = new mongoose.Schema(
  {
    follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    following: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // 'pending' = follow request to a private account
    status: { type: String, enum: ['accepted', 'pending'], default: 'accepted' },
  },
  { timestamps: true }
)
followSchema.index({ follower: 1, following: 1 }, { unique: true }) // no duplicate follows
followSchema.index({ following: 1, status: 1, createdAt: -1 }) // followers list / counts
followSchema.index({ follower: 1, status: 1, createdAt: -1 }) // following list / counts

export default mongoose.model('Follow', followSchema)
