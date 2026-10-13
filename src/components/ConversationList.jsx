import { useState } from 'react'
import ChatListItem from './ChatListItem.jsx'
import ErrorState from './ErrorState.jsx'
import EmptyState from './EmptyState.jsx'
import { useChat } from '../context/ChatContext.jsx'
import { convTitle } from '../utils/chat.js'

export default function ConversationList({ activeId, onSelect, onNew }) {
  const { conversations, loaded, error, refresh } = useChat()
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const shown = term
    ? conversations.filter((c) => convTitle(c).toLowerCase().includes(term) || c.participants.some((p) => p.user.username.includes(term) || p.user.fullName.toLowerCase().includes(term)))
    : conversations
  return (
    <>
      <div className="flex items-center justify-between p-4 pb-2">
        <h1 className="text-lg font-bold">Chats</h1>
        <div className="flex gap-1">
          <button type="button" className="rounded-lg px-2 py-1 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800" aria-label="New chat" onClick={() => onNew('direct')}>✏️</button>
          <button type="button" className="rounded-lg px-2 py-1 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800" aria-label="New group" onClick={() => onNew('group')}>👥</button>
        </div>
      </div>
      <div className="px-3 pb-2">
        <label htmlFor="chat-search" className="sr-only">Search chats</label>
        <input id="chat-search" type="search" className="field" placeholder="Search chats" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!loaded && <p role="status" className="p-4 text-center text-sm text-slate-500">Loading chats...</p>}
      {error && <ErrorState message={error} onRetry={refresh} />}
      {loaded && !error && conversations.length === 0 && <EmptyState icon="💬" title="No chats yet" text="Start a chat with the pencil button, or from someone's profile." />}
      {loaded && conversations.length > 0 && shown.length === 0 && <p className="p-4 text-center text-sm text-slate-500">No chats match "{q}".</p>}
      <ul>{shown.map((c) => <li key={c.id}><ChatListItem conv={c} active={c.id === activeId} onClick={() => onSelect(c.id)} /></li>)}</ul>
    </>
  )
}
