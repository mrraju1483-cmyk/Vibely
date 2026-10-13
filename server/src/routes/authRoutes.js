import { Router } from 'express'
import * as c from '../controllers/authController.js'
import { requireAuth } from '../middleware/auth.js'
import { authLimiter, otpLimiter } from '../middleware/rateLimiters.js'

const r = Router()
r.post('/register', authLimiter, c.register)
r.post('/login', authLimiter, c.login)
r.post('/logout', requireAuth, c.logout)
r.get('/me', requireAuth, c.me)
r.post('/verify-otp', otpLimiter, c.verifyOtp)
r.post('/resend-otp', otpLimiter, c.resendOtp)
r.post('/forgot-password', otpLimiter, c.forgotPassword)
r.post('/reset-password', otpLimiter, c.resetPassword)
export default r
