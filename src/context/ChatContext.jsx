import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { createSocket } from '../socket/socket.js'
import { listConversationsApi, getConversationApi, openDirectApi, createGroupApi, markReadApi } from '../api/chatApi.js'
import { getErrorMessage } from '../api/axios.js'

const ChatContext = createContext(null)
const byRecent = (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)

// Owns the socket, the conversation list, presence, typing and the unread badge for the whole app
export function ChatProvider({ children }) {
  const { currentUser, isAuthenticated } = useAuth()
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const [connectEpoch, setConnectEpoch] = useState(0) // +1 on every (re)connect so open chats can catch up
  const [conversations, setConversations] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [presence, setPresence] = useState({})
  const [typing, setTyping] = useState({})
  const convsRef = useRef([])
  const activeRef = useRef(null)
  const meRef = useRef(null)
  const timers = useRef({})
  convsRef.current = conversations
  meRef.current = currentUser?.id

  const upsertConversation = useCallback((conv) => {
    setConversations((list) => {
      const i = list.findIndex((c) => c.id === conv.id)
      const next = i === -1 ? [conv, ...list] : list.map((c) => (c.id === conv.id ? conv : c))
      return next.sort(byRecent)
    })
  }, [])
  const removeConversation = useCallback((id) => setConversations((l) => l.filter((c) => c.id !== id)), [])

  const refresh = useCallback(async () => {
    try { setConversations((await listConversationsApi()).conversations); setError('') } catch (e) { setError(getErrorMessage(e)) } finally { setLoaded(true) }
  }, [])

  const clearTyping = useCallback((conversationId, userId) => {
    clearTimeout(timers.current[`${conversationId}:${userId}`])
    setTyping((t) => { const conv = { ...(t[conversationId] || {}) }; delete conv[userId]; return { ...t, [conversationId]: conv } })
  }, [])

  useEffect(() => {
    if (!isAuthenticated) { setSocket(null); setConnected(false); setConversations([]); setLoaded(false); return }
    const s = createSocket()
    setSocket(s)
    s.on('connect', () => { setConnected(true); setConnectEpoch((n) => n + 1); refresh() }) // on reconnect this also catches up on anything missed
    s.on('disconnect', () => setConnected(false))
    s.on('connect_error', (err) => { if (err.message === 'unauthorized') s.disconnect() }) // bad/expired token: stop retrying

    s.on('message:new', (m) => {
      clearTyping(m.conversationId, m.sender.id)
      if (!convsRef.current.some((c) => c.id === m.conversationId)) {
        getConversationApi(m.conversationId).then((d) => upsertConversation(d.conversation)).catch(() => {}) // first message of a new chat
        return
      }
      const mine = m.sender.id === meRef.current
      setConversations((list) => {
        const i = list.findIndex((c) => c.id === m.conversationId)
        if (i === -1) return list
        const c = list[i]
        const unread = mine || activeRef.current === c.id ? c.unread : c.unread + 1
        const updated = { ...c, unread, lastMessageAt: m.createdAt, lastMessage: { senderId: m.sender.id, text: m.text || { image: '📷 Photo', video: '🎬 Video', file: '📄 Document' }[m.type] || '', kind: m.type, createdAt: m.createdAt } }
        return [updated, ...list.slice(0, i), ...list.slice(i + 1)]
      })
    })
    s.on('conversation:updated', upsertConversation)
    s.on('conversation:removed', ({ id }) => removeConversation(id))
    s.on('presence', ({ userId, online, lastSeenAt }) => setPresence((p) => ({ ...p, [userId]: { online, lastSeenAt } })))
    s.on('typing', ({ conversationId, userId, isTyping }) => {
      clearTyping(conversationId, userId)
      if (!isTyping) return
      setTyping((t) => ({ ...t, [conversationId]: { ...(t[conversationId] || {}), [userId]: true } }))
      timers.current[`${conversationId}:${userId}`] = setTimeout(() => clearTyping(conversationId, userId), 5000) // indicator expires by itself
    })
    return () => { s.removeAllListeners(); s.disconnect(); setConnected(false) }
  }, [isAuthenticated, refresh, upsertConversation, removeConversation, clearTyping])

  const setActiveConversation = useCallback((id) => { activeRef.current = id }, [])
  const markConversationRead = useCallback(async (id) => {
    setConversations((l) => l.map((c) => (c.id === id && c.unread ? { ...c, unread: 0 } : c)))
    await markReadApi(id)
  }, [])
  const sendTyping = useCallback((conversationId, isTyping) => { socket?.connected && socket.emit('typing', { conversationId, isTyping }) }, [socket])
  const typingUsers = useCallback((id) => Object.keys(typing[id] || {}), [typing])
  const getPresence = useCallback((userId, fallback) => presence[userId] || { online: !!fallback?.online, lastSeenAt: fallback?.lastSeenAt || null }, [presence])
  const openDirect = useCallback(async (userId) => { const d = await openDirectApi(userId); upsertConversation(d.conversation); return d.conversation }, [upsertConversation])
  const createGroup = useCallback(async (name, ids) => { const d = await createGroupApi(name, ids); upsertConversation(d.conversation); return d.conversation }, [upsertConversation])
  const totalUnread = useMemo(() => conversations.reduce((n, c) => n + (c.unread || 0), 0), [conversations])

  const value = useMemo(() => ({
    socket, connected, connectEpoch, conversations, loaded, error, totalUnread, refresh, upsertConversation, removeConversation,
    setActiveConversation, markConversationRead, sendTyping, typingUsers, getPresence, openDirect, createGroup,
  }), [socket, connected, connectEpoch, conversations, loaded, error, totalUnread, refresh, upsertConversation, removeConversation, setActiveConversation, markConversationRead, sendTyping, typingUsers, getPresence, openDirect, createGroup])
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export const useChat = () => useContext(ChatContext)
