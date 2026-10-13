import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, { algorithm: 'HS256', expiresIn: env.jwtExpiresIn })

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] })

// A token issued before the user last changed their password is no longer valid
export const tokenIsStale = (payload, user) => !!user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
