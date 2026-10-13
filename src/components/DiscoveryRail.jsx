import { Link } from 'react-router-dom'
import UserCard from './UserCard.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { recommendedUsersApi, trendingHashtagsApi } from '../api/exploreApi.js'

// Desktop right-hand column: real recommendations and trending hashtags
export default function DiscoveryRail() {
  const rec = useAsync(() => recommendedUsersApi().then((d) => d.users.slice(0, 4)), [])
  const tags = useAsync(() => trendingHashtagsApi().then((d) => d.hashtags.slice(0, 6)), [])
  return (
    <>
      <section className="card p-4">
        <h2 className="mb-1 font-semibold">Suggested for you</h2>
        {rec.error && <p role="alert" className="text-xs text-red-500">{rec.error}</p>}
        {rec.data?.length === 0 && <p className="text-xs text-slate-500">No suggestions yet. Follow people to get better ones.</p>}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">{rec.data?.map((u) => <UserCard key={u.id} user={u} />)}</ul>
        <Link to="/explore" className="mt-2 block text-xs font-semibold text-brand-600">See more in Explore</Link>
      </section>
      <section className="card p-4">
        <h2 className="mb-2 font-semibold">Trending</h2>
        {tags.error && <p role="alert" className="text-xs text-red-500">{tags.error}</p>}
        {tags.data?.length === 0 && <p className="text-xs text-slate-500">Nothing trending yet.</p>}
        <ul className="space-y-1 text-sm">
          {tags.data?.map((t) => (
            <li key={t.name} className="flex justify-between">
              <Link to={`/hashtag/${encodeURIComponent(t.name)}`} className="text-brand-600">#{t.name}</Link>
              <span className="text-slate-500">{t.recentPosts} {t.recentPosts === 1 ? 'post' : 'posts'}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
