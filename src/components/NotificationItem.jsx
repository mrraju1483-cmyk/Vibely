import { Link } from 'react-router-dom'
import Avatar from './Avatar.jsx'
import { timeAgo } from '../utils/time.js'

function describe(n) {
  const what = n.reelId ? 'reel' : 'post'
  switch (n.type) {
    case 'like': return n.text === 'liked your comment' ? 'liked your comment' : `liked your ${what}`
    case 'comment': return `commented on your ${what}: “${n.text}”`
    case 'reply': return `replied to your comment: “${n.text}”`
    case 'mention': return `mentioned you: “${n.text}”`
    case 'follow': return 'started following you'
    case 'follow_request': return 'requested to follow you'
    case 'follow_accept': return 'accepted your follow request'
    case 'message': return n.count > 1 ? `sent you ${n.count} messages` : `sent you a message: “${n.text}”`
    case 'missed_call': return `Missed ${n.text === 'video' ? 'video' : 'voice'} call`
    default: return 'sent you a notification'
  }
}

function target(n) {
  if (n.reelId) return `/reels/${n.reelId}`
  if (n.postId) return `/post/${n.postId}`
  if (n.conversationId) return `/chat/${n.conversationId}`
  if (n.type === 'missed_call') return '/calls'
  return `/profile/${n.actor.id}` // follows and requests
}

export default function NotificationItem({ notification: n, onOpen }) {
  return (
    <li>
      <Link to={target(n)} onClick={() => onOpen(n)}
        className={`flex items-start gap-3 p-4 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:hover:bg-slate-800 ${n.read ? '' : 'bg-brand-50/60 dark:bg-slate-800/50'}`}>
        <Avatar name={n.actor.fullName} src={n.actor.profilePhoto} />
        <span className="min-w-0 flex-1 break-words text-sm">
          <span className="font-semibold">{n.actor.username}</span> {describe(n)}
          <span className="block text-xs text-slate-500">{timeAgo(n.createdAt)}</span>
        </span>
        {!n.read && <><span aria-hidden="true" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-pink-500" /><span className="sr-only">Unread</span></>}
      </Link>
    </li>
  )
}
