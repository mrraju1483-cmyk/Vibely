import { Link } from 'react-router-dom'

// tags: [{ name, postsCount? , recentPosts? }]
export default function HashtagChips({ tags }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {tags.map((t) => {
        const n = t.postsCount ?? t.recentPosts
        return (
          <li key={t.name}>
            <Link to={`/hashtag/${encodeURIComponent(t.name)}`} className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:hover:bg-slate-800">
              <span className="font-medium text-brand-600">#{t.name}</span>
              {n !== undefined && <span className="text-xs text-slate-500">{n} {n === 1 ? 'post' : 'posts'}</span>}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
