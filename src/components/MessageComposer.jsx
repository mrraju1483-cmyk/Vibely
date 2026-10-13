import { useEffect, useRef, useState } from 'react'
import EmojiPicker from './EmojiPicker.jsx'
import SmartReplyBar from './SmartReplyBar.jsx'
import { useChat } from '../context/ChatContext.jsx'
import { sendMessageApi } from '../api/chatApi.js'
import { getErrorMessage } from '../api/axios.js'
import { checkChatFile } from '../utils/media.js'
import { fileSize } from '../utils/chat.js'

export default function MessageComposer({ convId, onSent }) {
  const { sendTyping } = useChat()
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [emoji, setEmoji] = useState(false)
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const fileInput = useRef(null)
  const inputRef = useRef(null)
  const typing = useRef({ on: false, sentAt: 0, timer: null })

  function stopTyping() {
    clearTimeout(typing.current.timer)
    if (typing.current.on) { typing.current.on = false; sendTyping(convId, false) }
  }
  useEffect(() => stopTyping, [convId]) // eslint-disable-line react-hooks/exhaustive-deps

  function onChange(e) {
    setText(e.target.value)
    const t = typing.current
    if (!t.on || Date.now() - t.sentAt > 3000) { t.on = true; t.sentAt = Date.now(); sendTyping(convId, true) } // repeated every 3s while typing
    clearTimeout(t.timer)
    t.timer = setTimeout(stopTyping, 2500)
  }

  function pickFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const check = checkChatFile(f)
    if (check.error) return setError(check.error)
    setError(''); setFile(f)
  }

  async function submit(e) {
    e.preventDefault()
    const value = text.trim()
    if ((!value && !file) || sending) return
    setSending(true); setError(''); stopTyping()
    try {
      const d = await sendMessageApi(convId, { text: value, file }, setProgress)
      onSent(d.message)
      setText(''); setFile(null); setEmoji(false)
      inputRef.current?.focus()
    } catch (err) { setError(getErrorMessage(err)) } finally { setSending(false); setProgress(0) }
  }

  return (
    <form onSubmit={submit} className="relative border-t border-slate-200 p-3 dark:border-slate-800">
      {error && <p role="alert" className="mb-2 text-xs text-red-500">{error}</p>}
      {file && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
          <span aria-hidden="true">📎</span><span className="min-w-0 flex-1 truncate">{file.name} ({fileSize(file.size)})</span>
          <button type="button" aria-label="Remove attachment" onClick={() => setFile(null)}>✕</button>
        </div>
      )}
      {sending && file && <div role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100" aria-label="Upload progress" className="mb-2 h-1 overflow-hidden rounded bg-slate-200 dark:bg-slate-800"><div className="h-full bg-brand-600" style={{ width: `${progress}%` }} /></div>}
      {emoji && <div className="absolute bottom-full left-3 mb-1 w-72 max-w-[calc(100%-1.5rem)]"><EmojiPicker onPick={(em) => { setText((t) => t + em); inputRef.current?.focus() }} /></div>}
      <SmartReplyBar convId={convId} onPick={(t) => { setText(t); inputRef.current?.focus() }} />
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Emoji" aria-expanded={emoji} className="rounded-lg px-1 text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" onClick={() => setEmoji(!emoji)}>😊</button>
        <input ref={fileInput} type="file" className="hidden" tabIndex={-1} aria-hidden="true" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm,application/pdf" onChange={pickFile} />
        <button type="button" aria-label="Attach file" className="rounded-lg px-1 text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" onClick={() => fileInput.current.click()}>📎</button>
        <input ref={inputRef} aria-label="Message" className="field" maxLength={2000} value={text} onChange={onChange} placeholder="Message..." autoComplete="off" />
        <button type="submit" disabled={sending || (!text.trim() && !file)} className="btn-primary">{sending ? '...' : 'Send'}</button>
      </div>
    </form>
  )
}
