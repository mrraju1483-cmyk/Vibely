import { useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../../components/Avatar.jsx'
import { Badge, FilterSelect, ListFooter, fmtDate } from '../../components/admin/AdminBits.jsx'
import { usePagedList, useDebounced } from '../../hooks/usePagedList.js'
import { adminUsersApi } from '../../api/adminApi.js'
import { timeAgo } from '../../utils/time.js'

export default function AdminUsersPage() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [role, setRole] = useState('')
  const dq = useDebounced(q)
  const list = usePagedList(async (cursor) => {
    const d = await adminUsersApi({ q: dq || undefined, status: status || undefined, role: role || undefined, cursor: cursor || undefined })
    return { list: d.users, nextCursor: d.nextCursor }
  }, [dq, status, role])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-[2]">
          <label htmlFor="admin-user-search" className="mb-1 block text-xs font-medium text-slate-500">Search name, username or email</label>
          <input id="admin-user-search" type="search" className="field" value={q} onChange={(e) => setQ(e.target.value)} maxLength={50} />
        </div>
        <FilterSelect id="admin-status" label="Status" value={status} onChange={setStatus} options={[['', 'All'], ['active', 'Active'], ['inactive', 'Deactivated'], ['removed', 'Removed']]} />
        <FilterSelect id="admin-role" label="Role" value={role} onChange={setRole} options={[['', 'All'], ['user', 'Users'], ['admin', 'Admins']]} />
      </div>
      <ul className="space-y-2">
        {list.items.map((u) => (
          <li key={u.id}>
            <Link to={`/admin/users/${u.id}`} className="card flex items-center gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <Avatar name={u.fullName} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1"><span className="truncate text-sm font-semibold">{u.fullName}</span><span className="text-xs text-slate-500">@{u.username}</span>
                  {u.role === 'admin' && <Badge tone="purple">Admin</Badge>}
                  {u.removed ? <Badge tone="red">Removed</Badge> : !u.isActive && <Badge tone="amber">Deactivated</Badge>}
                  {!u.isVerified && !u.removed && <Badge>Unverified</Badge>}</span>
                <span className="block truncate text-xs text-slate-500">{u.email}</span>
                <span className="block text-xs text-slate-400" title={fmtDate(u.createdAt)}>Joined {timeAgo(u.createdAt)} ago{u.lastSeenAt ? ` · seen ${timeAgo(u.lastSeenAt)} ago` : ''}</span>
              </span>
              <span aria-hidden="true" className="text-slate-400">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <ListFooter list={list} emptyTitle="No users found" emptyText="Try a different search or filter." />
    </div>
  )
}
