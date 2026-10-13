export default function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-sm text-red-500">{message}</p>
      {onRetry && <button type="button" onClick={onRetry} className="btn-ghost">Try again</button>}
    </div>
  )
}
