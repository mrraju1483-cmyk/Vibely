import { useState } from 'react'
import { chatTime } from '../utils/time.js'
import { fileSize } from '../utils/chat.js'

export function messageStatus(m) {
  if (m.recipientCount > 0 && m.readBy.length >= m.recipientCount) return 'read'
  if (m.recipientCount > 0 && m.deliveredTo.length >= m.recipientCount) return 'delivered'
  return 'sent'
}
const TICKS = { sent: ['✓', 'Sent'], delivered: ['✓✓', 'Delivered'], read: ['✓✓', 'Read'] }

export default function MessageBubble({ message: m, mine, showSender, onDelete }) {
  const [menu, setMenu] = useState(false)
  const status = mine ? messageStatus(m) : null
  const a = m.attachment
  const act = 'block w-full rounded px-2 py-1 text-left text-xs hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-700'
  return (
    <li className={`group flex ${mine ? 'justify-end' : ''}`}>
      <div className={`relative max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.deleted ? 'italic text-slate-500 border border-dashed border-slate-300 dark:border-slate-700' : mine ? 'bg-gradient-to-r from-brand-600 to-pink-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
        {showSender && !mine && <p className="mb-0.5 text-xs font-semibold text-brand-600 dark:text-pink-400">{m.sender.username}</p>}
        {m.deleted ? <p>🚫 This message was deleted</p> : (
          <>
            {a && m.type === 'image' && <a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={m.text || 'Photo'} loading="lazy" className="mb-1 max-h-64 rounded-lg object-contain" /></a>}
            {a && m.type === 'video' && <video src={a.url} controls preload="metadata" playsInline className="mb-1 max-h-64 rounded-lg" />}
            {a && m.type === 'file' && <a href={a.url} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 rounded-lg bg-black/10 p-2 underline"><span aria-hidden="true">📄</span><span className="min-w-0"><span className="block truncate">{a.name}</span><span className="text-xs opacity-70">{fileSize(a.size)}</span></span></a>}
            {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
          </>
        )}
        <p className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine && !m.deleted ? 'text-white/80' : 'text-slate-500'}`}>
          {m.expiresAt && <span title="Disappearing message" aria-label="Disappearing message">⏱</span>}
          {chatTime(m.createdAt)}
          {mine && !m.deleted && <span aria-label={TICKS[status][1]} className={status === 'read' ? 'font-bold text-sky-200' : ''}>{TICKS[status][0]}</span>}
        </p>
        {!m.deleted && (
          <div className={`absolute top-1 ${mine ? '-left-7' : '-right-7'}`}>
            <button type="button" aria-label="Message options" aria-expanded={menu} onClick={() => setMenu(!menu)} className="rounded px-1 text-slate-400 opacity-0 hover:text-slate-700 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 group-hover:opacity-100 max-sm:opacity-100">⋯</button>
            {menu && (
              <div className={`absolute z-10 w-36 rounded-lg border border-slate-200 bg-white p-1 text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${mine ? 'right-0' : 'left-0'}`}>
                <button type="button" className={act} onClick={() => { setMenu(false); onDelete('me') }}>Delete for me</button>
                {mine && <button type="button" className={act} onClick={() => { setMenu(false); onDelete('everyone') }}>Delete for everyone</button>}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
