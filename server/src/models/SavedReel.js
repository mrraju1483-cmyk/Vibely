import mongoose from 'mongoose'

const savedReelSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reel: { type: mongoose.Schema.Types.ObjectId, ref: 'Reel', required: true },
  },
  { timestamps: true }
)
savedReelSchema.index({ user: 1, reel: 1 }, { unique: true }) // no duplicate saves
savedReelSchema.index({ user: 1, _id: -1 })

export default mongoose.model('SavedReel', savedReelSchema)
