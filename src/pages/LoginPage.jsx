import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Input from '../components/Input.jsx'
import AuthShell, { Alert } from '../components/AuthShell.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { resendOtpApi } from '../api/authApi.js'
import { getErrorCode, getErrorMessage } from '../api/axios.js'

export default function LoginPage() {
  const nav = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, loading } = useAuth()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  if (!loading && isAuthenticated) return <Navigate to="/home" replace />

  async function onSubmit(e) {
    e.preventDefault()
    const er = {}
    if (!form.identifier.trim()) er.identifier = 'Enter your email or phone'
    if (!form.password) er.password = 'Enter your password'
    setErrors(er)
    setServerError('')
    if (Object.keys(er).length) return
    setSubmitting(true)
    try {
      await login({ identifier: form.identifier.trim(), password: form.password })
      nav(location.state?.from?.pathname || '/home', { replace: true })
    } catch (err) {
      if (getErrorCode(err) === 'ACCOUNT_NOT_VERIFIED') {
        const identifier = err.response.data.errors?.identifier || form.identifier.trim()
        let devOtp
        try { ({ devOtp } = await resendOtpApi({ identifier })) } catch { /* resend is optional here */ }
        nav('/verify-otp', { state: { identifier, devOtp } })
        return
      }
      setServerError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Welcome back" onSubmit={onSubmit}>
      <Alert kind="success">{location.state?.message}</Alert>
      <Alert>{serverError}</Alert>
      <Input id="identifier" label="Email or Phone" value={form.identifier} onChange={set('identifier')} error={errors.identifier} autoComplete="username" />
      <Input id="password" label="Password" type="password" value={form.password} onChange={set('password')} error={errors.password} autoComplete="current-password" />
      <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Logging in...' : 'Login'}</button>
      <Link to="/forgot-password" className="block text-center text-sm text-brand-600">Forgot Password</Link>
      <p className="text-center text-sm">New here? <Link to="/register" className="font-semibold text-brand-600">Create Account</Link></p>
    </AuthShell>
  )
}
