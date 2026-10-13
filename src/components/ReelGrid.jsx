import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from './EmptyState.jsx'
import ErrorState from './ErrorState.jsx'
import { getErrorMessage } from '../api/axios.js'

// fetchPage(cursor) -> { reels, nextCursor }. Thumbnails only load video metadata (no autoplay), so the grid stays light.
export default function ReelGrid({ fetchPage, emptyTitle = 'No reels yet', emptyText }) {
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage
  const cursorRef = useRef(null)
  const [reels, setReels] = useState([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (reset) => {
    setLoading(true); setError('')
    try {
      const d = await fetchRef.current(reset ? null : cursorRef.current)
      cursorRef.current = d.nextCursor
      setMore(!!d.nextCursor)
      setReels((p) => (reset ? d.reels : [...p, ...d.reels]))
    } catch (e) { setError(getErrorMessage(e)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load(true) }, [load])

  if (error) return <ErrorState message={error} onRetry={() => load(reels.length === 0)} />
  if (!loading && reels.length === 0) return <EmptyState icon="🎬" title={emptyTitle} text={emptyText} />
  return (
    <>
      <ul className="grid grid-cols-3 gap-1">
        {reels.map((r) => (
          <li key={r.id} className="relative aspect-[9/16] overflow-hidden bg-slate-200 dark:bg-slate-800">
            <Link to={`/reels/${r.id}`} aria-label={r.caption ? `Open reel: ${r.caption.slice(0, 60)}` : 'Open reel'} className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <video src={r.videoUrl} preload="metadata" muted playsInline className="h-full w-full object-cover" />
              <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[10px] text-white">▶ {r.viewsCount}</span>
            </Link>
          </li>
        ))}
      </ul>
      {loading && <p role="status" className="py-3 text-center text-sm text-slate-500">Loading...</p>}
      {more && !loading && <button type="button" className="btn-ghost mt-2 w-full" onClick={() => load(false)}>Load more</button>}
    </>
  )
}
