import { useState } from 'react'
import AIChat from '../components/AIChat.jsx'
import CaptionGenerator from '../components/CaptionGenerator.jsx'
import SafetyChecker from '../components/SafetyChecker.jsx'
import SmartReplyBar from '../components/SmartReplyBar.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useAIStatus } from '../hooks/useAIStatus.js'
import { useChat } from '../context/ChatContext.jsx'
import { convTitle } from '../utils/chat.js'

const TABS = [['chat', 'Assistant'], ['captions', 'Captions'], ['replies', 'Smart replies'], ['safety', 'Safety check']]

function SmartReplies() {
  const { conversations } = useChat()
  const [convId, setConvId] = useState('')
  const [copied, setCopied] = useState('')
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); setCopied(text) } catch { setCopied('') }
  }
  if (!conversations.length) return <EmptyState icon="💬" title="No chats yet" text="Start a conversation, then come back for reply ideas." />
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="sr-conv" className="mb-1 block text-sm font-medium">Choose a chat</label>
        <select id="sr-conv" className="field" value={convId} onChange={(e) => { setConvId(e.target.value); setCopied('') }}>
          <option value="">Select...</option>
          {conversations.map((c) => <option key={c.id} value={c.id}>{convTitle(c)}</option>)}
        </select>
      </div>
      {convId && <SmartReplyBar convId={convId} onPick={copy} />}
      {copied && <p role="status" className="text-sm text-brand-600">Copied: “{copied}”. Paste it into the chat.</p>}
      <p className="text-xs text-slate-500">You can also tap “✨ Suggest replies” right above the message box inside any chat.</p>
    </div>
  )
}

export default function VibelyAIPage() {
  const status = useAIStatus()
  const [tab, setTab] = useState('chat')
  const off = status && !status.available
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="text-xl font-bold">✨ Vibely AI</h1>
      {off && (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {status.reason === 'unreachable' ? 'Vibely AI cannot be reached right now. Please try again later.' : 'Vibely AI is not set up on this server yet. The app owner needs to start the AI service (see ai-service/README.md).'}
        </p>
      )}
      <div role="tablist" aria-label="Vibely AI tools" className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`whitespace-nowrap px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${tab === id ? 'border-b-2 border-brand-600 text-brand-600' : 'text-slate-500'}`}>{label}</button>
        ))}
      </div>
      <div role="tabpanel" className="card p-4">
        {tab === 'chat' && <AIChat />}
        {tab === 'captions' && <CaptionGenerator />}
        {tab === 'replies' && <SmartReplies />}
        {tab === 'safety' && <SafetyChecker />}
      </div>
    </div>
  )
}
