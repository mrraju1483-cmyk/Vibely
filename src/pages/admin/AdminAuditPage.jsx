import { Badge, ListFooter, fmtDate } from '../../components/admin/AdminBits.jsx'
import { usePagedList } from '../../hooks/usePagedList.js'
import { adminAuditApi } from '../../api/adminApi.js'

const LABELS = {
  user_deactivate: 'Deactivated a user', user_activate: 'Reactivated a user', user_remove: 'Removed a user',
  post_remove: 'Removed a post', reel_remove: 'Removed a reel', comment_remove: 'Removed a comment', report_update: 'Updated a report',
}
const TONE = { user_remove: 'red', post_remove: 'red', reel_remove: 'red', comment_remove: 'red', user_deactivate: 'amber', user_activate: 'green', report_update: 'purple' }

export default function AdminAuditPage() {
  const list = usePagedList(async (cursor) => {
    const d = await adminAuditApi({ cursor: cursor || undefined })
    return { list: d.entries, nextCursor: d.nextCursor }
  }, [])
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">A permanent record of what admins did, to whom, and why. It cannot be edited from the app.</p>
      <ol className="space-y-2">
        {list.items.map((e) => (
          <li key={e.id} className="card space-y-1 p-3 text-sm">
            <p className="flex flex-wrap items-center gap-1"><Badge tone={TONE[e.action] || 'gray'}>{LABELS[e.action] || e.action}</Badge>
              {e.targetLabel && <span className="font-medium">{e.targetLabel}</span>}
              <span className="ml-auto text-xs text-slate-500">{fmtDate(e.createdAt)}</span></p>
            <p className="text-xs text-slate-500">by @{e.admin}</p>
            {e.reason && <p className="break-words">Reason: {e.reason}</p>}
            {e.meta && <p className="break-all font-mono text-xs text-slate-400">{JSON.stringify(e.meta)}</p>}
          </li>
        ))}
      </ol>
      <ListFooter list={list} emptyTitle="No admin actions yet" />
    </div>
  )
}
