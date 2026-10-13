import { useState } from 'react'

// Uncontrolled by default (Phase 1 behaviour). Pass checked + onChange to control it.
export default function Toggle({ label, description, defaultOn = false, checked, onChange, disabled }) {
  const [local, setLocal] = useState(defaultOn)
  const on = checked !== undefined ? checked : local
  const toggle = () => (onChange ? onChange(!on) : setLocal(!on))
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div>
        <p className="font-medium">{label}</p>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={toggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 ${on ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
