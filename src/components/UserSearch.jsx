import { useEffect, useState } from 'react'
import UserCard from './UserCard.jsx'
import EmptyState from './EmptyState.jsx'
import ErrorState from './ErrorState.jsx'
import { searchUsersApi } from '../api/userApi.js'
import { getErrorMessage } from '../api/axios.js'

// Shows real results for `query` (debounced). Renders nothing when the query is empty.
export default function UserSearch({ query }) {
  const q = query.trim()
  const [users, setUsers] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function run(p, cancelled = () => false) {
    setLoading(true); setError('')
    try {
      const data = await searchUsersApi(q, p)
      if (cancelled()) return
      setUsers((prev) => (p === 1 ? data.users : [...prev, ...data.users]))
      setHasMore(data.hasMore); setPage(p)
    } catch (err) {
      if (!cancelled()) setError(getErrorMessage(err))
    } finally {
      if (!cancelled()) setLoading(false)
    }
  }

  useEffect(() => {
    if (!q) { setUsers([]); setError(''); return }
    let stale = false
    const id = setTimeout(() => run(1, () => stale), 350)
    return () => { stale = true; clearTimeout(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  if (!q) return null
  return (
    <section aria-label="Search results" aria-live="polite">
      {error && <ErrorState message={error} onRetry={() => run(1)} />}
      {!error && !loading && users.length === 0 && <EmptyState icon="🔎" title="No users found" text={`Nothing matched "${q}".`} />}
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">{users.map((u) => <UserCard key={u.id} user={u} />)}</ul>
      {loading && <p role="status" className="py-3 text-center text-sm text-slate-500">Searching...</p>}
      {hasMore && !loading && <button type="button" onClick={() => run(page + 1)} className="btn-ghost mt-2 w-full">Show more</button>}
    </section>
  )
}
