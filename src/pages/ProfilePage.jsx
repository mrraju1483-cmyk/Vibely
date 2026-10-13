import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ProfileHeader from '../components/ProfileHeader.jsx'
import UserListModal from '../components/UserListModal.jsx'
import EditProfileModal from '../components/EditProfileModal.jsx'
import FollowRequests from '../components/FollowRequests.jsx'
import ReportModal from '../components/ReportModal.jsx'
import PostGrid from '../components/PostGrid.jsx'
import ProfileStories from '../components/ProfileStories.jsx'
import ReelGrid from '../components/ReelGrid.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useChat } from '../context/ChatContext.jsx'
import { getProfileApi, followersApi, followingApi, blockApi, unblockApi } from '../api/userApi.js'
import { userPostsApi, savedPostsApi, reportUserApi } from '../api/postApi.js'
import { userReelsApi, savedReelsApi } from '../api/reelApi.js'
import { getErrorMessage } from '../api/axios.js'

export default function ProfilePage() {
  const { id } = useParams()
  const { currentUser, refreshUser, logout } = useAuth()
  const { openDirect } = useChat()
  const nav = useNavigate()
  const [msgError, setMsgError] = useState('')
  const targetId = id || currentUser.id
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('Posts')
  const [modal, setModal] = useState(null) // 'followers' | 'following' | 'edit' | 'report' | null
  const [busy, setBusy] = useState(false)
  const [savedKind, setSavedKind] = useState('posts') // Saved tab: 'posts' | 'reels'

  const load = useCallback(async () => {
    setError('')
    try { setProfile(await getProfileApi(targetId)) } catch (err) { setProfile(null); setError(getErrorMessage(err)) }
  }, [targetId])

  useEffect(() => { setProfile(null); setModal(null); setTab('Posts'); load() }, [load])

  async function messageUser() {
    setMsgError('')
    try { const c = await openDirect(profile.id); nav(`/chat/${c.id}`) } catch (err) { setMsgError(getErrorMessage(err)) }
  }

  async function toggleBlock() {
    const blocking = !profile.isBlockedByMe
    if (blocking && !window.confirm(`Block @${profile.username}? They will no longer be able to find or follow you.`)) return
    setBusy(true)
    try { await (blocking ? blockApi(profile.id) : unblockApi(profile.id)); await load() } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) }
  }

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!profile) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading profile...</p>

  const tabs = profile.isMe ? ['Posts', 'Reels', 'Stories', 'Saved'] : ['Posts', 'Reels', 'Stories']
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <ProfileHeader profile={profile} busy={busy} onEdit={() => setModal('edit')} onOpenList={setModal}
        onFollowChange={load} onBlockToggle={toggleBlock} onReport={() => setModal('report')} onMessage={messageUser}
        onLogout={async () => { await logout(); nav('/login', { replace: true }) }} />
      {msgError && <p role="alert" className="text-sm text-red-500">{msgError}</p>}
      {profile.isMe && <FollowRequests onResolved={load} />}

      {profile.isBlockedByMe ? (
        <EmptyState icon="🚫" title="You blocked this user" text="Unblock them to see their content again." />
      ) : !profile.canViewContent ? (
        <EmptyState icon="🔒" title="This account is private" text="Follow this account to see their posts." />
      ) : (
        <>
          <div role="tablist" className="flex justify-around border-b border-slate-200 dark:border-slate-800">
            {tabs.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-brand-600 text-brand-600' : 'text-slate-500'}`}>{t}</button>)}
          </div>
          {tab === 'Posts' && <PostGrid key={`posts-${profile.id}`} fetchPage={(c) => userPostsApi(profile.id, c)} emptyTitle="No posts yet" emptyText={profile.isMe ? 'Share your first post from the Create tab.' : undefined} />}
          {tab === 'Saved' && (
            <>
              <div className="mb-2 flex gap-2">
                {['posts', 'reels'].map((k) => <button key={k} type="button" aria-pressed={savedKind === k} onClick={() => setSavedKind(k)} className={`btn ${savedKind === k ? 'bg-brand-600 text-white' : 'btn-ghost'}`}>{k === 'posts' ? 'Posts' : 'Reels'}</button>)}
              </div>
              {savedKind === 'posts'
                ? <PostGrid key="saved-posts" fetchPage={savedPostsApi} emptyTitle="Nothing saved yet" emptyText="Tap the bookmark on a post to save it here." />
                : <ReelGrid key="saved-reels" fetchPage={savedReelsApi} emptyTitle="No saved reels" emptyText="Tap Save on a reel to keep it here." />}
            </>
          )}
          {tab === 'Stories' && <ProfileStories key={`stories-${profile.id}`} userId={profile.id} isMe={profile.isMe} />}
          {tab === 'Reels' && (
            <>
              {profile.isMe && <Link to="/reels/new" className="btn-primary mb-2">+ New reel</Link>}
              <ReelGrid key={`reels-${profile.id}`} fetchPage={(c) => userReelsApi(profile.id, c)} emptyTitle="No reels yet" emptyText={profile.isMe ? 'Share your first short video.' : undefined} />
            </>
          )}
        </>
      )}

      {modal === 'followers' && <UserListModal title="Followers" fetchPage={(p) => followersApi(profile.id, p)} onClose={() => setModal(null)} />}
      {modal === 'following' && <UserListModal title="Following" fetchPage={(p) => followingApi(profile.id, p)} onClose={() => setModal(null)} />}
      {modal === 'edit' && <EditProfileModal user={currentUser} onClose={() => setModal(null)} onSaved={async () => { await refreshUser(); await load(); setModal(null) }} />}
      {modal === 'report' && <ReportModal title={`Report @${profile.username}`} onClose={() => setModal(null)} onSubmit={(body) => reportUserApi(profile.id, body)} />}
    </div>
  )
}
