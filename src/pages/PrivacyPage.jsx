import { useState } from 'react'
import Toggle from '../components/Toggle.jsx'
import BlockedUsersList from '../components/BlockedUsersList.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { updatePrivacyApi } from '../api/userApi.js'
import { updateStoryPrivacyApi } from '../api/storyApi.js'
import { updateChatPrivacyApi } from '../api/chatApi.js'
import { getErrorMessage } from '../api/axios.js'

export default function PrivacyPage() {
  const { currentUser, refreshUser } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function setPrivate(value) {
    setSaving(true); setError('')
    try { await updatePrivacyApi(value); await refreshUser() } catch (e) { setError(getErrorMessage(e)) } finally { setSaving(false) }
  }

  async function setStoryFollowersOnly(value) {
    setSaving(true); setError('')
    try { await updateStoryPrivacyApi(value ? 'followers' : 'public'); await refreshUser() } catch (e) { setError(getErrorMessage(e)) } finally { setSaving(false) }
  }

  async function setChat(patch) {
    setSaving(true); setError('')
    try { await updateChatPrivacyApi(patch); await refreshUser() } catch (e) { setError(getErrorMessage(e)) } finally { setSaving(false) }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-xl font-bold">Privacy</h1>
      {error && <p role="alert" className="mb-2 text-sm text-red-500">{error}</p>}
      <div className="card divide-y divide-slate-200 dark:divide-slate-800">
        <Toggle label="Private Account" description="Only approved followers see your posts" checked={!!currentUser?.isPrivate} onChange={setPrivate} disabled={saving} />
        <Toggle label="Online Status" description="Let people you chat with see when you are online" checked={currentUser?.showOnlineStatus !== false} onChange={(v) => setChat({ showOnlineStatus: v })} disabled={saving} />
        <Toggle label="Last Seen" description="Show when you were last online (needs Online Status)" checked={currentUser?.showLastSeen !== false} onChange={(v) => setChat({ showLastSeen: v })} disabled={saving} />
        <Toggle label="Story Privacy" description="New stories are shown to your followers only" checked={currentUser?.storyVisibility === 'followers'} onChange={setStoryFollowersOnly} disabled={saving} />
        <Toggle label="Message Privacy" description="Only people you follow can start a chat with you" checked={currentUser?.messagePrivacy === 'following'} onChange={(v) => setChat({ messagePrivacy: v ? 'following' : 'everyone' })} disabled={saving} />
        <BlockedUsersList />
      </div>
    </div>
  )
}
