import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PostCard from '../components/PostCard.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { getPostApi } from '../api/postApi.js'
import { getErrorMessage } from '../api/axios.js'

export default function PostPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [post, setPost] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError(''); setPost(null)
    try { setPost(await getPostApi(id)) } catch (e) { setError(getErrorMessage(e)) }
  }, [id])
  useEffect(() => { load() }, [load])

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <button type="button" className="text-sm text-brand-600" onClick={() => nav(-1)}>← Back</button>
      {error && <ErrorState message={error} onRetry={load} />}
      {!post && !error && <p role="status" className="py-10 text-center text-sm text-slate-500">Loading post...</p>}
      {post && <PostCard key={post.id} post={post} startOpen onDeleted={() => nav('/home', { replace: true })} />}
      {error && <p className="text-center text-sm"><Link to="/home" className="text-brand-600">Go to feed</Link></p>}
    </div>
  )
}
