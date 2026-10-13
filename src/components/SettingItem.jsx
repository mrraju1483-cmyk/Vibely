export default function SettingItem({ icon, label, hint, onClick, danger }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800 ${danger ? 'text-red-500' : ''}`}>
      <span aria-hidden="true">{icon}</span>
      <span className="flex-1"><span className="block font-medium">{label}</span>{hint && <span className="text-xs text-slate-500">{hint}</span>}</span>
      <span aria-hidden="true" className="text-slate-400">›</span>
    </button>
  )
}
