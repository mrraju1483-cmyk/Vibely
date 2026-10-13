import mongoose from 'mongoose'

// Light audit log of AI usage. Inputs are truncated or replaced by sizes so private text is not kept, and rows expire after 30 days.
const aiRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestType: { type: String, enum: ['chat', 'caption', 'smart_reply', 'safety'], required: true },
    input: { type: String, default: '', maxlength: 400 },
    output: { type: String, default: '', maxlength: 1000 },
    model: { type: String, default: '' },
    status: { type: String, enum: ['ok', 'error'], default: 'ok' },
    errorCode: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now, expires: 30 * 24 * 3600 },
  },
  { collection: 'aiRequests' }
)

export default mongoose.model('AIRequest', aiRequestSchema)
