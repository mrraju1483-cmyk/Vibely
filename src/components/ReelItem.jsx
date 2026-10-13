import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from './Avatar.jsx'
import ReelCommentsSheet from './ReelCommentsSheet.jsx'
import ShareModal from './ShareModal.jsx'
import ReportModal from './ReportModal.jsx'
import { deleteReelApi, likeReelApi, unlikeReelApi, saveReelApi, unsaveReelApi, shareReelApi, viewReelApi, reportReelApi } from '../api/reelApi.js'
import { getErrorMessage } from '../api/axios.js'

const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n))
const rail = 'flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white'

// One full-height reel. `active` = the one on screen (plays). `near` = active or adjacent (video loaded). Others are not loaded at all.
export default function ReelItem({ reel, active, near, muted, onToggleMute, onForceMute, onDeleted }) {
  const [r, setR] = useState(reel)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [sheet, setSheet] = useState(null) // 'comments' | 'share' | 'report'
  const [error, setError] = useState('')
  const videoRef = useRef(null)
  const viewed = useRef(false)

  // Leaving the screen: stop, rewind, forget a manual pause
  useEffect(() => {
    if (active) return
    setPaused(false); setProgress(0)
    const v = videoRef.current
    if (v) { v.pause(); try { v.currentTime = 0 } catch { /* not loaded yet */ } }
  }, [active])

  // Autoplay while visible, pause when not (or when the viewer paused it)
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (active && !paused) v.play().catch(() => { if (!v.muted) onForceMute() }) // browsers may refuse sound: fall back to muted
    else v.pause()
  }, [active, paused, near, muted, onForceMute])

  // Count a view once the reel has been on screen for 1.5s
  useEffect(() => {
    if (!active || r.isMine || viewed.current) return
    const id = setTimeout(() => { viewed.current = true; viewReelApi(r.id).catch(() => {}) }, 1500)
    return () => clearTimeout(id)
  }, [active, r.id, r.isMine])

  async function toggleLike() {
    const was = r.likedByMe
    setError('')
    setR((x) => ({ ...x, likedByMe: !was, likesCount: Math.max(0, x.likesCount + (was ? -1 : 1)) }))
    try { const d = await (was ? unlikeReelApi : likeReelApi)(r.id); setR((x) => ({ ...x, likedByMe: d.liked, likesCount: d.likesCount })) } catch (e) {
      setR((x) => ({ ...x, likedByMe: was, likesCount: Math.max(0, x.likesCount + (was ? 1 : -1)) })); setError(getErrorMessage(e))
    }
  }
  async function toggleSave() {
    const was = r.savedByMe
    setError(''); setR((x) => ({ ...x, savedByMe: !was }))
    try { await (was ? unsaveReelApi : saveReelApi)(r.id) } catch (e) { setR((x) => ({ ...x, savedByMe: was })); setError(getErrorMessage(e)) }
  }
  async function remove() {
    if (!window.confirm('Delete this reel? This cannot be undone.')) return
    try { await deleteReelApi(r.id); onDeleted() } catch (e) { setError(getErrorMessage(e)) }
  }

  return (
    <article className="relative h-full w-full overflow-hidden bg-black" aria-label={`Reel by ${r.author.username}`}>
      {near ? (
        <video ref={videoRef} src={r.videoUrl} loop playsInline muted={muted} preload={active ? 'auto' : 'metadata'}
          aria-label={r.caption || `Reel by ${r.author.username}`} className="h-full w-full object-contain"
          onClick={() => setPaused((p) => !p)}
          onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) setProgress(v.currentTime / v.duration) }} />
      ) : <div className="h-full w-full bg-black" />}

      {paused && active && <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl text-white/80">▶</span>}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />

      <div className="absolute bottom-3 left-3 right-16 space-y-1 text-white">
        <Link to={`/profile/${r.author.id}`} className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <Avatar name={r.author.fullName} src={r.author.profilePhoto} size="h-9 w-9" />
          <span className="text-sm font-semibold">{r.author.username}</span>
        </Link>
        {r.caption && <p className="line-clamp-3 break-words text-sm">{r.caption}</p>}
        {r.hashtags.length > 0 && <p className="line-clamp-1 text-xs text-pink-300">{r.hashtags.map((h) => `#${h}`).join(' ')}</p>}
        {r.location && <p className="text-xs opacity-80">📍 {r.location}</p>}
        <p className="text-xs opacity-70">{compact(r.viewsCount)} views</p>
        {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      </div>

      <div className="absolute bottom-3 right-1 flex flex-col items-center gap-1">
        <button type="button" className={rail} aria-pressed={r.likedByMe} aria-label="Like" onClick={toggleLike}><span className="text-2xl">{r.likedByMe ? '❤️' : '🤍'}</span>{compact(r.likesCount)}</button>
        <button type="button" className={rail} aria-label="Comments" onClick={() => setSheet('comments')}><span className="text-2xl">💬</span>{compact(r.commentsCount)}</button>
        <button type="button" className={rail} aria-label="Share" onClick={() => setSheet('share')}><span className="text-2xl">↗️</span>{compact(r.sharesCount)}</button>
        <button type="button" className={rail} aria-pressed={r.savedByMe} aria-label="Save" onClick={toggleSave}><span className="text-2xl">{r.savedByMe ? '🔖' : '📑'}</span>Save</button>
        <button type="button" className={rail} aria-pressed={paused} aria-label={paused ? 'Play' : 'Pause'} onClick={() => setPaused((p) => !p)}><span className="text-xl">{paused ? '▶' : '⏸'}</span></button>
        <button type="button" className={rail} aria-pressed={muted} aria-label={muted ? 'Unmute' : 'Mute'} onClick={onToggleMute}><span className="text-xl">{muted ? '🔇' : '🔊'}</span></button>
        {r.isMine
          ? <button type="button" className={rail} aria-label="Delete reel" onClick={remove}><span className="text-xl">🗑️</span></button>
          : <button type="button" className={rail} aria-label="Report reel" onClick={() => setSheet('report')}><span className="text-xl">🚩</span></button>}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20" aria-hidden="true"><div className="h-full bg-white" style={{ width: `${progress * 100}%` }} /></div>

      {sheet === 'comments' && <ReelCommentsSheet reelId={r.id} onClose={() => setSheet(null)} onCountChange={(n) => setR((x) => ({ ...x, commentsCount: Math.max(0, x.commentsCount + n) }))} />}
      {sheet === 'share' && <ShareModal post={r} path={`/reels/${r.id}`} share={shareReelApi} onClose={() => setSheet(null)} onShared={(n) => setR((x) => ({ ...x, sharesCount: n }))} />}
      {sheet === 'report' && <ReportModal title="Report reel" onClose={() => setSheet(null)} onSubmit={(body) => reportReelApi(r.id, body)} />}
    </article>
  )
}
