import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReelItem from '../components/ReelItem.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { reelFeedApi, getReelApi } from '../api/reelApi.js'
import { getErrorMessage } from '../api/axios.js'

// Vertical, one-reel-at-a-time feed. /reels/:id puts that reel first.
export default function ReelsPage() {
  const { id } = useParams()
  const [reels, setReels] = useState([])
  const [active, setActive] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [muted, setMuted] = useState(false)
  const cursorRef = useRef(null)
  const busyRef = useRef(false)
  const scrollRef = useRef(null)
  const itemRefs = useRef([])

  const load = useCallback(async (reset) => {
    if (busyRef.current) return
    busyRef.current = true
    setLoading(true); setError('')
    try {
      let lead = []
      if (reset && id) {
        try { lead = [await getReelApi(id)] } catch { setNotice('That reel is not available.') }
      }
      const d = await reelFeedApi(reset ? null : cursorRef.current)
      cursorRef.current = d.nextCursor
      setHasMore(!!d.nextCursor)
      setReels((prev) => {
        const base = reset ? lead : prev
        const seen = new Set(base.map((x) => x.id))
        return [...base, ...d.reels.filter((x) => !seen.has(x.id))]
      })
    } catch (e) { setError(getErrorMessage(e)) } finally { busyRef.current = false; setLoading(false) }
  }, [id])

  useEffect(() => {
    setReels([]); setActive(0); setNotice(''); cursorRef.current = null; itemRefs.current = []
    scrollRef.current?.scrollTo(0, 0)
    load(true)
  }, [load])

  // The reel that is at least 70% visible becomes the active (playing) one
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting && e.intersectionRatio >= 0.7) setActive(Number(e.target.dataset.index))
    }, { root, threshold: [0.7] })
    itemRefs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [reels.length])

  // Load the next page when the viewer is within 3 reels of the end
  useEffect(() => {
    if (hasMore && !loading && !error && reels.length > 0 && active >= reels.length - 3) load(false)
  }, [active, reels.length, hasMore, loading, error, load])

  const go = (i) => itemRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const onKeyDown = (e) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'ArrowDown') { e.preventDefault(); go(Math.min(active + 1, reels.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); go(Math.max(active - 1, 0)) }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-lg font-bold">Reels</h1>
        <Link to="/reels/new" className="btn-primary px-3 py-1">+ New reel</Link>
      </div>
      {notice && <p role="status" className="mb-2 text-sm text-slate-500">{notice}</p>}

      <div className="relative">
        <div ref={scrollRef} tabIndex={0} onKeyDown={onKeyDown} aria-label="Reels. Use up and down arrow keys to move between reels."
          className="h-[calc(100dvh-13.5rem)] min-h-[24rem] snap-y snap-mandatory overflow-y-scroll rounded-2xl bg-black outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:h-[calc(100dvh-6rem)]">
          {reels.map((r, i) => (
            <div key={r.id} ref={(el) => { itemRefs.current[i] = el }} data-index={i} className="h-full snap-start snap-always">
              <ReelItem reel={r} active={i === active} near={Math.abs(i - active) <= 1} muted={muted}
                onToggleMute={() => setMuted((m) => !m)} onForceMute={() => setMuted(true)}
                onDeleted={() => setReels((l) => l.filter((x) => x.id !== r.id))} />
            </div>
          ))}
          {loading && reels.length === 0 && <p role="status" className="flex h-full items-center justify-center text-sm text-white/70">Loading reels...</p>}
          {!loading && !error && reels.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center bg-white dark:bg-slate-900">
              <EmptyState icon="🎬" title="No reels yet" text="Be the first to share a short video." />
              <Link to="/reels/new" className="btn-primary">Create a reel</Link>
            </div>
          )}
          {error && <div className="flex h-full items-center justify-center bg-white dark:bg-slate-900"><ErrorState message={error} onRetry={() => load(reels.length === 0)} /></div>}
        </div>

        {reels.length > 1 && (
          <div className="absolute -right-12 top-1/2 hidden -translate-y-1/2 flex-col gap-2 lg:flex">
            <button type="button" className="btn-ghost h-9 w-9 p-0" aria-label="Previous reel" disabled={active === 0} onClick={() => go(active - 1)}>↑</button>
            <button type="button" className="btn-ghost h-9 w-9 p-0" aria-label="Next reel" disabled={active >= reels.length - 1} onClick={() => go(active + 1)}>↓</button>
          </div>
        )}
      </div>
    </div>
  )
}
