import { useState } from 'react'
import { followApi, unfollowApi } from '../api/userApi.js'
import { getErrorMessage } from '../api/axios.js'

// status: 'none' | 'following' | 'pending'. onChange(newStatus) lets the parent update.
export default function FollowButton({ userId, status, isPrivate, onChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function click() {
    setBusy(true); setError('')
    try {
      if (status === 'none') onChange((await followApi(userId)).followStatus)
      else { await unfollowApi(userId); onChange('none') }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const label = status === 'following' ? 'Following' : status === 'pending' ? 'Requested' : isPrivate ? 'Request' : 'Follow'
  return (
    <span className="inline-flex flex-col items-end">
      <button type="button" onClick={click} disabled={busy} aria-pressed={status !== 'none'}
        className={`${status === 'none' ? 'btn-primary' : 'btn-ghost'} px-4 py-1.5`}>
        {busy ? '...' : label}
      </button>
      {error && <span role="alert" className="mt-1 text-xs text-red-500">{error}</span>}
    </span>
  )
}
