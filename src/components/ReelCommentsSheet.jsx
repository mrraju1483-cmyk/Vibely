import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from './Modal.jsx'
import Avatar from './Avatar.jsx'
import { reelCommentsApi, addReelCommentApi, deleteReelCommentApi } from '../api/reelApi.js'
import { getErrorMessage } from '../api/axios.js'
import { timeAgo } from '../utils/time.js'

export default function ReelCommentsSheet({ reelId, onCountChange, onClose }) {
  const [comments, setComments] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const cursorRef = useRef(null)

  const load = useCallback(async (more) => {
    setLoading(true); setError('')
    try {
      const d = await reelCommentsApi(reelId, more ? cursorRef.current : null)
      cursorRef.current = d.nextCursor
      setCursor(d.nextCursor)
      setComments((c) => (more ? [...c, ...d.comments] : d.comments))
    } catch (e) { setError(getErrorMessage(e)) } finally { setLoading(false) }
  }, [reelId])
  useEffect(() => { load(false) }, [load])

  async function submit(e) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setBusy(true); setError('')
    try {
      const d = await addReelCommentApi(reelId, value)
      setComments((c) => [d.comment, ...c]); setText(''); onCountChange(1)
    } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) }
  }

  async function remove(id) {
    if (!window.confirm('Delete this comment?')) return
    try { await deleteReelCommentApi(id); setComments((c) => c.filter((x) => x.id !== id)); onCountChange(-1) } catch (e) { setError(getErrorMessage(e)) }
  }

  return (
    <Modal title="Comments" onClose={onClose}>
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="reel-comment" className="sr-only">Add a comment</label>
        <input id="reel-comment" className="field" maxLength={500} placeholder="Add a comment..." value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" disabled={busy || !text.trim()} className="btn-primary">Post</button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
      <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-2 py-2">
            <Avatar name={c.author.fullName} src={c.author.profilePhoto} size="h-8 w-8" />
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm"><Link to={`/profile/${c.author.id}`} className="font-semibold">{c.author.username}</Link> <span className="whitespace-pre-line">{c.text}</span></p>
              <p className="text-xs text-slate-400">{timeAgo(c.createdAt)}{c.isMine && <button type="button" className="ml-2 text-slate-500 underline" onClick={() => remove(c.id)}>Delete</button>}</p>
            </div>
          </li>
        ))}
      </ul>
      {loading && <p role="status" className="py-2 text-center text-xs text-slate-500">Loading comments...</p>}
      {!loading && !error && comments.length === 0 && <p className="py-3 text-center text-sm text-slate-500">No comments yet. Be the first.</p>}
      {cursor && !loading && <button type="button" className="btn-ghost mt-2 w-full" onClick={() => load(true)}>Load more</button>}
    </Modal>
  )
}
