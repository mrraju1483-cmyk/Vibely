export default function LoadingState({ label = 'Loading...' }) {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center gap-3 text-slate-500">
      <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {label}
    </div>
  )
}
