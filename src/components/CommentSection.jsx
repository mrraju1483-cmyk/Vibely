import { useCallback, useEffect, useRef, useState } from 'react'
import CommentItem from './CommentItem.jsx'
import { addCommentApi, commentsApi } from '../api/postApi.js'
import { getErrorMessage } from '../api/axios.js'

export default function CommentSection({ postId, onCountChange }) {
  const [comments, setComments] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const cursorRef = useRef(null)

  const load = useCallback(async (more) => {
    setLoading(true); setError('')
    try {
      const d = await commentsApi(postId, more ? cursorRef.current : null)
      cursorRef.current = d.nextCursor
      setCursor(d.nextCursor)
      setComments((c) => (more ? [...c, ...d.comments] : d.comments))
    } catch (e) { setError(getErrorMessage(e)) } finally { setLoading(false) }
  }, [postId])
  useEffect(() => { load(false) }, [load])

  async function submit(e) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setBusy(true); setFormError('')
    try {
      const d = await addCommentApi(postId, { text: value })
      setComments((c) => [d.comment, ...c]); setText(''); onCountChange(1)
    } catch (err) { setFormError(getErrorMessage(err)) } finally { setBusy(false) }
  }

  return (
    <section aria-label="Comments" className="border-t border-slate-200 p-3 dark:border-slate-800">
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor={`comment-${postId}`} className="sr-only">Add a comment</label>
        <input id={`comment-${postId}`} className="field" maxLength={500} placeholder="Add a comment..." value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" disabled={busy || !text.trim()} className="btn-primary">Post</button>
      </form>
      {formError && <p role="alert" className="mt-1 text-xs text-red-500">{formError}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-500">{error} <button type="button" className="underline" onClick={() => load(false)}>Retry</button></p>}
      <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
        {comments.map((c) => (
          <CommentItem key={c.id} comment={c} postId={postId} onCountChange={onCountChange} onDeleted={(id) => setComments((l) => l.filter((x) => x.id !== id))} />
        ))}
      </ul>
      {loading && <p role="status" className="py-2 text-center text-xs text-slate-500">Loading comments...</p>}
      {!loading && !error && comments.length === 0 && <p className="py-2 text-center text-xs text-slate-500">No comments yet. Be the first.</p>}
      {cursor && !loading && <button type="button" className="btn-ghost mt-2 w-full" onClick={() => load(true)}>Load more comments</button>}
    </section>
  )
}
