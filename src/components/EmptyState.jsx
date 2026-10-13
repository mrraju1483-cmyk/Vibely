export default function EmptyState({ icon = '✨', title, text }) {
  return (
    <div className="flex flex-col items-center gap-1 py-10 text-center">
      <span aria-hidden="true" className="text-3xl">{icon}</span>
      <p className="font-semibold">{title}</p>
      {text && <p className="max-w-xs text-sm text-slate-500">{text}</p>}
    </div>
  )
}
