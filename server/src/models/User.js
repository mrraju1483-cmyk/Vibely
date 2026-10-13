import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 60 },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 20 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, unique: true, sparse: true },
    password: { type: String, required: true, select: false },
    profilePhoto: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 160 },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isPrivate: { type: Boolean, default: false },
    showOnlineStatus: { type: Boolean, default: true },
    showLastSeen: { type: Boolean, default: true },
    messagePrivacy: { type: String, enum: ['everyone', 'following'], default: 'everyone' }, // 'following' = only people I follow can message me
    lastSeenAt: { type: Date, default: null },
    storyVisibility: { type: String, enum: ['public', 'followers'], default: 'public' }, // default audience for new stories
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    passwordChangedAt: { type: Date, default: null }, // tokens issued before this are rejected
    removedAt: { type: Date, default: null }, // set when an admin removed (anonymized) the account
  },
  { timestamps: true }
)

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  this.password = await bcrypt.hash(this.password, 12)
})

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password)
}

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id.toString(),
    fullName: this.fullName,
    username: this.username,
    email: this.email,
    phone: this.phone || '',
    profilePhoto: this.profilePhoto,
    bio: this.bio,
    role: this.role,
    isVerified: this.isVerified,
    isPrivate: this.isPrivate,
    storyVisibility: this.storyVisibility,
    showOnlineStatus: this.showOnlineStatus,
    showLastSeen: this.showLastSeen,
    messagePrivacy: this.messagePrivacy,
    createdAt: this.createdAt,
  }
}

export default mongoose.model('User', userSchema)
