import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PostGrid from '../components/PostGrid.jsx'
import { hashtagPostsApi } from '../api/exploreApi.js'

export default function HashtagPage() {
  const { name } = useParams()
  const [meta, setMeta] = useState(null)
  const fetchPage = useCallback(async (cursor) => {
    const d = await hashtagPostsApi(name, cursor)
    setMeta(d.hashtag)
    return d
  }, [name])

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/explore" className="text-sm text-brand-600">← Explore</Link>
      <header>
        <h1 className="text-2xl font-bold">#{name}</h1>
        {meta && <p className="text-sm text-slate-500">{meta.postsCount} {meta.postsCount === 1 ? 'post' : 'posts'}</p>}
      </header>
      <PostGrid key={name} fetchPage={fetchPage} emptyTitle="No posts with this hashtag" emptyText="Public posts from public accounts show up here." />
    </div>
  )
}
