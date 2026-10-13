import { useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from './Avatar.jsx'
import FollowButton from './FollowButton.jsx'
import { useAuth } from '../context/AuthContext.jsx'

// action: optional custom right-side element (e.g. Unblock). Otherwise a FollowButton is shown.
export default function UserCard({ user, action }) {
  const { currentUser } = useAuth()
  const [status, setStatus] = useState(user.followStatus || 'none')
  const isMe = currentUser?.id === user.id
  return (
    <li className="flex items-center gap-3 py-2">
      <Link to={`/profile/${user.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <Avatar name={user.fullName} src={user.profilePhoto} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{user.fullName} {user.isPrivate && <span aria-label="Private account">🔒</span>}</span>
          <span className="block truncate text-xs text-slate-500">@{user.username}</span>
          {user.note && <span className="block truncate text-xs text-brand-600">{user.note}</span>}
        </span>
      </Link>
      {action ?? (!isMe && <FollowButton userId={user.id} status={status} isPrivate={user.isPrivate} onChange={setStatus} />)}
    </li>
  )
}
