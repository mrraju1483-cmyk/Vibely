import EmptyState from '../EmptyState.jsx'
import ErrorState from '../ErrorState.jsx'

export const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '—')

const TONES = {
  gray: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  purple: 'bg-brand-100 text-brand-700 dark:bg-slate-800 dark:text-pink-300',
}
export const Badge = ({ tone = 'gray', children }) => <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>

export function StatCard({ label, value, hint }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

// Small bar chart in plain SVG (no chart library). Screen readers get every value through aria-label.
export function MiniBarChart({ title, data }) {
  const max = Math.max(1, ...data.map((p) => p.value))
  const total = data.reduce((s, p) => s + p.value, 0)
  const W = 280, H = 80, bw = W / data.length
  return (
    <figure className="card p-4">
      <figcaption className="mb-2 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{title}</span><span className="text-xs text-slate-500">{total.toLocaleString()} in {data.length} days</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 14}`} role="img" aria-label={`${title}: ${data.map((p) => `${p.date} ${p.value}`).join(', ')}`} className="w-full text-slate-500">
        {data.map((p, i) => {
          const h = Math.round((p.value / max) * H)
          return <rect key={p.date} x={i * bw + 2} y={H - Math.max(h, 1)} width={bw - 4} height={Math.max(h, 1)} rx="2" className="fill-brand-600"><title>{`${p.date}: ${p.value}`}</title></rect>
        })}
        <text x="0" y={H + 12} fontSize="9" fill="currentColor">{data[0].date.slice(5)}</text>
        <text x={W} y={H + 12} fontSize="9" fill="currentColor" textAnchor="end">{data[data.length - 1].date.slice(5)}</text>
      </svg>
    </figure>
  )
}

export function FilterSelect({ id, label, value, onChange, options }) {
  return (
    <div className="min-w-[8rem] flex-1">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

// Loading / error / empty / "load more" footer for a usePagedList result
export function ListFooter({ list, emptyTitle = 'Nothing here', emptyText }) {
  const { items, loading, error, hasMore, more, reload } = list
  return (
    <>
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && items.length === 0 && <EmptyState icon="📭" title={emptyTitle} text={emptyText} />}
      {loading && <p role="status" className="py-3 text-center text-sm text-slate-500">Loading...</p>}
      {hasMore && !loading && <button type="button" className="btn-ghost mt-2 w-full" onClick={more}>Load more</button>}
    </>
  )
}
