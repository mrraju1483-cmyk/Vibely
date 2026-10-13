import { NavLink, Outlet } from 'react-router-dom'

const tabs = [['/admin', 'Dashboard', true], ['/admin/users', 'Users'], ['/admin/reports', 'Reports'], ['/admin/content', 'Content'], ['/admin/audit', 'Audit log']]

export default function AdminShell() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">🛡️ Admin</h1>
        <p className="text-xs text-slate-500">Every action here is recorded in the audit log.</p>
      </div>
      <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {tabs.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `whitespace-nowrap px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${isActive ? 'border-b-2 border-brand-600 text-brand-600' : 'text-slate-500'}`}>
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
