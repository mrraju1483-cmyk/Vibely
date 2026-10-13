import { useEffect, useRef, useState } from 'react'
import { aiChatApi } from '../api/aiApi.js'
import { getErrorMessage } from '../api/axios.js'

const STARTERS = ['Write a caption for a sunset photo', 'Give me 5 bio ideas for a travel account', 'Suggest hashtags for a fitness reel']

// Keep what we send within the server's limits: last 20 messages, about 7000 characters, starting with the user
function buildContext(messages) {
  const out = []
  let total = 0
  for (let i = messages.length - 1; i >= 0 && out.length < 20; i--) {
    total += messages[i].content.length
    if (total > 7000) break
    out.unshift({ role: messages[i].role, content: messages[i].content })
  }
  while (out.length && out[0].role !== 'user') out.shift()
  return out
}

export default function AIChat() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [model, setModel] = useState('')
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages, loading])

  async function run(history) {
    setLoading(true); setError('')
    try {
      const d = await aiChatApi(buildContext(history))
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: d.reply }])
      setModel(d.model || '')
    } catch (e) { setError(getErrorMessage(e)) } finally { setLoading(false) }
  }

  function send(content) {
    const value = content.trim()
    if (!value || loading) return
    const next = [...messages, { id: crypto.randomUUID(), role: 'user', content: value }]
    setMessages(next); setText('')
    run(next)
  }

  return (
    <div className="flex h-[calc(100dvh-17rem)] min-h-[20rem] flex-col lg:h-[calc(100dvh-14rem)]">
      <div role="log" aria-live="polite" aria-label="Conversation with Vibely AI" className="flex-1 space-y-2 overflow-y-auto pb-2">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <p className="font-semibold">Ask Vibely AI anything</p>
            <p className="mb-3 text-sm text-slate-500">Captions, bios, hashtags, ideas, message drafts.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:hover:bg-slate-800">{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : ''}`}>
            <p className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-gradient-to-r from-brand-600 to-pink-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
              {m.role === 'assistant' && <span className="sr-only">Vibely AI: </span>}{m.content}
            </p>
          </div>
        ))}
        {loading && <p role="status" className="text-sm text-slate-500">✨ Vibely AI is thinking...</p>}
        {error && (
          <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">
            {error} {messages.at(-1)?.role === 'user' && <button type="button" className="underline" onClick={() => run(messages)}>Try again</button>}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(text) }} className="space-y-1 border-t border-slate-200 pt-2 dark:border-slate-800">
        <div className="flex items-end gap-2">
          <label htmlFor="ai-input" className="sr-only">Message Vibely AI</label>
          <textarea id="ai-input" rows="1" maxLength={2000} className="field max-h-32 resize-none" placeholder="Message Vibely AI..." value={text}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }} />
          <button type="submit" disabled={loading || !text.trim()} className="btn-primary">Send</button>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>AI can make mistakes. Do not share passwords or private details.{model && ` Model: ${model}.`}</span>
          {messages.length > 0 && <button type="button" className="underline" onClick={() => { setMessages([]); setError('') }}>New chat</button>}
        </div>
      </form>
    </div>
  )
}
