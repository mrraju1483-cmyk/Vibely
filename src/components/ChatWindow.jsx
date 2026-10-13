import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar.jsx'
import MessageBubble from './MessageBubble.jsx'
import MessageComposer from './MessageComposer.jsx'
import ChatInfoModal from './ChatInfoModal.jsx'
import ErrorState from './ErrorState.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useChat } from '../context/ChatContext.jsx'
import { useCall } from '../context/CallContext.jsx'
import { deleteMessageApi, getConversationApi, messagesApi } from '../api/chatApi.js'
import { getErrorMessage } from '../api/axios.js'
import { timeAgo } from '../utils/time.js'
import { convPhoto, convTitle, disappearLabel } from '../utils/chat.js'

export default function ChatWindow({ convId }) {
  const nav = useNavigate()
  const { startCall, inCall } = useCall()
  const { currentUser } = useAuth()
  const { socket, connectEpoch, conversations, upsertConversation, setActiveConversation, markConversationRead, typingUsers, getPresence } = useChat()
  const conv = conversations.find((c) => c.id === convId)
  const meId = currentUser.id
  const [messages, setMessages] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [error, setError] = useState('')
  const [convError, setConvError] = useState('')
  const [info, setInfo] = useState(false)
  const scrollRef = useRef(null)
  const stick = useRef(true) // keep the view pinned to the newest message
  const prevHeight = useRef(null)
  const seenEpoch = useRef(connectEpoch)

  const read = useCallback(() => { markConversationRead(convId).catch(() => {}) }, [convId, markConversationRead])
  const loadLatest = useCallback(async () => {
    setError('')
    try { const d = await messagesApi(convId); setMessages([...d.messages].reverse()); setCursor(d.nextCursor); stick.current = true } catch (e) { setError(getErrorMessage(e)) } finally { setLoading(false) }
  }, [convId])

  // Open a conversation
  useEffect(() => {
    setMessages([]); setCursor(null); setLoading(true); setConvError(''); setActiveConversation(convId)
    loadLatest().then(read)
    return () => setActiveConversation(null)
  }, [convId, loadLatest, read, setActiveConversation])

  // Deep link or brand-new chat: the conversation may not be in the list yet
  useEffect(() => {
    if (conv) return
    getConversationApi(convId).then((d) => upsertConversation(d.conversation)).catch((e) => setConvError(getErrorMessage(e)))
  }, [convId, conv, upsertConversation])

  // Reconnected: fetch anything we missed while offline
  useEffect(() => {
    if (connectEpoch === seenEpoch.current) return
    seenEpoch.current = connectEpoch
    if (connectEpoch > 1) loadLatest().then(read)
  }, [connectEpoch, loadLatest, read])

  // Live events for this conversation
  useEffect(() => {
    if (!socket) return
    const onNew = (m) => {
      if (m.conversationId !== convId) return
      setMessages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m])) // the sender's own tab also gets an echo: ignore duplicates
      if (m.sender.id !== meId && document.visibilityState === 'visible') read()
    }
    const onDelivered = ({ conversationId, messageIds, userId }) => {
      if (conversationId !== convId) return
      const ids = new Set(messageIds)
      setMessages((l) => l.map((m) => (ids.has(m.id) && !m.deliveredTo.includes(userId) ? { ...m, deliveredTo: [...m.deliveredTo, userId] } : m)))
    }
    const onRead = ({ conversationId, userId, at }) => {
      if (conversationId !== convId || userId === meId) return
      const t = new Date(at).getTime()
      setMessages((l) => l.map((m) => (m.sender.id === meId && new Date(m.createdAt).getTime() <= t && !m.readBy.includes(userId)
        ? { ...m, readBy: [...m.readBy, userId], deliveredTo: m.deliveredTo.includes(userId) ? m.deliveredTo : [...m.deliveredTo, userId] } : m)))
    }
    const onDeleted = ({ conversationId, messageId }) => {
      if (conversationId === convId) setMessages((l) => l.map((m) => (m.id === messageId ? { ...m, deleted: true, text: '', attachment: null } : m)))
    }
    socket.on('message:new', onNew); socket.on('message:delivered', onDelivered); socket.on('conversation:read', onRead); socket.on('message:deleted', onDeleted)
    return () => { socket.off('message:new', onNew); socket.off('message:delivered', onDelivered); socket.off('conversation:read', onRead); socket.off('message:deleted', onDeleted) }
  }, [socket, convId, meId, read])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') read() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [read])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (prevHeight.current !== null) { el.scrollTop = el.scrollHeight - prevHeight.current; prevHeight.current = null } // keep position after loading older messages
    else if (stick.current) el.scrollTop = el.scrollHeight
  }, [messages])

  async function loadOlder() {
    prevHeight.current = scrollRef.current.scrollHeight
    setLoadingOlder(true)
    try { const d = await messagesApi(convId, cursor); setMessages((l) => [...[...d.messages].reverse(), ...l]); setCursor(d.nextCursor) } catch (e) { prevHeight.current = null; setError(getErrorMessage(e)) } finally { setLoadingOlder(false) }
  }

  async function remove(m, scope) {
    try {
      await deleteMessageApi(convId, m.id, scope)
      setMessages((l) => (scope === 'me' ? l.filter((x) => x.id !== m.id) : l.map((x) => (x.id === m.id ? { ...x, deleted: true, text: '', attachment: null } : x))))
    } catch (e) { setError(getErrorMessage(e)) }
  }

  if (convError) return <div className="m-auto"><ErrorState message={convError} onRetry={() => nav('/chat')} /></div>
  if (!conv) return <p role="status" className="m-auto text-sm text-slate-500">Loading chat...</p>

  const title = convTitle(conv)
  const typers = typingUsers(convId).map((id) => conv.participants.find((p) => p.user.id === id)?.user.fullName.split(' ')[0]).filter(Boolean)
  const p = conv.type === 'direct' && conv.other ? getPresence(conv.other.user.id, conv.other) : null
  const subtitle = typers.length ? `${typers.join(', ')} typing...`
    : conv.type === 'group' ? `${conv.participants.length} members`
    : p?.online ? 'Online' : p?.lastSeenAt ? `Last seen ${timeAgo(p.lastSeenAt)} ago` : ''

  return (
    <>
      <header className="flex items-center gap-3 border-b border-slate-200 p-3 dark:border-slate-800">
        <button type="button" className="rounded-lg px-1 md:hidden" aria-label="Back to chats" onClick={() => nav('/chat')}>←</button>
        <Avatar name={title} src={convPhoto(conv)} online={!!p?.online} />
        <button type="button" className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg" onClick={() => setInfo(true)} aria-label={`${title}, chat info`}>
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className={`block truncate text-xs ${typers.length ? 'text-brand-600' : 'text-slate-500'}`} aria-live="polite">{subtitle}</span>
        </button>
        {conv.type === 'direct' && conv.other && (
          <>
            <button type="button" className="rounded-lg px-2 py-1 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40 dark:hover:bg-slate-800" aria-label={`Voice call ${title}`} disabled={inCall} onClick={() => startCall(conv.other.user, 'voice')}>📞</button>
            <button type="button" className="rounded-lg px-2 py-1 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40 dark:hover:bg-slate-800" aria-label={`Video call ${title}`} disabled={inCall} onClick={() => startCall(conv.other.user, 'video')}>🎥</button>
          </>
        )}
        {conv.disappearAfter > 0 && <span title={`Messages disappear after ${disappearLabel(conv.disappearAfter)}`} className="text-xs text-slate-500">⏱ {disappearLabel(conv.disappearAfter)}</span>}
        <button type="button" className="rounded-lg px-2 py-1 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800" aria-label="Chat info" onClick={() => setInfo(true)}>ℹ️</button>
      </header>

      <div ref={scrollRef} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }} className="min-h-0 flex-1 overflow-y-auto p-4">
        {cursor && <button type="button" className="btn-ghost mb-3 w-full" disabled={loadingOlder} onClick={loadOlder}>{loadingOlder ? 'Loading...' : 'Load earlier messages'}</button>}
        {loading && <p role="status" className="text-center text-sm text-slate-500">Loading messages...</p>}
        {error && <ErrorState message={error} onRetry={loadLatest} />}
        {!loading && !error && messages.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No messages yet. Say hello 👋</p>}
        <ul role="log" aria-live="polite" aria-label="Messages" className="space-y-2">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} mine={m.sender.id === meId} showSender={conv.type === 'group'} onDelete={(scope) => remove(m, scope)} />
          ))}
        </ul>
        {typers.length > 0 && <p className="mt-2 text-xs text-slate-500" aria-hidden="true">{typers.join(', ')} typing...</p>}
      </div>

      <MessageComposer convId={convId} onSent={(m) => { stick.current = true; setMessages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m])) }} />
      {info && <ChatInfoModal conv={conv} onClose={() => setInfo(false)} />}
    </>
  )
}
