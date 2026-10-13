import { useEffect, useState } from 'react'
import UserCard from './UserCard.jsx'
import { requestsApi, acceptRequestApi, rejectRequestApi } from '../api/userApi.js'
import { getErrorMessage } from '../api/axios.js'

export default function FollowRequests({ onResolved }) {
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  useEffect(() => { requestsApi().then((d) => setUsers(d.users)).catch(() => {}) }, [])

  async function resolve(id, accept) {
    setError('')
    try {
      await (accept ? acceptRequestApi(id) : rejectRequestApi(id))
      setUsers((u) => u.filter((x) => x.id !== id))
      onResolved?.()
    } catch (e) { setError(getErrorMessage(e)) }
  }
  if (!users.length && !error) return null
  return (
    <section aria-label="Follow requests" className="card p-4">
      <h2 className="font-semibold">Follow requests ({users.length})</h2>
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {users.map((u) => (
          <UserCard key={u.id} user={u} action={
            <span className="flex gap-2">
              <button type="button" className="btn-primary px-3 py-1" onClick={() => resolve(u.id, true)}>Accept</button>
              <button type="button" className="btn-ghost px-3 py-1" onClick={() => resolve(u.id, false)}>Decline</button>
            </span>} />
        ))}
      </ul>
    </section>
  )
}
