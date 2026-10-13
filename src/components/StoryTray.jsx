import { useCallback, useEffect, useState } from 'react'
import StoryList from './StoryList.jsx'
import StoryViewer from './StoryViewer.jsx'
import CreateStoryModal from './CreateStoryModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { storiesApi } from '../api/storyApi.js'
import { getErrorMessage } from '../api/axios.js'
import { markViewed, removeStory } from '../utils/storyState.js'

// Home-page story row + viewer + composer
export default function StoryTray() {
  const { currentUser } = useAuth()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewer, setViewer] = useState(null) // { gi, si }
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try { setGroups((await storiesApi()).groups) } catch (e) { setError(getErrorMessage(e)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  function open(index) {
    const first = groups[index].stories.findIndex((s) => !s.viewedByMe)
    setViewer({ gi: index, si: first === -1 ? 0 : first })
  }

  return (
    <section aria-label="Stories">
      {loading ? <p role="status" className="py-4 text-xs text-slate-500">Loading stories...</p> : (
        <StoryList groups={groups} me={currentUser} onOpen={open} onAdd={() => setCreating(true)} />
      )}
      {error && <p role="alert" className="text-xs text-red-500">{error} <button type="button" className="underline" onClick={load}>Retry</button></p>}
      {viewer && (
        <StoryViewer groups={groups} startGroup={viewer.gi} startStory={viewer.si} onClose={() => setViewer(null)}
          onViewed={(id) => setGroups((g) => markViewed(g, id))} onDeleted={(id) => setGroups((g) => removeStory(g, id))} />
      )}
      {creating && <CreateStoryModal onClose={() => setCreating(false)} onCreated={async () => { setCreating(false); await load() }} />}
    </section>
  )
}
