import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Input from '../components/Input.jsx'
import AuthShell, { Alert, DevOtpBanner } from '../components/AuthShell.jsx'
import { forgotPasswordApi, resetPasswordApi } from '../api/authApi.js'
import { getErrorMessage, getFieldErrors } from '../api/axios.js'

export default function ForgotPasswordPage() {
  const nav = useNavigate()
  const [step, setStep] = useState(1)
  const [identifier, setIdentifier] = useState('')
  const [form, setForm] = useState({ otp: '', newPassword: '', confirm: '' })
  const [devOtp, setDevOtp] = useState()
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function requestCode(e) {
    e.preventDefault()
    setServerError('')
    if (!identifier.trim()) return setErrors({ identifier: 'Enter your email or phone' })
    setErrors({})
    setSubmitting(true)
    try {
      const data = await forgotPasswordApi({ identifier: identifier.trim() })
      setDevOtp(data.devOtp)
      setInfo('If an account exists, a reset code has been sent.')
      setStep(2)
    } catch (err) {
      setServerError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function reset(e) {
    e.preventDefault()
    setServerError('')
    const er = {}
    if (!/^\d{6}$/.test(form.otp)) er.otp = 'Enter the 6-digit code'
    if (form.newPassword.length < 8 || !/[A-Za-z]/.test(form.newPassword) || !/\d/.test(form.newPassword)) er.newPassword = 'At least 8 characters with a letter and a number'
    if (form.confirm !== form.newPassword) er.confirm = 'Passwords do not match'
    setErrors(er)
    if (Object.keys(er).length) return
    setSubmitting(true)
    try {
      await resetPasswordApi({ identifier: identifier.trim(), otp: form.otp, newPassword: form.newPassword })
      nav('/login', { state: { message: 'Password updated. Please log in.' } })
    } catch (err) {
      setErrors(getFieldErrors(err))
      setServerError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return step === 1 ? (
    <AuthShell title="Forgot password" onSubmit={requestCode}>
      <p className="text-center text-sm text-slate-500">Enter your email or phone and we will send a reset code.</p>
      <Alert>{serverError}</Alert>
      <Input id="identifier" label="Email or Phone" value={identifier} onChange={(e) => setIdentifier(e.target.value)} error={errors.identifier} />
      <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Sending...' : 'Send reset code'}</button>
      <p className="text-center text-sm"><Link to="/login" className="text-brand-600">Back to login</Link></p>
    </AuthShell>
  ) : (
    <AuthShell title="Reset password" onSubmit={reset}>
      <Alert kind="success">{info}</Alert>
      <DevOtpBanner otp={devOtp} />
      <Alert>{serverError}</Alert>
      <Input id="otp" label="Reset code" inputMode="numeric" maxLength={6} value={form.otp} onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, '') })} error={errors.otp} />
      <Input id="newPassword" label="New password" type="password" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} error={errors.newPassword} />
      <Input id="confirm" label="Confirm new password" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
      <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Updating...' : 'Update password'}</button>
      <button type="button" onClick={() => setStep(1)} className="w-full text-sm text-brand-600">Use a different email or phone</button>
    </AuthShell>
  )
}
