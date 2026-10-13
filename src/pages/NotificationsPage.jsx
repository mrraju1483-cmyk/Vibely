import NotificationItem from '../components/NotificationItem.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'

export default function NotificationsPage() {
  const { items, unreadCount, hasMore, loaded, loadingMore, error, refresh, loadMore, markRead, markAllRead } = useNotifications()
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Notifications{unreadCount > 0 && <span className="ml-2 rounded-full bg-pink-500 px-2 py-0.5 align-middle text-xs font-semibold text-white" aria-label={`${unreadCount} unread`}>{unreadCount}</span>}</h1>
        <button type="button" className="btn-ghost px-3 py-1" disabled={unreadCount === 0} onClick={markAllRead}>Mark all as read</button>
      </div>

      {!loaded && !error && <p role="status" className="py-10 text-center text-sm text-slate-500">Loading notifications...</p>}
      {error && items.length === 0 && <ErrorState message={error} onRetry={refresh} />}
      {loaded && !error && items.length === 0 && <div className="card"><EmptyState icon="🔔" title="You're all caught up" text="Likes, comments, follows, messages and calls will show up here." /></div>}

      {items.length > 0 && (
        <ul className="card divide-y divide-slate-200 overflow-hidden dark:divide-slate-800" aria-live="polite">
          {items.map((n) => <NotificationItem key={n.id} notification={n} onOpen={(x) => !x.read && markRead(x.id)} />)}
        </ul>
      )}
      {error && items.length > 0 && <p role="alert" className="mt-2 text-center text-sm text-red-500">{error}</p>}
      {hasMore && <button type="button" className="btn-ghost mt-3 w-full" disabled={loadingMore} onClick={loadMore}>{loadingMore ? 'Loading...' : 'Load more'}</button>}
    </div>
  )
}
