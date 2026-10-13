import { useState } from 'react'
import Modal from '../Modal.jsx'
import { Badge, fmtDate } from './AdminBits.jsx'
import { adminUpdateReportApi } from '../../api/adminApi.js'
import { getErrorMessage, getFieldErrors } from '../../api/axios.js'

export const STATUS_TONE = { open: 'red', resolved: 'green', rejected: 'gray' }

export function ReportPreview({ preview }) {
  if (!preview.exists) return <p className="text-sm italic text-slate-500">{preview.label}</p>
  return (
    <div className="flex gap-3">
      {preview.mediaUrl && (
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800">
          {preview.mediaType === 'video' ? <video src={preview.mediaUrl} preload="metadata" muted className="h-full w-full object-cover" /> : <img src={preview.mediaUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
        </div>
      )}
      <div className="min-w-0 text-sm"><p className="font-medium">{preview.label}{preview.deactivated && <span className="ml-1"><Badge tone="amber">Deactivated</Badge></span>}</p>{preview.snippet && <p className="break-words text-slate-600 dark:text-slate-300">{preview.snippet}</p>}</div>
    </div>
  )
}

export default function ReportReviewModal({ report, onClose, onSaved }) {
  const [status, setStatus] = useState(report.status === 'open' ? 'resolved' : report.status)
  const [adminResponse, setAdminResponse] = useState(report.adminResponse || '')
  const [action, setAction] = useState('none')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const needsReason = action !== 'none'
  const reasonOk = !needsReason || (reason.trim().length >= 3 && reason.trim().length <= 300)

  async function submit(e) {
    e.preventDefault()
    if (!reasonOk) return
    setBusy(true); setError(''); setFieldErrors({})
    try { onSaved(await adminUpdateReportApi(report.id, { status, adminResponse, action, ...(needsReason && { reason: reason.trim() }) }).then((d) => d.report)) } catch (err) {
      setError(getErrorMessage(err)); setFieldErrors(getFieldErrors(err)); setBusy(false)
    }
  }

  return (
    <Modal title="Review report" onClose={busy ? () => {} : onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
          <p className="flex flex-wrap items-center gap-1"><Badge tone="red">{report.reason}</Badge><Badge>{report.targetType}</Badge><Badge tone={STATUS_TONE[report.status]}>{report.status}</Badge></p>
          <p className="text-xs text-slate-500">Reported by @{report.reporter.username} · {fmtDate(report.createdAt)}</p>
          {report.details && <p className="break-words">"{report.details}"</p>}
          <ReportPreview preview={report.preview} />
          {report.reviewedBy && <p className="text-xs text-slate-500">Last reviewed by @{report.reviewedBy} · {fmtDate(report.reviewedAt)}</p>}
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{error}</p>}

        <fieldset>
          <legend className="mb-1 text-sm font-medium">Decision</legend>
          <div className="flex flex-wrap gap-3 text-sm">
            {[['resolved', 'Resolved'], ['rejected', 'Rejected (no violation)'], ['open', 'Keep open']].map(([v, l]) => (
              <label key={v} className="flex items-center gap-1"><input type="radio" name="decision" value={v} checked={status === v} onChange={() => setStatus(v)} />{l}</label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="rr-response" className="mb-1 block text-sm font-medium">Admin note (optional)</label>
          <textarea id="rr-response" rows="2" maxLength={500} className="field" value={adminResponse} onChange={(e) => setAdminResponse(e.target.value)} />
          {fieldErrors.adminResponse && <p role="alert" className="text-xs text-red-500">{fieldErrors.adminResponse}</p>}
        </div>

        <div>
          <label htmlFor="rr-action" className="mb-1 block text-sm font-medium">Action</label>
          <select id="rr-action" className="field" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="none">No action</option>
            {report.targetType !== 'user' && <option value="remove_content">Remove the {report.targetType}</option>}
            <option value="deactivate_user">Deactivate the {report.targetType === 'user' ? 'user' : 'author'}</option>
          </select>
        </div>
        {needsReason && (
          <div>
            <label htmlFor="rr-reason" className="mb-1 block text-sm font-medium">Reason for this action (audit log)</label>
            <input id="rr-reason" className="field" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
            {fieldErrors.reason && <p role="alert" className="text-xs text-red-500">{fieldErrors.reason}</p>}
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={busy || !reasonOk} className={`${needsReason ? 'btn bg-red-600 text-white hover:bg-red-700' : 'btn-primary'} flex-1`}>{busy ? 'Saving...' : needsReason ? 'Apply action and save' : 'Save'}</button>
          <button type="button" onClick={onClose} disabled={busy} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}
