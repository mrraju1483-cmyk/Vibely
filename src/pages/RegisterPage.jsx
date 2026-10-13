import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Input from '../components/Input.jsx'
import AuthShell, { Alert } from '../components/AuthShell.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getErrorMessage, getFieldErrors } from '../api/axios.js'

function validate(f) {
  const e = {}
  if (!f.fullName.trim()) e.fullName = 'Full name is required'
  if (!/^[a-zA-Z0-9_.]{3,20}$/.test(f.username)) e.username = '3-20 letters, numbers, _ or .'
  if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter a valid email'
  if (!/^\+?\d{10,13}$/.test(f.phone.replace(/[\s-]/g, ''))) e.phone = 'Enter a valid phone number'
  if (f.password.length < 8) e.password = 'At least 8 characters'
  else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) e.password = 'Use at least one letter and one number'
  if (f.confirm !== f.password) e.confirm = 'Passwords do not match'
  return e
}

const fields = [
  ['fullName', 'Full Name', 'text', 'name'], ['username', 'Username', 'text', 'username'], ['email', 'Email', 'email', 'email'],
  ['phone', 'Phone', 'tel', 'tel'], ['password', 'Password', 'password', 'new-password'], ['confirm', 'Confirm Password', 'password', 'new-password'],
]

export default function RegisterPage() {
  const nav = useNavigate()
  const { register } = useAuth()
  const [form, setForm] = useState({ fullName: '', username: '', email: '', phone: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function onSubmit(e) {
    e.preventDefault()
    const er = validate(form)
    setErrors(er)
    setServerError('')
    if (Object.keys(er).length) return
    setSubmitting(true)
    try {
      const { confirm, ...body } = form
      const data = await register(body)
      nav('/verify-otp', { state: { identifier: data.identifier, devOtp: data.devOtp } })
    } catch (err) {
      setErrors(getFieldErrors(err))
      setServerError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Create your account" onSubmit={onSubmit}>
      <Alert>{serverError}</Alert>
      {fields.map(([k, label, type, ac]) => <Input key={k} id={k} label={label} type={type} autoComplete={ac} value={form[k]} onChange={set(k)} error={errors[k]} />)}
      <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Creating...' : 'Create Account'}</button>
      <p className="text-center text-sm">Have an account? <Link to="/login" className="font-semibold text-brand-600">Login</Link></p>
    </AuthShell>
  )
}
