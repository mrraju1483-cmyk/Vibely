import api from './axios.js'

const unwrap = (p) => p.then((r) => r.data.data || {})

export const registerApi = (body) => unwrap(api.post('/auth/register', body))
export const loginApi = (body) => unwrap(api.post('/auth/login', body))
export const logoutApi = () => unwrap(api.post('/auth/logout'))
export const meApi = () => unwrap(api.get('/auth/me'))
export const verifyOtpApi = (body) => api.post('/auth/verify-otp', body).then((r) => r.data)
export const resendOtpApi = (body) => unwrap(api.post('/auth/resend-otp', body))
export const forgotPasswordApi = (body) => unwrap(api.post('/auth/forgot-password', body))
export const resetPasswordApi = (body) => api.post('/auth/reset-password', body).then((r) => r.data)
