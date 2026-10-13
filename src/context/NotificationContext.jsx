import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useChat } from './ChatContext.jsx'
import { notificationsApi, markNotificationReadApi, markAllNotificationsReadApi } from '../api/notificationApi.js'
import { getErrorMessage } from '../api/axios.js'

const NotificationContext = createContext(null)

// Notification list + the unread badge, kept live through the shared socket
export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const { socket, connectEpoch } = useChat()
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [cursor, setCursor] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const d = await notificationsApi()
      setItems(d.notifications); setCursor(d.nextCursor); setUnreadCount(d.unreadCount); setError('')
    } catch (e) { setError(getErrorMessage(e)) } finally { setLoaded(true) }
  }, [])

  // Load on login, and again after every (re)connect so nothing missed while offline is lost
  useEffect(() => {
    if (!isAuthenticated) { setItems([]); setUnreadCount(0); setCursor(null); setLoaded(false); return }
    refresh()
  }, [isAuthenticated, connectEpoch, refresh])

  useEffect(() => {
    if (!socket) return
    const onNew = ({ notification, unreadCount: count }) => {
      setItems((list) => {
        let next = list.filter((n) => n.id !== notification.id)
        // a newer "N messages" notification replaces the older unread one for the same chat
        if (notification.type === 'message') next = next.filter((n) => !(n.type === 'message' && !n.read && n.conversationId === notification.conversationId))
        return [notification, ...next]
      })
      setUnreadCount(count)
    }
    const onSync = ({ unreadCount: count }) => { // another tab marked things as read
      setUnreadCount(count)
      if (count === 0) setItems((l) => l.map((n) => ({ ...n, read: true })))
    }
    socket.on('notification:new', onNew)
    socket.on('notification:sync', onSync)
    return () => { socket.off('notification:new', onNew); socket.off('notification:sync', onSync) }
  }, [socket])

  const loadMore = useCallback(async () => {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const d = await notificationsApi(cursor)
      setItems((l) => [...l, ...d.notifications.filter((n) => !l.some((x) => x.id === n.id))])
      setCursor(d.nextCursor)
    } catch (e) { setError(getErrorMessage(e)) } finally { setLoadingMore(false) }
  }, [cursor])

  const markRead = useCallback(async (id) => {
    let was = false
    setItems((l) => l.map((n) => { if (n.id === id && !n.read) { was = true; return { ...n, read: true } } return n }))
    if (was) setUnreadCount((c) => Math.max(0, c - 1))
    try { await markNotificationReadApi(id) } catch { refresh() } // undo by reloading the truth
  }, [refresh])

  const markAllRead = useCallback(async () => {
    setItems((l) => l.map((n) => ({ ...n, read: true }))); setUnreadCount(0)
    try { await markAllNotificationsReadApi() } catch { refresh() }
  }, [refresh])

  const value = useMemo(() => ({ items, unreadCount, hasMore: !!cursor, loaded, loadingMore, error, refresh, loadMore, markRead, markAllRead }),
    [items, unreadCount, cursor, loaded, loadingMore, error, refresh, loadMore, markRead, markAllRead])
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export const useNotifications = () => useContext(NotificationContext)
