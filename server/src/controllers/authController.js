import { asyncHandler } from '../utils/ApiError.js'
import * as auth from '../services/authService.js'

const send = (res, status, message, data) => res.status(status).json({ success: true, message, ...(data && { data }) })
const devNote = (devOtp) =>
  devOtp ? { devMode: true, devOtp, devNotice: 'DEVELOPMENT MODE: no SMS/email provider is configured, nothing was sent.' } : {}

export const register = asyncHandler(async (req, res) => {
  const { user, devOtp } = await auth.registerUser(req.body)
  send(res, 201, 'Account created. Enter the verification code to continue.', {
    identifier: user.email, requiresVerification: true, ...devNote(devOtp),
  })
})

export const login = asyncHandler(async (req, res) => {
  const { token, user } = await auth.loginUser(req.body)
  send(res, 200, 'Logged in', { token, user: user.toSafeJSON() })
})

export const logout = asyncHandler(async (req, res) => {
  // JWTs are stateless: the client discards the token. A token denylist can be added later.
  send(res, 200, 'Logged out')
})

export const me = asyncHandler(async (req, res) => send(res, 200, 'OK', { user: req.user.toSafeJSON() }))

export const verifyOtp = asyncHandler(async (req, res) => {
  await auth.verifyAccount(req.body)
  send(res, 200, 'Account verified. You can log in now.')
})

export const resendOtp = asyncHandler(async (req, res) => {
  const { devOtp } = await auth.resendOtp(req.body)
  send(res, 200, 'If the account needs verification, a new code has been sent.', devNote(devOtp))
})

export const forgotPassword = asyncHandler(async (req, res) => {
  const { devOtp } = await auth.requestPasswordReset(req.body)
  send(res, 200, 'If an account exists, a reset code has been sent.', devNote(devOtp))
})

export const resetPassword = asyncHandler(async (req, res) => {
  await auth.resetPassword(req.body)
  send(res, 200, 'Password updated. You can log in now.')
})
