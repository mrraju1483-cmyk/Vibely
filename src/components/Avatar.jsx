export default function Avatar({ name = '?', src, size = 'h-10 w-10', online }) {
  return (
    <span className={`relative inline-flex shrink-0 ${size}`} role="img" aria-label={`${name} avatar`}>
      {src ? (
        <img src={src} alt="" className="h-full w-full rounded-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-pink-500 text-sm font-bold text-white">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      {online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-slate-900" title="Online" />}
    </span>
  )
}
