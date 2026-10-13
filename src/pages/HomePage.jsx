import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import StoryTray from '../components/StoryTray.jsx'
import PostCard from '../components/PostCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { feedApi } from '../api/postApi.js'
import { getErrorMessage } from '../api/axios.js'

export default function HomePage() {
  const [posts, setPosts] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [firstLoad, setFirstLoad] = useState(true)
  const [error, setError] = useState('')
  const cursorRef = useRef(null)
  const busyRef = useRef(false)
  const sentinel = useRef(null)

  const load = useCallback(async (reset) => {
    if (busyRef.current) return
    busyRef.current = true
    setLoading(true); setError('')
    try {
      const d = await feedApi(reset ? null : cursorRef.current)
      cursorRef.current = d.nextCursor
      setHasMore(!!d.nextCursor)
      setPosts((p) => (reset ? d.posts : [...p, ...d.posts]))
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      busyRef.current = false
      setLoading(false); setFirstLoad(false)
    }
  }, [])
  useEffect(() => { load(true) }, [load])

  // Infinite scroll: load the next page when the sentinel scrolls into view
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore || loading || error) return
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) load(false) }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, error, load, posts.length])

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="sr-only">Home feed</h1>
      <StoryTray />

      {firstLoad && loading && <p role="status" className="py-10 text-center text-sm text-slate-500">Loading your feed...</p>}
      {error && posts.length === 0 && <ErrorState message={error} onRetry={() => load(true)} />}
      {!firstLoad && !error && posts.length === 0 && (
        <div className="card">
          <EmptyState icon="🌱" title="Your feed is empty" text="Follow people or share your first post to see it here." />
          <div className="flex justify-center gap-2 pb-6">
            <Link to="/create" className="btn-primary">Create a post</Link>
            <Link to="/explore" className="btn-ghost">Find people</Link>
          </div>
        </div>
      )}

      {posts.map((p) => <PostCard key={p.id} post={p} onDeleted={(id) => setPosts((l) => l.filter((x) => x.id !== id))} />)}

      {posts.length > 0 && (
        <div ref={sentinel} className="py-4 text-center text-sm text-slate-500">
          {loading && <span role="status">Loading more...</span>}
          {error && <ErrorState message={error} onRetry={() => load(false)} />}
          {!hasMore && !loading && !error && "You're all caught up"}
        </div>
      )}
    </div>
  )
}
