import mongoose from 'mongoose'

const reelCommentSchema = new mongoose.Schema(
  {
    reel: { type: mongoose.Schema.Types.ObjectId, ref: 'Reel', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: true }
)
reelCommentSchema.index({ reel: 1, _id: -1 })

export default mongoose.model('ReelComment', reelCommentSchema)
