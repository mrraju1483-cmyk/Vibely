import 'dotenv/config'

for (const key of ['MONGODB_URI', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key} (see server/.env.example)`)
    process.exit(1)
  }
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long')
  process.exit(1)
}

if (process.env.NODE_ENV === 'production') {
  if (!process.env.CLIENT_URL) { console.error('CLIENT_URL must be set in production (your frontend URL)'); process.exit(1) }
  if (process.env.CLIENT_URL.includes('*')) { console.error('CLIENT_URL must not contain * in production'); process.exit(1) }
  if ((process.env.OTP_PROVIDER || 'dev') === 'dev') console.warn('WARNING: OTP_PROVIDER=dev sends no real codes. Configure a provider before real users sign up.')
  if ((process.env.MEDIA_PROVIDER || 'local') === 'local') console.warn('WARNING: MEDIA_PROVIDER=local stores uploads on disk, which is lost on most hosts. Use cloudinary.')
}

const port = Number(process.env.PORT) || 5000
const mediaProvider = process.env.MEDIA_PROVIDER || 'local'
if (mediaProvider === 'cloudinary') {
  for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
    if (!process.env[key]) { console.error(`MEDIA_PROVIDER=cloudinary requires ${key}`); process.exit(1) }
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  otpProvider: process.env.OTP_PROVIDER || 'dev',
  otpApiKey: process.env.OTP_API_KEY || '',
  mediaProvider,
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  stunUrls: (process.env.STUN_URLS || 'stun:stun.l.google.com:19302').split(',').map((s) => s.trim()).filter(Boolean),
  turnUrl: process.env.TURN_URL || '', // optional relay server for calls behind strict firewalls
  turnSecret: process.env.TURN_SECRET || '', // shared secret: used to mint short-lived credentials, never sent to the browser
  aiServiceUrl: (process.env.AI_SERVICE_URL || '').replace(/\/$/, ''), // the Python FastAPI service (internal)
  aiServiceKey: process.env.AI_SERVICE_KEY || '', // shared secret sent as X-Internal-Key, never exposed to browsers
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS) || 35000,
  aiRateLimit: Number(process.env.AI_RATE_LIMIT_MAX) || 0, // 0 = default (30 per 15 min in production, 300 otherwise)
  otpExpiresMin: 5,
  otpMaxAttempts: 5,
  otpResendCooldownSec: 30,
}
export const isProd = env.nodeEnv === 'production'
