import { useEffect, useRef } from 'react'

export default function Modal({ title, onClose, children }) {
  const panel = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement
    panel.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus?.()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="modal-title"
        className="card flex max-h-[85vh] w-full max-w-md flex-col rounded-b-none outline-none sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
          <h2 id="modal-title" className="font-semibold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}
