import { Suspense } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import Logo from './Logo.jsx'
import DiscoveryRail from './DiscoveryRail.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { useChat } from '../context/ChatContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'
import CallOverlay from './CallOverlay.jsx'

const sideItems = [
  ['/home', '🏠', 'Home'], ['/explore', '🔎', 'Explore'], ['/reels', '🎬', 'Reels'], ['/create', '➕', 'Create'], ['/chat', '💬', 'Chat'], ['/calls', '📞', 'Calls'],
  ['/ai', '✨', 'Vibely AI'], ['/notifications', '🔔', 'Notifications'], ['/profile', '👤', 'Profile'], ['/settings', '⚙️', 'Settings'],
]
const bottomItems = [['/home', '🏠', 'Home'], ['/explore', '🔎', 'Explore'], ['/reels', '🎬', 'Reels'], ['/create', '➕', 'Create'], ['/chat', '💬', 'Chat'], ['/profile', '👤', 'Profile']]
const linkCls = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${isActive ? 'bg-brand-100 text-brand-700 dark:bg-slate-800 dark:text-pink-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`

export default function Layout() {
  const { theme, toggleTheme } = useTheme()
  const { totalUnread } = useChat()
  const { unreadCount } = useNotifications()
  const { currentUser } = useAuth()
  const items = currentUser?.role === 'admin' ? [...sideItems, ['/admin', '🛡️', 'Admin']] : sideItems
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl">
      <CallOverlay />
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-2 border-r border-slate-200 p-4 dark:border-slate-800 lg:flex">
        <Link to="/home" className="mb-4 px-2"><Logo /></Link>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {items.map(([to, icon, label]) => <NavLink key={to} to={to} className={linkCls}><span aria-hidden="true">{icon}</span>{label}{to === '/chat' && totalUnread > 0 && <span className="ml-auto rounded-full bg-pink-500 px-1.5 text-xs font-semibold text-white" aria-label={`${totalUnread} unread messages`}>{totalUnread > 99 ? '99+' : totalUnread}</span>}{to === '/notifications' && unreadCount > 0 && <span className="ml-auto rounded-full bg-pink-500 px-1.5 text-xs font-semibold text-white" aria-label={`${unreadCount} unread notifications`}>{unreadCount > 99 ? '99+' : unreadCount}</span>}</NavLink>)}
        </nav>
        <button onClick={toggleTheme} className="btn-ghost mt-auto">{theme === 'dark' ? '☀️ Light' : '🌙 Dark'} mode</button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 lg:hidden">
          <Logo />
          <div className="flex items-center gap-1">
            {currentUser?.role === 'admin' && <Link to="/admin" aria-label="Admin" className="rounded-lg p-2">🛡️</Link>}
            <Link to="/ai" aria-label="Vibely AI" className="rounded-lg p-2">✨</Link>
            <Link to="/explore" aria-label="Search" className="rounded-lg p-2">🔎</Link>
            <Link to="/notifications" aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'} className="relative rounded-lg p-2">🔔{unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[1rem] rounded-full bg-pink-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}</Link>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 pb-24 lg:pb-8"><Suspense fallback={<p role="status" className="py-10 text-center text-sm text-slate-500">Loading...</p>}><Outlet /></Suspense></main>
      </div>

      <aside className="hidden w-72 shrink-0 flex-col gap-4 p-4 xl:flex" aria-label="Discover"><DiscoveryRail /></aside>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-slate-200 bg-white py-1 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
        {bottomItems.map(([to, icon, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `flex min-w-0 flex-1 flex-col items-center rounded-lg px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${isActive ? 'text-brand-600 dark:text-pink-400' : 'text-slate-500'}`}>
            <span aria-hidden="true" className="relative text-lg">{icon}{to === '/chat' && totalUnread > 0 && <span className="absolute -right-2 -top-1 rounded-full bg-pink-500 px-1 text-[10px] font-semibold leading-4 text-white">{totalUnread > 99 ? '99+' : totalUnread}</span>}</span>{label}{to === '/chat' && totalUnread > 0 && <span className="sr-only">, {totalUnread} unread</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
