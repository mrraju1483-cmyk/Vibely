import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from './EmptyState.jsx'
import ErrorState from './ErrorState.jsx'
import { getErrorMessage } from '../api/axios.js'

// fetchPage(cursor) -> { posts, nextCursor }
export default function PostGrid({ fetchPage, emptyTitle = 'No posts yet', emptyText }) {
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage
  const cursorRef = useRef(null)
  const [posts, setPosts] = useState([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (reset) => {
    setLoading(true); setError('')
    try {
      const d = await fetchRef.current(reset ? null : cursorRef.current)
      cursorRef.current = d.nextCursor
      setMore(!!d.nextCursor)
      setPosts((p) => (reset ? d.posts : [...p, ...d.posts]))
    } catch (e) { setError(getErrorMessage(e)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load(true) }, [load])

  if (error) return <ErrorState message={error} onRetry={() => load(posts.length === 0)} />
  if (!loading && posts.length === 0) return <EmptyState icon="📷" title={emptyTitle} text={emptyText} />
  return (
    <>
      <ul className="grid grid-cols-3 gap-1">
        {posts.map((p) => (
          <li key={p.id} className="relative aspect-square overflow-hidden bg-slate-200 dark:bg-slate-800">
            <Link to={`/post/${p.id}`} aria-label={p.caption ? `Open post: ${p.caption.slice(0, 60)}` : 'Open post'} className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              {p.mediaType === 'video'
                ? <><video src={p.mediaUrl} preload="metadata" muted playsInline className="h-full w-full object-cover" /><span aria-hidden="true" className="absolute right-1 top-1 text-sm text-white drop-shadow">▶</span></>
                : <img src={p.mediaUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
            </Link>
          </li>
        ))}
      </ul>
      {loading && <p role="status" className="py-3 text-center text-sm text-slate-500">Loading...</p>}
      {more && !loading && <button type="button" className="btn-ghost mt-2 w-full" onClick={() => load(false)}>Load more</button>}
    </>
  )
}
