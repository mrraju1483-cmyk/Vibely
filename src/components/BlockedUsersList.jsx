import { useEffect, useState } from 'react'
import UserCard from './UserCard.jsx'
import { blockedApi, unblockApi } from '../api/userApi.js'
import { getErrorMessage } from '../api/axios.js'

export default function BlockedUsersList() {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    blockedApi().then((d) => setUsers(d.users)).catch((e) => setError(getErrorMessage(e)))
  }, [])

  async function unblock(id) {
    setError('')
    try { await unblockApi(id); setUsers((u) => u.filter((x) => x.id !== id)) } catch (e) { setError(getErrorMessage(e)) }
  }

  return (
    <div className="p-4">
      <p className="font-medium">Blocked Users</p>
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
      {users === null && !error && <p className="text-xs text-slate-500">Loading...</p>}
      {users?.length === 0 && <p className="text-xs text-slate-500">You have not blocked anyone.</p>}
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {users?.map((u) => <UserCard key={u.id} user={u} action={<button type="button" className="btn-ghost px-3 py-1" onClick={() => unblock(u.id)}>Unblock</button>} />)}
      </ul>
    </div>
  )
}
