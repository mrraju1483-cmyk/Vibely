import { useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from './Avatar.jsx'
import { timeAgo } from '../utils/time.js'
import { addCommentApi, deleteCommentApi, likeCommentApi, repliesApi, unlikeCommentApi } from '../api/postApi.js'
import { getErrorMessage } from '../api/axios.js'

export default function CommentItem({ comment, postId, isReply = false, onDeleted, onCountChange }) {
  const [c, setC] = useState(comment)
  const [replies, setReplies] = useState([])
  const [repliesLoaded, setRepliesLoaded] = useState(false)
  const [showReplies, setShowReplies] = useState(false)
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function toggleLike() {
    const was = c.likedByMe
    setC((x) => ({ ...x, likedByMe: !was, likesCount: Math.max(0, x.likesCount + (was ? -1 : 1)) }))
    try {
      const r = await (was ? unlikeCommentApi : likeCommentApi)(c.id)
      setC((x) => ({ ...x, likedByMe: r.liked, likesCount: r.likesCount }))
    } catch (e) {
      setC((x) => ({ ...x, likedByMe: was, likesCount: Math.max(0, x.likesCount + (was ? 1 : -1)) }))
      setError(getErrorMessage(e))
    }
  }

  async function loadReplies(from) {
    setLoading(true); setError('')
    try {
      const d = await repliesApi(c.id, from)
      setReplies((r) => (from ? [...r, ...d.comments] : d.comments))
      setCursor(d.nextCursor); setRepliesLoaded(true)
    } catch (e) { setError(getErrorMessage(e)) } finally { setLoading(false) }
  }

  function toggleReplies() {
    if (!showReplies && !repliesLoaded) loadReplies(null)
    setShowReplies(!showReplies)
  }

  async function sendReply(e) {
    e.preventDefault()
    const text = replyText.trim()
    if (!text) return
    setBusy(true); setError('')
    try {
      const d = await addCommentApi(postId, { text, parentId: c.id })
      setC((x) => ({ ...x, repliesCount: x.repliesCount + 1 }))
      if (repliesLoaded) setReplies((r) => [...r, d.comment]); else await loadReplies(null)
      setShowReplies(true); setReplyText(''); setReplyOpen(false); onCountChange(1)
    } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) }
  }

  async function remove() {
    if (!window.confirm('Delete this comment?')) return
    try { const d = await deleteCommentApi(c.id); onCountChange(-d.removed); onDeleted(c.id) } catch (e) { setError(getErrorMessage(e)) }
  }

  const replyDeleted = (id) => { setReplies((r) => r.filter((x) => x.id !== id)); setC((x) => ({ ...x, repliesCount: Math.max(0, x.repliesCount - 1) })) }
  const small = 'rounded px-1 text-xs text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:text-slate-100'

  return (
    <li className="py-2">
      <div className="flex gap-2">
        <Avatar name={c.author.fullName} src={c.author.profilePhoto} size="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm">
            <Link to={`/profile/${c.author.id}`} className="font-semibold">{c.author.username}</Link>{' '}
            <span className="whitespace-pre-line">{c.text}</span>
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">{timeAgo(c.createdAt)}</span>
            <button type="button" className={small} aria-pressed={c.likedByMe} onClick={toggleLike}>{c.likedByMe ? '❤️' : '🤍'} {c.likesCount}</button>
            {!isReply && <button type="button" className={small} onClick={() => setReplyOpen(!replyOpen)}>Reply</button>}
            {c.isMine && <button type="button" className={small} onClick={remove}>Delete</button>}
          </div>
          {error && <p role="alert" className="text-xs text-red-500">{error}</p>}

          {replyOpen && (
            <form onSubmit={sendReply} className="mt-2 flex gap-2">
              <label htmlFor={`reply-${c.id}`} className="sr-only">Write a reply</label>
              <input id={`reply-${c.id}`} className="field py-1" maxLength={500} placeholder={`Reply to ${c.author.username}`} value={replyText} onChange={(e) => setReplyText(e.target.value)} />
              <button type="submit" disabled={busy || !replyText.trim()} className="btn-primary px-3 py-1">Send</button>
            </form>
          )}

          {!isReply && c.repliesCount > 0 && (
            <button type="button" className={`${small} mt-1`} onClick={toggleReplies}>{showReplies ? 'Hide replies' : `View ${c.repliesCount} ${c.repliesCount === 1 ? 'reply' : 'replies'}`}</button>
          )}
          {showReplies && (
            <ul className="ml-2 border-l border-slate-200 pl-2 dark:border-slate-800">
              {replies.map((r) => <CommentItem key={r.id} comment={r} postId={postId} isReply onDeleted={replyDeleted} onCountChange={onCountChange} />)}
              {loading && <li className="text-xs text-slate-500">Loading...</li>}
              {cursor && !loading && <li><button type="button" className={small} onClick={() => loadReplies(cursor)}>More replies</button></li>}
            </ul>
          )}
        </div>
      </div>
    </li>
  )
}
