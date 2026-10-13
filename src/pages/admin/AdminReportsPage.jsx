import { useState } from 'react'
import { Badge, FilterSelect, ListFooter } from '../../components/admin/AdminBits.jsx'
import ReportReviewModal, { ReportPreview, STATUS_TONE } from '../../components/admin/ReportReviewModal.jsx'
import { usePagedList } from '../../hooks/usePagedList.js'
import { adminReportsApi } from '../../api/adminApi.js'
import { timeAgo } from '../../utils/time.js'

const REASONS = ['spam', 'harassment', 'nudity', 'violence', 'hate', 'misinformation', 'other']

export default function AdminReportsPage() {
  const [status, setStatus] = useState('open')
  const [type, setType] = useState('')
  const [reason, setReason] = useState('')
  const [review, setReview] = useState(null)
  const list = usePagedList(async (cursor) => {
    const d = await adminReportsApi({ status, type: type || undefined, reason: reason || undefined, cursor: cursor || undefined })
    return { list: d.reports, nextCursor: d.nextCursor }
  }, [status, type, reason])

  // After saving: keep the row if it still matches the filter, otherwise drop it from the queue
  function saved(updated) {
    list.setItems((rows) => rows.flatMap((r) => (r.id !== updated.id ? [r] : status === 'all' || status === updated.status ? [updated] : [])))
    setReview(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <FilterSelect id="rp-status" label="Status" value={status} onChange={setStatus} options={[['open', 'Open'], ['resolved', 'Resolved'], ['rejected', 'Rejected'], ['all', 'All']]} />
        <FilterSelect id="rp-type" label="About" value={type} onChange={setType} options={[['', 'Anything'], ['post', 'Posts'], ['reel', 'Reels'], ['user', 'Users']]} />
        <FilterSelect id="rp-reason" label="Reason" value={reason} onChange={setReason} options={[['', 'Any reason'], ...REASONS.map((r) => [r, r[0].toUpperCase() + r.slice(1)])]} />
      </div>
      <ul className="space-y-2">
        {list.items.map((r) => (
          <li key={r.id} className="card space-y-2 p-3">
            <div className="flex flex-wrap items-center gap-1">
              <Badge tone="red">{r.reason}</Badge><Badge>{r.targetType}</Badge><Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
              <span className="ml-auto text-xs text-slate-500">by @{r.reporter.username} · {timeAgo(r.createdAt)} ago</span>
            </div>
            {r.details && <p className="break-words text-sm text-slate-600 dark:text-slate-300">"{r.details}"</p>}
            <ReportPreview preview={r.preview} />
            <button type="button" className="btn-primary px-3 py-1" onClick={() => setReview(r)}>{r.status === 'open' ? 'Review' : 'View / change'}</button>
          </li>
        ))}
      </ul>
      <ListFooter list={list} emptyTitle={status === 'open' ? 'The queue is clear' : 'No reports found'} emptyText="Nothing matches these filters." />
      {review && <ReportReviewModal key={review.id} report={review} onClose={() => setReview(null)} onSaved={saved} />}
    </div>
  )
}
