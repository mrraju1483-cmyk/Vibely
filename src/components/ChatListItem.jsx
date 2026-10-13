import Avatar from './Avatar.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useChat } from '../context/ChatContext.jsx'
import { chatTime } from '../utils/time.js'
import { convPhoto, convTitle } from '../utils/chat.js'

export default function ChatListItem({ conv, active, onClick }) {
  const { currentUser } = useAuth()
  const { typingUsers, getPresence } = useChat()
  const title = convTitle(conv)
  const online = conv.type === 'direct' && conv.other ? getPresence(conv.other.user.id, conv.other).online : false
  const typing = typingUsers(conv.id).length > 0
  const preview = conv.lastMessage
    ? `${conv.lastMessage.senderId === currentUser.id ? 'You: ' : ''}${conv.lastMessage.text}`
    : conv.type === 'group' ? 'No messages yet' : 'Say hello 👋'
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'true' : undefined}
      className={`flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800 ${active ? 'bg-brand-50 dark:bg-slate-800' : ''}`}>
      <Avatar name={title} src={convPhoto(conv)} online={online} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{conv.type === 'group' && '👥 '}{title}</span>
        <span className={`block truncate text-xs ${typing ? 'text-brand-600' : 'text-slate-500'}`}>{typing ? 'typing...' : preview}</span>
      </span>
      <span className="flex flex-col items-end gap-1">
        {conv.lastMessage && <span className="text-xs text-slate-400">{chatTime(conv.lastMessage.createdAt)}</span>}
        {conv.unread > 0 && <span aria-label={`${conv.unread} unread`} className="rounded-full bg-pink-500 px-1.5 text-xs font-semibold text-white">{conv.unread > 99 ? '99+' : conv.unread}</span>}
      </span>
    </button>
  )
}
