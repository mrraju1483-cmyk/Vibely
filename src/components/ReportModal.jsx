import { useState } from 'react'
import Modal from './Modal.jsx'
import { getErrorMessage } from '../api/axios.js'

const REASONS = [['spam', 'Spam'], ['harassment', 'Harassment or bullying'], ['nudity', 'Nudity or sexual content'], ['violence', 'Violence'], ['hate', 'Hate speech'], ['misinformation', 'False information'], ['other', 'Something else']]

// onSubmit({ reason, details }) must return a promise
export default function ReportModal({ title, onSubmit, onClose }) {
  const [reason, setReason] = useState('spam')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try { await onSubmit({ reason, details: details.trim() }); setDone(true) } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) }
  }

  return (
    <Modal title={title} onClose={onClose}>
      {done ? (
        <div className="space-y-3 text-center">
          <p role="status">Thanks. Your report was sent for review.</p>
          <button type="button" className="btn-primary" onClick={onClose}>Done</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{error}</p>}
          <div>
            <label htmlFor="report-reason" className="mb-1 block text-sm font-medium">Reason</label>
            <select id="report-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="report-details" className="mb-1 block text-sm font-medium">Details (optional)</label>
            <textarea id="report-details" rows="3" maxLength={500} className="field" value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? 'Sending...' : 'Submit report'}</button>
        </form>
      )}
    </Modal>
  )
}
