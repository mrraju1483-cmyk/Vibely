import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ConversationList from '../components/ConversationList.jsx'
import ChatWindow from '../components/ChatWindow.jsx'
import NewChatModal from '../components/NewChatModal.jsx'
import { useChat } from '../context/ChatContext.jsx'

// /chat shows the list; /chat/:id opens a conversation. On phones only one pane shows at a time.
export default function ChatPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { connected } = useChat()
  const [newMode, setNewMode] = useState(null)

  return (
    <div className="mx-auto max-w-4xl">
      {!connected && <p role="status" className="mb-2 rounded-lg bg-amber-50 px-3 py-1 text-center text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">Reconnecting... messages will sync when you are back online.</p>}
      <div className="card grid h-[calc(100dvh-10.5rem)] overflow-hidden md:grid-cols-[18rem_1fr] lg:h-[calc(100dvh-5.5rem)]">
        <section aria-label="Conversations" className={`overflow-y-auto border-r border-slate-200 dark:border-slate-800 ${id ? 'hidden md:block' : ''}`}>
          <ConversationList activeId={id} onSelect={(cid) => nav(`/chat/${cid}`)} onNew={setNewMode} />
        </section>
        <section aria-label="Conversation" className={`flex min-h-0 min-w-0 flex-col ${id ? '' : 'hidden md:flex'}`}>
          {id ? <ChatWindow key={id} convId={id} /> : <p className="m-auto p-4 text-center text-sm text-slate-500">Select a chat to start talking</p>}
        </section>
      </div>
      {newMode && <NewChatModal mode={newMode} onClose={() => setNewMode(null)} onOpened={(conv) => { setNewMode(null); nav(`/chat/${conv.id}`) }} />}
    </div>
  )
}
