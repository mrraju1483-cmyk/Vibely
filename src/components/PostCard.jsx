import { useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from './Avatar.jsx'
import CommentSection from './CommentSection.jsx'
import ShareModal from './ShareModal.jsx'
import ReportModal from './ReportModal.jsx'
import { timeAgo } from '../utils/time.js'
import { deletePostApi, likePostApi, unlikePostApi, reportPostApi, savePostApi, unsavePostApi } from '../api/postApi.js'
import { getErrorMessage } from '../api/axios.js'

export default function PostCard({ post: initial, onDeleted, startOpen = false }) {
  const [post, setPost] = useState(initial)
  const [showComments, setShowComments] = useState(startOpen)
  const [modal, setModal] = useState(null) // 'share' | 'report'
  const [error, setError] = useState('')
  const btn = 'rounded-lg px-2 py-1 text-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800'

  async function toggleLike() {
    const was = post.likedByMe
    setError('')
    setPost((p) => ({ ...p, likedByMe: !was, likesCount: Math.max(0, p.likesCount + (was ? -1 : 1)) }))
    try {
      const r = await (was ? unlikePostApi : likePostApi)(post.id)
      setPost((p) => ({ ...p, likedByMe: r.liked, likesCount: r.likesCount }))
    } catch (e) {
      setPost((p) => ({ ...p, likedByMe: was, likesCount: Math.max(0, p.likesCount + (was ? 1 : -1)) }))
      setError(getErrorMessage(e))
    }
  }

  async function toggleSave() {
    const was = post.savedByMe
    setError('')
    setPost((p) => ({ ...p, savedByMe: !was }))
    try { await (was ? unsavePostApi : savePostApi)(post.id) } catch (e) { setPost((p) => ({ ...p, savedByMe: was })); setError(getErrorMessage(e)) }
  }

  async function remove() {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    try { await deletePostApi(post.id); onDeleted?.(post.id) } catch (e) { setError(getErrorMessage(e)) }
  }

  const { author } = post
  return (
    <article className="card overflow-hidden">
      <header className="flex items-center gap-3 p-3">
        <Link to={`/profile/${author.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          <Avatar name={author.fullName} src={author.profilePhoto} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{author.username}</span>
            <span className="block truncate text-xs text-slate-500">
              {timeAgo(post.createdAt)}{post.location && ` · ${post.location}`}{post.visibility !== 'public' && ` · ${post.visibility === 'followers' ? 'Followers' : 'Only me'}`}
            </span>
          </span>
        </Link>
        {post.isMine
          ? <button type="button" className={btn} onClick={remove} aria-label="Delete post">🗑️</button>
          : <button type="button" className={btn} onClick={() => setModal('report')} aria-label="Report post">🚩</button>}
      </header>

      <Link to={`/post/${post.id}`} aria-label="Open post" className="block bg-slate-100 dark:bg-slate-800">
        {post.mediaType === 'video' ? (
          <video src={post.mediaUrl} controls playsInline preload="metadata" className="max-h-[80vh] w-full bg-black" onClick={(e) => e.stopPropagation()} />
        ) : (
          <img src={post.mediaUrl} alt={post.caption ? `Post by ${author.username}: ${post.caption.slice(0, 80)}` : `Post by ${author.username}`} loading="lazy" className="max-h-[80vh] w-full object-contain" />
        )}
      </Link>

      <div className="p-3">
        <div className="flex items-center gap-1">
          <button type="button" className={btn} aria-pressed={post.likedByMe} aria-label="Like" onClick={toggleLike}>{post.likedByMe ? '❤️' : '🤍'} {post.likesCount}</button>
          <button type="button" className={btn} aria-expanded={showComments} aria-label="Comments" onClick={() => setShowComments(!showComments)}>💬 {post.commentsCount}</button>
          <button type="button" className={btn} aria-label="Share" onClick={() => setModal('share')}>↗️ {post.sharesCount}</button>
          <button type="button" className={`${btn} ml-auto`} aria-pressed={post.savedByMe} aria-label="Save" onClick={toggleSave}>{post.savedByMe ? '🔖' : '📑'}</button>
        </div>
        {post.caption && <p className="mt-2 whitespace-pre-line break-words text-sm"><span className="font-semibold">{author.username}</span> {post.caption}</p>}
        {post.hashtags.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-x-2 break-words text-sm text-brand-600">
            {post.hashtags.map((h) => <Link key={h} to={`/hashtag/${encodeURIComponent(h)}`} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">#{h}</Link>)}
          </p>
        )}
        {error && <p role="alert" className="mt-1 text-xs text-red-500">{error}</p>}
      </div>

      {showComments && <CommentSection postId={post.id} onCountChange={(n) => setPost((p) => ({ ...p, commentsCount: Math.max(0, p.commentsCount + n) }))} />}
      {modal === 'share' && <ShareModal post={post} onClose={() => setModal(null)} onShared={(n) => setPost((p) => ({ ...p, sharesCount: n }))} />}
      {modal === 'report' && <ReportModal title="Report post" onClose={() => setModal(null)} onSubmit={(body) => reportPostApi(post.id, body)} />}
    </article>
  )
}
