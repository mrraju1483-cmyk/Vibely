import rateLimit from 'express-rate-limit'
import { ApiError } from '../utils/ApiError.js'
import { env, isProd } from '../config/env.js'

const make = (limit) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isProd ? limit : limit * 10, // looser in development so testing is not blocked
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => next(new ApiError(429, 'Too many requests. Please try again later.')),
  })

export const authLimiter = make(20) // login / register
export const otpLimiter = make(10) // otp / password reset
export const apiLimiter = make(300) // general authenticated API traffic
export const createLimiter = make(60) // posts / comments / reports
export const searchLimiter = make(120) // explore + search
export const messageLimiter = make(300) // chat messages

// AI calls cost money: limit per logged-in user (use after requireAuth)
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.aiRateLimit || (isProd ? 30 : 300),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user._id}`,
  handler: (req, res, next) => next(new ApiError(429, 'You are using Vibely AI very quickly. Please wait a few minutes and try again.', { code: 'AI_RATE_LIMITED' })),
})
export const adminLimiter = make(200) // admin API (also behind login + admin role)
