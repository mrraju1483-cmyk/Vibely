import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Avatar from '../../components/Avatar.jsx'
import ErrorState from '../../components/ErrorState.jsx'
import ReasonModal from '../../components/admin/ReasonModal.jsx'
import { Badge, StatCard, fmtDate } from '../../components/admin/AdminBits.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { adminUserApi, adminSetUserActiveApi, adminRemoveUserApi } from '../../api/adminApi.js'
import { getErrorMessage } from '../../api/axios.js'

export default function AdminUserPage() {
  const { id } = useParams()
  const { currentUser } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null) // 'status' | 'remove'
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setError('')
    try { setData(await adminUserApi(id)) } catch (e) { setError(getErrorMessage(e)) }
  }, [id])
  useEffect(() => { setData(null); load() }, [load])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!data) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading user...</p>
  const { user: u, activity: a, recentPosts } = data
  const protectedAccount = u.role === 'admin' || u.id === currentUser.id
  const canAct = !protectedAccount && !u.removed

  return (
    <div className="space-y-5">
      <Link to="/admin/users" className="text-sm text-brand-600">← All users</Link>
      <header className="flex items-start gap-3">
        <Avatar name={u.fullName} size="h-14 w-14" />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{u.fullName}</h2>
          <p className="text-sm text-slate-500">@{u.username}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {u.role === 'admin' && <Badge tone="purple">Admin</Badge>}
            {u.removed ? <Badge tone="red">Removed</Badge> : u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Deactivated</Badge>}
            {u.isVerified ? <Badge>Verified</Badge> : <Badge>Unverified</Badge>}
            {u.isPrivate && <Badge>Private</Badge>}
          </div>
        </div>
      </header>

      <dl className="card grid gap-x-4 gap-y-2 p-4 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-slate-500">Email</dt><dd className="break-all">{u.email}</dd></div>
        <div><dt className="text-xs text-slate-500">Phone</dt><dd>{u.phone || '—'}</dd></div>
        <div><dt className="text-xs text-slate-500">Joined</dt><dd>{fmtDate(u.createdAt)}</dd></div>
        <div><dt className="text-xs text-slate-500">Last seen</dt><dd>{fmtDate(u.lastSeenAt)}</dd></div>
        {u.bio && <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Bio</dt><dd className="whitespace-pre-line break-words">{u.bio}</dd></div>}
      </dl>

      <section aria-label="Activity" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Posts" value={a.posts} /><StatCard label="Reels" value={a.reels} />
        <StatCard label="Active stories" value={a.activeStories} /><StatCard label="Comments" value={a.comments} />
        <StatCard label="Followers" value={a.followers} /><StatCard label="Following" value={a.following} />
        <StatCard label="Reports against" value={a.reportsAgainst} /><StatCard label="Reports made" value={a.reportsMade} />
      </section>

      {recentPosts.length > 0 && (
        <section aria-label="Recent posts">
          <h3 className="mb-2 font-semibold">Recent posts</h3>
          <ul className="grid grid-cols-3 gap-1 sm:grid-cols-6">
            {recentPosts.map((p) => (
              <li key={p.id} className="aspect-square overflow-hidden bg-slate-200 dark:bg-slate-800" title={p.caption}>
                {p.mediaType === 'video' ? <video src={p.mediaUrl} preload="metadata" muted className="h-full w-full object-cover" /> : <img src={p.mediaUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Actions" className="card space-y-3 p-4">
        <h3 className="font-semibold">Actions</h3>
        {notice && <p role="status" className="text-sm text-green-600">{notice}</p>}
        {protectedAccount && <p className="text-sm text-slate-500">{u.id === currentUser.id ? 'You cannot change your own account here.' : 'Admin accounts can only be changed from the command line (npm run admin:revoke).'}</p>}
        {u.removed && <p className="text-sm text-slate-500">This account was permanently removed and anonymized.</p>}
        {canAct && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => setModal('status')}>{u.isActive ? 'Deactivate account' : 'Reactivate account'}</button>
            <button type="button" className="btn border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950" onClick={() => setModal('remove')}>Remove account permanently</button>
          </div>
        )}
      </section>

      {modal === 'status' && (
        <ReasonModal title={u.isActive ? `Deactivate @${u.username}` : `Reactivate @${u.username}`} confirmLabel={u.isActive ? 'Deactivate' : 'Reactivate'} danger={u.isActive}
          description={u.isActive ? 'They are signed out immediately and cannot log in. Their content stays but is hidden from others. You can reactivate later.' : 'They will be able to log in again.'}
          onClose={() => setModal(null)}
          onSubmit={async (reason) => { await adminSetUserActiveApi(u.id, !u.isActive, reason); setModal(null); setNotice(u.isActive ? 'Account deactivated.' : 'Account reactivated.'); await load() }} />
      )}
      {modal === 'remove' && (
        <ReasonModal title={`Remove @${u.username}`} confirmLabel="Remove permanently" danger confirmText={u.username}
          description="This permanently deletes their posts, reels, stories, comments and likes and anonymizes the account. Their messages stay in other people's chats as 'Removed user'. This cannot be undone."
          onClose={() => setModal(null)}
          onSubmit={async (reason) => { const r = await adminRemoveUserApi(u.id, reason); setModal(null); setNotice(`Account removed (${r.removed.posts} posts, ${r.removed.reels} reels, ${r.removed.stories} stories, ${r.removed.comments} comments deleted).`); await load() }} />
      )}
    </div>
  )
}
