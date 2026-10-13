import mongoose from 'mongoose'

// One row per (reel, viewer): views are counted once per person, so refreshing cannot inflate them
const reelViewSchema = new mongoose.Schema({
  reel: { type: mongoose.Schema.Types.ObjectId, ref: 'Reel', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
})
reelViewSchema.index({ reel: 1, user: 1 }, { unique: true })

export default mongoose.model('ReelView', reelViewSchema)
