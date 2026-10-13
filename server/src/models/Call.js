import mongoose from 'mongoose'

const callSchema = new mongoose.Schema(
  {
    caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['voice', 'video'], required: true },
    status: { type: String, enum: ['ringing', 'accepted', 'completed', 'missed', 'rejected', 'canceled'], default: 'ringing' },
    startedAt: { type: Date, default: null }, // when it was answered
    endedAt: { type: Date, default: null },
    duration: { type: Number, default: 0 }, // seconds, from answer to end
    endReason: { type: String, default: '' },
  },
  { timestamps: true }
)
callSchema.index({ caller: 1, _id: -1 })
callSchema.index({ receiver: 1, _id: -1 })

export default mongoose.model('Call', callSchema)
