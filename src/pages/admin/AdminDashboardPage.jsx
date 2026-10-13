import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatCard, MiniBarChart, Badge, fmtDate } from '../../components/admin/AdminBits.jsx'
import ErrorState from '../../components/ErrorState.jsx'
import { adminStatsApi } from '../../api/adminApi.js'
import { getErrorMessage } from '../../api/axios.js'

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const load = () => { setError(''); adminStatsApi().then(setStats).catch((e) => setError(getErrorMessage(e))) }
  useEffect(load, [])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!stats) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading dashboard...</p>
  const { users, content, reports, series } = stats
  return (
    <div className="space-y-6">
      <section aria-label="Overview" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total users" value={users.total} hint={`+${users.newLast7Days} this week`} />
        <StatCard label="Active (24h)" value={users.seenLast24h} hint={`${users.seenLast7Days} in 7 days`} />
        <StatCard label="Posts" value={content.posts} hint={`+${content.postsLast7Days} this week`} />
        <StatCard label="Reels" value={content.reels} hint={`+${content.reelsLast7Days} this week`} />
        <StatCard label="Active stories" value={content.activeStories} />
        <StatCard label="Comments" value={content.comments} />
        <StatCard label="Likes" value={content.likes} />
        <StatCard label="Messages (7d)" value={content.messagesLast7Days} />
      </section>

      <section aria-label="Reports" className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Reports</h2>
          <Link to="/admin/reports" className="btn-primary px-3 py-1">Review queue</Link>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <Badge tone={reports.open ? 'red' : 'green'}>{reports.open} open</Badge><Badge>{reports.resolved} resolved</Badge><Badge>{reports.rejected} rejected</Badge>
          <Badge tone="amber">{users.deactivated} deactivated accounts</Badge>
        </div>
        {reports.openByReason.length > 0 && (
          <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            {reports.openByReason.map((r) => <li key={r.reason} className="flex justify-between rounded-lg bg-slate-50 px-3 py-1 dark:bg-slate-800"><span className="capitalize">{r.reason}</span><span className="font-semibold">{r.count}</span></li>)}
          </ul>
        )}
      </section>

      <section aria-label="Engagement over the last 14 days" className="grid gap-3 sm:grid-cols-2">
        <MiniBarChart title="New users" data={series.newUsers} />
        <MiniBarChart title="New posts" data={series.newPosts} />
        <MiniBarChart title="New comments" data={series.newComments} />
        <MiniBarChart title="New likes" data={series.newLikes} />
      </section>
      <p className="text-xs text-slate-500">Updated {fmtDate(stats.generatedAt)}. Daily counts use UTC days.</p>
    </div>
  )
}
