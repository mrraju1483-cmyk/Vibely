import { useState } from 'react'
import Modal from './Modal.jsx'
import Input from './Input.jsx'
import { updateProfileApi } from '../api/userApi.js'
import { getErrorMessage, getFieldErrors } from '../api/axios.js'

function validate(f) {
  const e = {}
  if (!f.fullName.trim() || f.fullName.length > 60) e.fullName = 'Full name is required (max 60 characters)'
  if (!/^[a-zA-Z0-9_.]{3,20}$/.test(f.username)) e.username = '3-20 letters, numbers, _ or .'
  if (f.bio.length > 160) e.bio = 'Max 160 characters'
  if (f.phone && !/^\+?\d{10,13}$/.test(f.phone.replace(/[\s-]/g, ''))) e.phone = 'Enter a valid phone number'
  if (f.profilePhoto && !/^https?:\/\/\S+$/i.test(f.profilePhoto)) e.profilePhoto = 'Enter a valid http(s) image URL'
  return e
}

export default function EditProfileModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    fullName: user.fullName || '', username: user.username || '', bio: user.bio || '',
    phone: user.phone || '', profilePhoto: user.profilePhoto || '',
  })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    const er = validate(form)
    setErrors(er); setServerError('')
    if (Object.keys(er).length) return
    setSaving(true)
    try {
      await updateProfileApi(form)
      await onSaved()
    } catch (err) {
      setErrors(getFieldErrors(err)); setServerError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit profile" onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-3">
        {serverError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{serverError}</p>}
        <Input id="ep-name" label="Full Name" value={form.fullName} onChange={set('fullName')} error={errors.fullName} />
        <Input id="ep-username" label="Username" value={form.username} onChange={set('username')} error={errors.username} />
        <div>
          <label htmlFor="ep-bio" className="mb-1 block text-sm font-medium">Bio</label>
          <textarea id="ep-bio" rows="3" className="field" value={form.bio} onChange={set('bio')} aria-invalid={!!errors.bio} />
          <p className={`mt-1 text-xs ${form.bio.length > 160 ? 'text-red-500' : 'text-slate-500'}`}>{form.bio.length}/160 {errors.bio}</p>
        </div>
        <Input id="ep-phone" label="Phone" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} />
        <Input id="ep-photo" label="Profile photo URL" type="url" placeholder="https://..." value={form.profilePhoto} onChange={set('profilePhoto')} error={errors.profilePhoto} />
        <p className="text-xs text-slate-500">Photo upload from your device arrives with the media system in Phase 4.</p>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save changes'}</button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}
