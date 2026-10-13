import { useEffect, useState } from 'react'
import { aiSmartRepliesApi } from '../api/aiApi.js'
import { useAIStatus } from '../hooks/useAIStatus.js'
import { getErrorMessage } from '../api/axios.js'

// Suggests short replies from the last few text messages of a chat. onPick(text) decides what to do with a suggestion.
export default function SmartReplyBar({ convId, onPick }) {
  const status = useAIStatus()
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setReplies([]); setError('') }, [convId])

  if (status && !status.available) return null // AI is off: stay out of the way

  async function suggest() {
    setLoading(true); setError(''); setReplies([])
    try { setReplies((await aiSmartRepliesApi(convId)).replies) } catch (e) { setError(getErrorMessage(e)) } finally { setLoading(false) }
  }

  return (
    <div className="mb-2">
      <button type="button" onClick={suggest} disabled={loading} title="Sends your last few text messages in this chat to Vibely AI"
        className="rounded-full border border-brand-500 px-3 py-0.5 text-xs text-brand-600 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 dark:hover:bg-slate-800">
        {loading ? '✨ Thinking...' : '✨ Suggest replies'}
      </button>
      {replies.length > 0 && (
        <>
          <ul aria-label="Suggested replies" className="mt-2 flex flex-wrap gap-2">
            {replies.map((r) => (
              <li key={r}><button type="button" onClick={() => { onPick(r); setReplies([]) }} className="rounded-full bg-brand-100 px-3 py-1 text-xs text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-slate-800 dark:text-pink-300">{r}</button></li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] text-slate-500">AI suggestions based on your last few messages here.</p>
        </>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
