import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null }, // null = top-level; replies are one level deep
    text: { type: String, required: true, maxlength: 500 },
    likesCount: { type: Number, default: 0 },
    repliesCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)
commentSchema.index({ post: 1, parent: 1, _id: -1 })
commentSchema.index({ parent: 1, _id: 1 })

export default mongoose.model('Comment', commentSchema)
