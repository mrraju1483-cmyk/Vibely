import { useCallback, useEffect, useRef, useState } from 'react'
import Avatar from './Avatar.jsx'
import StoryViewersModal from './StoryViewersModal.jsx'
import { viewStoryApi, deleteStoryApi } from '../api/storyApi.js'
import { getErrorMessage } from '../api/axios.js'
import { timeAgo } from '../utils/time.js'

const IMAGE_MS = 5000

// Full-screen viewer. groups: [{ user, stories }]. Tap the left/right side, use arrow keys, or let it advance by itself.
export default function StoryViewer({ groups, startGroup = 0, startStory = 0, onClose, onViewed, onDeleted }) {
  const [gi, setGi] = useState(startGroup)
  const [si, setSi] = useState(startStory)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [showViewers, setShowViewers] = useState(false)
  const [error, setError] = useState('')
  const progressRef = useRef(0)
  const videoRef = useRef(null)
  const closeBtn = useRef(null)

  const group = groups[gi]
  const story = group?.stories[si]
  const halted = paused || showViewers
  const setProg = (p) => { progressRef.current = p; setProgress(p) }

  const next = useCallback(() => {
    if (!group) return
    if (si < group.stories.length - 1) setSi(si + 1)
    else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0) }
    else onClose()
  }, [group, si, gi, groups.length, onClose])

  const prev = useCallback(() => {
    if (si > 0) setSi(si - 1)
    else if (gi > 0) { setGi(gi - 1); setSi(groups[gi - 1].stories.length - 1) }
    else setProg(0)
  }, [si, gi, groups])

  // The story list can change underneath us (deleted elsewhere): close instead of crashing
  useEffect(() => { if (!group || !story) onClose() }, [group, story, onClose])

  // Reset the progress bar whenever the story changes (declared before the timer so it runs first)
  useEffect(() => { setProg(0); setError('') }, [story?.id])

  // Photos advance after 5 seconds. Videos advance when they end.
  useEffect(() => {
    if (!story || story.mediaType !== 'image' || halted) return
    const base = progressRef.current * IMAGE_MS
    const t0 = Date.now()
    const id = setInterval(() => {
      const p = (base + Date.now() - t0) / IMAGE_MS
      if (p >= 1) { clearInterval(id); setProg(1); next() } else setProg(p)
    }, 50)
    return () => clearInterval(id)
  }, [story?.id, story?.mediaType, halted, next])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (halted) v.pause()
    else v.play().catch(() => { v.muted = true; v.play().catch(() => {}) }) // browsers may block sound until a tap
  }, [halted, story?.id])

  // Mark as viewed (the server ignores repeats and your own stories)
  useEffect(() => {
    if (!story || story.isMine || story.viewedByMe) return
    viewStoryApi(story.id).then(() => onViewed?.(story.id)).catch(() => {})
  }, [story?.id])

  useEffect(() => {
    const onKey = (e) => {
      if (showViewers) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showViewers, next, prev, onClose])

  useEffect(() => {
    const previous = document.activeElement
    closeBtn.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = ''; previous?.focus?.() }
  }, [])

  async function remove() {
    if (!window.confirm('Delete this story?')) return
    try {
      await deleteStoryApi(story.id)
      const wasLast = group.stories.length <= 1
      onDeleted?.(story.id)
      if (wasLast) { if (gi >= groups.length - 1) onClose(); else setSi(0) }
      else setSi(Math.min(si, group.stories.length - 2))
    } catch (e) { setError(getErrorMessage(e)) }
  }

  if (!group || !story) return null
  const iconBtn = 'flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white'
  return (
    <div role="dialog" aria-modal="true" aria-label={`${group.user.username}'s story`} className="fixed inset-0 z-40 flex items-center justify-center bg-black">
      <div className="relative h-full w-full max-w-md overflow-hidden bg-black sm:h-[95vh] sm:rounded-2xl">
        {story.mediaType === 'video' ? (
          <video key={story.id} ref={videoRef} src={story.mediaUrl} autoPlay playsInline className="h-full w-full object-contain"
            onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) setProg(v.currentTime / v.duration) }} onEnded={next} />
        ) : (
          <img key={story.id} src={story.mediaUrl} alt={story.caption || `Story by ${group.user.username}`} className="h-full w-full object-contain" />
        )}

        <div className="absolute inset-x-0 top-16 bottom-24 flex">
          <button type="button" aria-label="Previous story" className="h-full w-1/3 focus-visible:outline-none" onClick={prev} />
          <button type="button" aria-label="Next story" className="ml-auto h-full w-1/3 focus-visible:outline-none" onClick={next} />
        </div>

        <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-3">
          <div className="mb-2 flex gap-1" aria-hidden="true">
            {group.stories.map((s, i) => (
              <div key={s.id} className="h-1 flex-1 overflow-hidden rounded bg-white/30">
                <div className="h-full bg-white" style={{ width: i < si ? '100%' : i === si ? `${Math.min(1, progress) * 100}%` : '0%' }} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-white">
            <Avatar name={group.user.fullName} src={group.user.profilePhoto} size="h-8 w-8" />
            <span className="text-sm font-semibold">{group.user.username}</span>
            <span className="text-xs opacity-70">{timeAgo(story.createdAt)}</span>
            <span className="ml-auto flex gap-2">
              <button type="button" className={iconBtn} aria-pressed={paused} aria-label={paused ? 'Play' : 'Pause'} onClick={() => setPaused(!paused)}>{paused ? '▶' : '⏸'}</button>
              {story.isMine && <button type="button" className={iconBtn} aria-label="Delete story" onClick={remove}>🗑️</button>}
              <button type="button" ref={closeBtn} className={iconBtn} aria-label="Close" onClick={onClose}>✕</button>
            </span>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
          {story.caption && <p className="break-words text-sm">{story.caption}</p>}
          {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
          {story.isMine && <button type="button" className="rounded-full bg-black/40 px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" onClick={() => setShowViewers(true)}>👁 {story.viewersCount} {story.viewersCount === 1 ? 'view' : 'views'}</button>}
        </div>
      </div>
      {showViewers && <StoryViewersModal storyId={story.id} onClose={() => setShowViewers(false)} />}
    </div>
  )
}
