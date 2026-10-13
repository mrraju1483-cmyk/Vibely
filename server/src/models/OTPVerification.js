import mongoose from 'mongoose'

const otpSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  email: String,
  phone: String,
  purpose: { type: String, enum: ['verify', 'reset'], required: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  verified: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 3600 }, // auto-clean after 1 hour
})

export default mongoose.model('OTPVerification', otpSchema)
