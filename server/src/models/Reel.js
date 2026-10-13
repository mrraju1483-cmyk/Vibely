import mongoose from 'mongoose'

const reelSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    video: { type: String, required: true }, // public URL
    mediaKey: { type: String, default: '' }, // provider key, used for deletion
    caption: { type: String, default: '', maxlength: 500 },
    hashtags: { type: [String], default: [] },
    location: { type: String, default: '', maxlength: 100 },
    duration: { type: Number, default: null }, // seconds (read from the file when possible)
    authorPrivate: { type: Boolean, default: false }, // copy of the author's privacy, kept in sync by setPrivacy
    viewsCount: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)
reelSchema.index({ author: 1, _id: -1 })
reelSchema.index({ authorPrivate: 1, _id: -1 }) // discovery feed

export default mongoose.model('Reel', reelSchema)
