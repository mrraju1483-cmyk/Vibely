import { useCallback, useEffect, useState } from 'react'
import StoryViewer from './StoryViewer.jsx'
import CreateStoryModal from './CreateStoryModal.jsx'
import EmptyState from './EmptyState.jsx'
import ErrorState from './ErrorState.jsx'
import { userStoriesApi } from '../api/storyApi.js'
import { getErrorMessage } from '../api/axios.js'
import { timeAgo } from '../utils/time.js'
import { markViewed, removeStory } from '../utils/storyState.js'

// Profile "Stories" tab: this person's active (unexpired, visible to you) stories
export default function ProfileStories({ userId, isMe }) {
  const [group, setGroup] = useState(undefined) // undefined = loading, null = none
  const [error, setError] = useState('')
  const [viewerAt, setViewerAt] = useState(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try { setGroup((await userStoriesApi(userId)).group) } catch (e) { setError(getErrorMessage(e)) }
  }, [userId])
  useEffect(() => { setGroup(undefined); load() }, [load])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (group === undefined) return <p role="status" className="py-6 text-center text-sm text-slate-500">Loading stories...</p>
  return (
    <div className="space-y-3">
      {isMe && <button type="button" className="btn-primary" onClick={() => setCreating(true)}>+ Add story</button>}
      {!group ? <EmptyState icon="⏳" title="No active stories" text="Stories disappear after 24 hours." /> : (
        <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4">
          {group.stories.map((s, i) => (
            <li key={s.id} className="relative aspect-[9/16] overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800">
              <button type="button" aria-label={`Open story ${i + 1}, posted ${timeAgo(s.createdAt)} ago`} className="h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" onClick={() => setViewerAt(i)}>
                {s.mediaType === 'video' ? <video src={s.mediaUrl} preload="metadata" muted playsInline className="h-full w-full object-cover" /> : <img src={s.mediaUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
                <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[10px] text-white">{timeAgo(s.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {viewerAt !== null && group && (
        <StoryViewer groups={[group]} startStory={viewerAt} onClose={() => setViewerAt(null)}
          onViewed={(id) => setGroup((g) => (g ? markViewed([g], id)[0] : g))}
          onDeleted={(id) => setGroup((g) => (g ? removeStory([g], id)[0] || null : g))} />
      )}
      {creating && <CreateStoryModal onClose={() => setCreating(false)} onCreated={async () => { setCreating(false); await load() }} />}
    </div>
  )
}
