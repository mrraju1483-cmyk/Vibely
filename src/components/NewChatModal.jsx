import { useState } from 'react'
import Modal from './Modal.jsx'
import UserPicker from './UserPicker.jsx'
import { useChat } from '../context/ChatContext.jsx'
import { getErrorMessage, getFieldErrors } from '../api/axios.js'

// mode: 'direct' (pick one person) or 'group' (name + several people)
export default function NewChatModal({ mode, onClose, onOpened }) {
  const { openDirect, createGroup } = useChat()
  const [picked, setPicked] = useState([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})

  async function run(fn) {
    setBusy(true); setError(''); setErrors({})
    try { onOpened(await fn()) } catch (e) { setError(getErrorMessage(e)); setErrors(getFieldErrors(e)); setBusy(false) }
  }
  const toggle = (u) => setPicked((p) => (p.some((x) => x.id === u.id) ? p.filter((x) => x.id !== u.id) : [...p, u]))

  return (
    <Modal title={mode === 'group' ? 'New group' : 'New chat'} onClose={onClose}>
      <div className="space-y-3">
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{error}</p>}
        {mode === 'group' && (
          <div>
            <label htmlFor="group-name" className="mb-1 block text-sm font-medium">Group name</label>
            <input id="group-name" className="field" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
            {errors.name && <p role="alert" className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>
        )}
        {mode === 'group' && picked.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Selected people">
            {picked.map((u) => <li key={u.id}><button type="button" className="rounded-full bg-brand-100 px-2 py-1 text-xs text-brand-700 dark:bg-slate-800 dark:text-pink-300" onClick={() => toggle(u)} aria-label={`Remove ${u.username}`}>@{u.username} ✕</button></li>)}
          </ul>
        )}
        <UserPicker id="new-chat-search" selectedIds={picked.map((u) => u.id)} disabledIds={busy ? picked.map((u) => u.id) : []}
          onPick={(u) => (mode === 'group' ? toggle(u) : run(() => openDirect(u.id)))} />
        {errors.memberIds && <p role="alert" className="text-xs text-red-500">{errors.memberIds}</p>}
        {mode === 'group' && <button type="button" disabled={busy || !name.trim() || picked.length === 0} className="btn-primary w-full" onClick={() => run(() => createGroup(name.trim(), picked.map((u) => u.id)))}>{busy ? 'Creating...' : `Create group (${picked.length})`}</button>}
      </div>
    </Modal>
  )
}
