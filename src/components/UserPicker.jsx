import { useEffect, useState } from 'react'
import Avatar from './Avatar.jsx'
import { searchUsersApi } from '../api/userApi.js'
import { getErrorMessage } from '../api/axios.js'

// Search people and pick one. selectedIds get a check, disabledIds cannot be chosen.
export default function UserPicker({ onPick, selectedIds = [], disabledIds = [], id = 'user-picker' }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const term = q.trim()
    if (!term) { setResults([]); setError(''); return }
    let stale = false
    const t = setTimeout(async () => {
      setLoading(true); setError('')
      try { const d = await searchUsersApi(term); if (!stale) setResults(d.users) } catch (e) { if (!stale) setError(getErrorMessage(e)) } finally { if (!stale) setLoading(false) }
    }, 300)
    return () => { stale = true; clearTimeout(t) }
  }, [q])

  return (
    <div>
      <label htmlFor={id} className="sr-only">Search people</label>
      <input id={id} type="search" className="field" placeholder="Search by name or username" value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <p role="alert" className="mt-1 text-xs text-red-500">{error}</p>}
      {loading && <p role="status" className="py-2 text-xs text-slate-500">Searching...</p>}
      {!loading && q.trim() && !error && results.length === 0 && <p className="py-2 text-xs text-slate-500">No one found.</p>}
      <ul className="mt-1 max-h-56 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
        {results.map((u) => (
          <li key={u.id}>
            <button type="button" disabled={disabledIds.includes(u.id)} onClick={() => onPick(u)} className="flex w-full items-center gap-3 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40 dark:hover:bg-slate-800">
              <Avatar name={u.fullName} src={u.profilePhoto} />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{u.fullName}</span><span className="block truncate text-xs text-slate-500">@{u.username}</span></span>
              {selectedIds.includes(u.id) && <span aria-label="Selected">✓</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
