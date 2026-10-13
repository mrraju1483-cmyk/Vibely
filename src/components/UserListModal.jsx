import { useCallback, useEffect, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import UserCard from './UserCard.jsx'
import EmptyState from './EmptyState.jsx'
import ErrorState from './ErrorState.jsx'
import { getErrorMessage } from '../api/axios.js'

// Used for both Followers and Following. fetchPage(page) -> { users, hasMore }
export default function UserListModal({ title, fetchPage, onClose }) {
  const [users, setUsers] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage

  const load = useCallback(async (p) => {
    setLoading(true); setError('')
    try {
      const data = await fetchRef.current(p)
      setUsers((prev) => (p === 1 ? data.users : [...prev, ...data.users]))
      setHasMore(data.hasMore); setPage(p)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load(1) }, [load])

  return (
    <Modal title={title} onClose={onClose}>
      {error && <ErrorState message={error} onRetry={() => load(page)} />}
      {!error && !loading && users.length === 0 && <EmptyState icon="👥" title="No one here yet" />}
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">{users.map((u) => <UserCard key={u.id} user={u} />)}</ul>
      {loading && <p role="status" className="py-3 text-center text-sm text-slate-500">Loading...</p>}
      {hasMore && !loading && <button type="button" onClick={() => load(page + 1)} className="btn-ghost mt-2 w-full">Load more</button>}
    </Modal>
  )
}
