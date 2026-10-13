import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Input from '../components/Input.jsx'
import AuthShell, { Alert, DevOtpBanner } from '../components/AuthShell.jsx'
import { resendOtpApi, verifyOtpApi } from '../api/authApi.js'
import { getErrorMessage, getFieldErrors } from '../api/axios.js'

const COOLDOWN = 30

export default function VerifyOtpPage() {
  const nav = useNavigate()
  const { state } = useLocation()
  const [identifier, setIdentifier] = useState(state?.identifier || '')
  const [devOtp, setDevOtp] = useState(state?.devOtp)
  const [otp, setOtp] = useState('')
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [seconds, setSeconds] = useState(COOLDOWN)

  useEffect(() => {
    if (seconds <= 0) return
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [seconds])

  async function onSubmit(e) {
    e.preventDefault()
    setServerError(''); setInfo('')
    const er = {}
    if (!identifier.trim()) er.identifier = 'Enter your email or phone'
    if (!/^\d{6}$/.test(otp)) er.otp = 'Enter the 6-digit code'
    setErrors(er)
    if (Object.keys(er).length) return
    setSubmitting(true)
    try {
      await verifyOtpApi({ identifier: identifier.trim(), otp })
      nav('/login', { state: { message: 'Account verified. Please log in.' } })
    } catch (err) {
      setErrors(getFieldErrors(err))
      setServerError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function resend() {
    setServerError(''); setInfo('')
    try {
      const data = await resendOtpApi({ identifier: identifier.trim() })
      setDevOtp(data.devOtp)
      setInfo('If the account needs verification, a new code has been sent.')
      setSeconds(COOLDOWN)
    } catch (err) {
      setServerError(getErrorMessage(err))
    }
  }

  return (
    <AuthShell title="Verify your account" onSubmit={onSubmit}>
      <p className="text-center text-sm text-slate-500">Enter the 6-digit code for <strong>{identifier || 'your account'}</strong>.</p>
      <DevOtpBanner otp={devOtp} />
      <Alert>{serverError}</Alert>
      <Alert kind="success">{info}</Alert>
      {!state?.identifier && <Input id="identifier" label="Email or Phone" value={identifier} onChange={(e) => setIdentifier(e.target.value)} error={errors.identifier} />}
      <Input id="otp" label="Verification code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} error={errors.otp} />
      <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Verifying...' : 'Verify'}</button>
      <button type="button" onClick={resend} disabled={seconds > 0 || !identifier.trim()} className="w-full text-sm text-brand-600 disabled:text-slate-400">
        {seconds > 0 ? `Resend OTP in ${seconds}s` : 'Resend OTP'}
      </button>
      <p className="text-center text-sm"><Link to="/login" className="text-brand-600">Back to login</Link></p>
    </AuthShell>
  )
}
