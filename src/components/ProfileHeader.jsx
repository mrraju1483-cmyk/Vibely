import { useState } from 'react'
import Avatar from './Avatar.jsx'
import FollowButton from './FollowButton.jsx'

export function ProfileStats({ profile, onOpenList }) {
  const item = 'card p-3 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
  return (
    <dl className="grid grid-cols-3 gap-2 text-center">
      <div className="card p-3"><dd className="text-lg font-bold">{profile.postsCount}</dd><dt className="text-xs text-slate-500">Posts</dt></div>
      {[['followers', 'Followers', profile.followersCount], ['following', 'Following', profile.followingCount]].map(([key, label, n]) => (
        <div key={key}>
          <button type="button" className={item} onClick={() => onOpenList(key)} aria-label={`View ${label.toLowerCase()}`}>
            <dd className="text-lg font-bold">{n}</dd><dt className="text-xs text-slate-500">{label}</dt>
          </button>
        </div>
      ))}
    </dl>
  )
}

export default function ProfileHeader({ profile, onEdit, onOpenList, onFollowChange, onBlockToggle, onReport, onMessage, onLogout, busy }) {
  const [copied, setCopied] = useState(false)
  async function share() {
    const url = `${window.location.origin}/profile/${profile.id}`
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { window.prompt('Copy this link', url) }
  }
  return (
    <>
      <header className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <Avatar name={profile.fullName} src={profile.profilePhoto} size="h-24 w-24" />
        <div className="text-center sm:text-left">
          <h1 className="text-xl font-bold">{profile.fullName} {profile.isPrivate && <span aria-label="Private account">🔒</span>}</h1>
          <p className="text-sm text-slate-500">@{profile.username}</p>
          {profile.bio && <p className="mt-2 whitespace-pre-line text-sm">{profile.bio}</p>}
          <div className="mt-3 flex flex-wrap items-start justify-center gap-2 sm:justify-start">
            {profile.isMe ? (
              <>
                <button type="button" className="btn-primary" onClick={onEdit}>Edit Profile</button>
                {onLogout && <button type="button" className="btn-ghost text-red-600 dark:text-red-400" onClick={onLogout}>Logout</button>}
              </>
            ) : !profile.isBlockedByMe && (
              <FollowButton userId={profile.id} status={profile.followStatus} isPrivate={profile.isPrivate} onChange={onFollowChange} />
            )}
            {!profile.isMe && !profile.isBlockedByMe && <button type="button" className="btn-ghost" onClick={onMessage}>Message</button>}
            <button type="button" className="btn-ghost" onClick={share}>{copied ? 'Link copied!' : 'Share Profile'}</button>
            {!profile.isMe && (
              <button type="button" className="btn-ghost" disabled={busy} onClick={onBlockToggle}>{profile.isBlockedByMe ? 'Unblock' : 'Block'}</button>
            )}
            {!profile.isMe && <button type="button" className="btn-ghost" onClick={onReport}>Report</button>}
          </div>
        </div>
      </header>
      <ProfileStats profile={profile} onOpenList={onOpenList} />
    </>
  )
}
