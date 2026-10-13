import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import Avatar from './Avatar.jsx'
import EmptyState from './EmptyState.jsx'
import { storyViewersApi } from '../api/storyApi.js'
import { getErrorMessage } from '../api/axios.js'
import { timeAgo } from '../utils/time.js'

export default function StoryViewersModal({ storyId, onClose }) {
  const [viewers, setViewers] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { storyViewersApi(storyId).then((d) => setViewers(d.viewers)).catch((e) => setError(getErrorMessage(e))) }, [storyId])
  return (
    <Modal title="Viewed by" onClose={onClose}>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      {!viewers && !error && <p role="status" className="text-sm text-slate-500">Loading...</p>}
      {viewers?.length === 0 && <EmptyState icon="👀" title="No views yet" />}
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {viewers?.map((v) => (
          <li key={v.user.id} className="flex items-center gap-3 py-2">
            <Avatar name={v.user.fullName} src={v.user.profilePhoto} />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{v.user.fullName}</span><span className="block truncate text-xs text-slate-500">@{v.user.username}</span></span>
            <span className="text-xs text-slate-400">{timeAgo(v.viewedAt)}</span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
