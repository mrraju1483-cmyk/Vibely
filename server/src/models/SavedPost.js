import mongoose from 'mongoose'

const savedSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  },
  { timestamps: true }
)
savedSchema.index({ user: 1, post: 1 }, { unique: true }) // no duplicate saves
savedSchema.index({ user: 1, _id: -1 })

export default mongoose.model('SavedPost', savedSchema)
