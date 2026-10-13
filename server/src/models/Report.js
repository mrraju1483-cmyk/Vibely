import mongoose from 'mongoose'

export const REPORT_REASONS = ['spam', 'harassment', 'nudity', 'violence', 'hate', 'misinformation', 'other']

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['post', 'user', 'reel'], required: true },
    target: { type: mongoose.Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, default: '', maxlength: 500 },
    status: { type: String, enum: ['open', 'resolved', 'rejected'], default: 'open' },
    adminResponse: { type: String, default: '', maxlength: 500 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
)
reportSchema.index({ reporter: 1, targetType: 1, target: 1 }, { unique: true })
reportSchema.index({ status: 1, createdAt: -1 })

export default mongoose.model('Report', reportSchema)
