import mongoose from 'mongoose'

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    caption: { type: String, default: '', maxlength: 2200 },
    media: { type: String, required: true }, // public URL
    mediaKey: { type: String, default: '' }, // provider key, used for deletion
    mediaType: { type: String, enum: ['image', 'video'], required: true },
    hashtags: { type: [String], default: [] },
    location: { type: String, default: '', maxlength: 100 },
    visibility: { type: String, enum: ['public', 'followers', 'private'], default: 'public' },
    authorPrivate: { type: Boolean, default: false }, // copy of the author's private-account flag, so discovery queries stay simple and indexed
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)
postSchema.index({ author: 1, _id: -1 })
postSchema.index({ hashtags: 1, _id: -1 })
postSchema.index({ visibility: 1, authorPrivate: 1, _id: -1 }) // explore: recent + trending
postSchema.index({ hashtags: 1, visibility: 1, authorPrivate: 1, _id: -1 }) // hashtag pages
postSchema.index({ caption: 'text' }, { default_language: 'none' }) // caption search

export default mongoose.model('Post', postSchema)
