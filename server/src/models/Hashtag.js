import mongoose from 'mongoose'

// postsCount = number of DISCOVERABLE posts (public, from public accounts) using the tag
const hashtagSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 50 },
  postsCount: { type: Number, default: 0 },
  lastUsedAt: { type: Date, default: Date.now },
})
hashtagSchema.index({ postsCount: -1 })

export default mongoose.model('Hashtag', hashtagSchema)
