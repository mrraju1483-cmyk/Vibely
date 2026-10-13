import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { useCall } from '../context/CallContext.jsx'
import { callHistoryApi } from '../api/callApi.js'
import { getErrorMessage } from '../api/axios.js'
import { formatDuration, timeAgo } from '../utils/time.js'

function summary(c) {
  const kind = c.type === 'video' ? 'Video' : 'Voice'
  if (c.status === 'completed') return `${kind} · ${formatDuration(c.duration)}`
  if (c.status === 'missed' || c.status === 'canceled') return c.direction === 'incoming' ? `Missed ${kind.toLowerCase()} call` : `${kind} · No answer`
  if (c.status === 'rejected') return c.direction === 'incoming' ? `${kind} · Declined` : `${kind} · Declined by them`
  return kind
}

export default function CallsPage() {
  const { startCall, inCall } = useCall()
  const [calls, setCalls] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const cursorRef = useRef(null)

  const load = useCallback(async (more) => {
    setLoading(true); setError('')
    try {
      const d = await callHistoryApi(more ? cursorRef.current : null)
      cursorRef.current = d.nextCursor; setCursor(d.nextCursor)
      setCalls((l) => (more ? [...l, ...d.calls] : d.calls))
    } catch (e) { setError(getErrorMessage(e)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load(false) }, [load])

  const btn = 'rounded-full p-2 text-lg hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40 dark:hover:bg-slate-800'
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-xl font-bold">Calls</h1>
      {error && <ErrorState message={error} onRetry={() => load(false)} />}
      {loading && calls.length === 0 && !error && <p role="status" className="py-10 text-center text-sm text-slate-500">Loading calls...</p>}
      {!loading && !error && calls.length === 0 && <div className="card"><EmptyState icon="📞" title="No calls yet" text="Start a voice or video call from any chat." /><p className="pb-6 text-center"><Link to="/chat" className="btn-primary">Open chats</Link></p></div>}
      {calls.length > 0 && (
        <ul className="card divide-y divide-slate-200 dark:divide-slate-800">
          {calls.map((c) => {
            const missed = c.direction === 'incoming' && (c.status === 'missed' || c.status === 'canceled')
            return (
              <li key={c.id} className="flex items-center gap-3 p-3">
                <Avatar name={c.other.fullName} src={c.other.profilePhoto} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${missed ? 'text-red-500' : ''}`}>{c.other.fullName}</p>
                  <p className="truncate text-xs text-slate-500"><span aria-hidden="true">{c.direction === 'outgoing' ? '↗' : '↙'}</span> <span className="sr-only">{c.direction}</span> {summary(c)} · {timeAgo(c.createdAt)}</p>
                </div>
                {c.otherActive && (
                  <>
                    <button type="button" className={btn} aria-label={`Voice call ${c.other.fullName}`} disabled={inCall} onClick={() => startCall(c.other, 'voice')}>📞</button>
                    <button type="button" className={btn} aria-label={`Video call ${c.other.fullName}`} disabled={inCall} onClick={() => startCall(c.other, 'video')}>🎥</button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {cursor && !loading && <button type="button" className="btn-ghost mt-3 w-full" onClick={() => load(true)}>Load more</button>}
    </div>
  )
}
