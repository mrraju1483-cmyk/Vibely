import { useState } from 'react'
import Modal from '../Modal.jsx'
import { getErrorMessage } from '../../api/axios.js'

// Asks the admin for a reason (3-300 characters, saved in the audit log). Optional typed confirmation for permanent actions.
export default function ReasonModal({ title, description, confirmLabel, danger = false, confirmText, onSubmit, onClose }) {
  const [reason, setReason] = useState('')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const r = reason.trim()
  const valid = r.length >= 3 && r.length <= 300 && (!confirmText || typed === confirmText)

  async function submit(e) {
    e.preventDefault()
    if (!valid) return
    setBusy(true); setError('')
    try { await onSubmit(r) } catch (err) { setError(getErrorMessage(err)); setBusy(false) }
  }

  return (
    <Modal title={title} onClose={busy ? () => {} : onClose}>
      <form onSubmit={submit} className="space-y-3">
        {description && <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{error}</p>}
        <div>
          <label htmlFor="admin-reason" className="mb-1 block text-sm font-medium">Reason (saved in the audit log)</label>
          <textarea id="admin-reason" rows="3" maxLength={300} className="field" value={reason} onChange={(e) => setReason(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">{r.length}/300 (at least 3 characters)</p>
        </div>
        {confirmText && (
          <div>
            <label htmlFor="admin-confirm" className="mb-1 block text-sm font-medium">Type <strong>{confirmText}</strong> to confirm</label>
            <input id="admin-confirm" className="field" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={!valid || busy} className={`${danger ? 'btn bg-red-600 text-white hover:bg-red-700' : 'btn-primary'} flex-1`}>{busy ? 'Working...' : confirmLabel}</button>
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}
