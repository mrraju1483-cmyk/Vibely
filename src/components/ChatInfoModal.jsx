import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Modal from './Modal.jsx'
import Avatar from './Avatar.jsx'
import UserPicker from './UserPicker.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useChat } from '../context/ChatContext.jsx'
import { addMembersApi, getConversationApi, removeMemberApi, renameGroupApi, setDisappearApi, setGroupPhotoApi } from '../api/chatApi.js'
import { getErrorMessage } from '../api/axios.js'
import { DISAPPEAR_OPTIONS, convPhoto, convTitle } from '../utils/chat.js'

export default function ChatInfoModal({ conv, onClose }) {
  const nav = useNavigate()
  const { currentUser } = useAuth()
  const { upsertConversation, removeConversation } = useChat()
  const [name, setName] = useState(conv.name)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const photoInput = useRef(null)
  const isGroup = conv.type === 'group'
  const canEditGroup = isGroup && conv.isAdmin
  const canChangeDisappear = !isGroup || conv.isAdmin

  async function run(fn) {
    setBusy(true); setError('')
    try { await fn() } catch (e) { setError(getErrorMessage(e)) } finally { setBusy(false) }
  }
  const refetch = async () => upsertConversation((await getConversationApi(conv.id)).conversation)

  return (
    <Modal title={isGroup ? 'Group info' : 'Chat info'} onClose={onClose}>
      <div className="space-y-4">
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{error}</p>}
        <div className="flex items-center gap-3">
          <Avatar name={convTitle(conv)} src={convPhoto(conv)} size="h-16 w-16" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{convTitle(conv)}</p>
            {!isGroup && conv.other && <Link to={`/profile/${conv.other.user.id}`} onClick={onClose} className="text-sm text-brand-600">View profile</Link>}
            {isGroup && <p className="text-xs text-slate-500">{conv.participants.length} members</p>}
          </div>
        </div>

        {canEditGroup && (
          <>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim() && name.trim() !== conv.name) run(async () => upsertConversation((await renameGroupApi(conv.id, name.trim())).conversation)) }}>
              <label htmlFor="group-rename" className="sr-only">Group name</label>
              <input id="group-rename" className="field" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
              <button type="submit" disabled={busy} className="btn-ghost">Rename</button>
            </form>
            <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" tabIndex={-1} aria-hidden="true"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(async () => upsertConversation((await setGroupPhotoApi(conv.id, f)).conversation)) }} />
            <button type="button" disabled={busy} className="btn-ghost w-full" onClick={() => photoInput.current.click()}>Change group photo</button>
          </>
        )}

        <div>
          <label htmlFor="disappear" className="mb-1 block text-sm font-medium">Disappearing messages</label>
          <select id="disappear" className="field" disabled={busy || !canChangeDisappear} value={conv.disappearAfter}
            onChange={(e) => run(async () => upsertConversation((await setDisappearApi(conv.id, Number(e.target.value))).conversation))}>
            {DISAPPEAR_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">New messages are deleted after this time. {!canChangeDisappear && 'Only admins can change this.'}</p>
        </div>

        {isGroup && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-medium">Members</h3>
              {canEditGroup && <button type="button" className="text-sm text-brand-600" onClick={() => setAdding(!adding)}>{adding ? 'Done' : '+ Add people'}</button>}
            </div>
            {adding && (
              <div className="mb-2">
                <UserPicker id="add-members" disabledIds={conv.participants.map((p) => p.user.id)}
                  onPick={(u) => run(async () => { upsertConversation((await addMembersApi(conv.id, [u.id])).conversation) })} />
              </div>
            )}
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {conv.participants.map((p) => (
                <li key={p.user.id} className="flex items-center gap-3 py-2">
                  <Avatar name={p.user.fullName} src={p.user.profilePhoto} size="h-8 w-8" />
                  <span className="min-w-0 flex-1 truncate text-sm">{p.user.fullName} <span className="text-xs text-slate-500">@{p.user.username}</span></span>
                  {p.role === 'admin' && <span className="rounded bg-brand-100 px-1 text-[10px] text-brand-700 dark:bg-slate-800 dark:text-pink-300">Admin</span>}
                  {canEditGroup && p.user.id !== currentUser.id && (
                    <button type="button" disabled={busy} className="text-xs text-red-500" aria-label={`Remove ${p.user.username}`}
                      onClick={() => window.confirm(`Remove @${p.user.username} from the group?`) && run(async () => { await removeMemberApi(conv.id, p.user.id); await refetch() })}>Remove</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isGroup && (
          <button type="button" disabled={busy} className="btn-ghost w-full text-red-500"
            onClick={() => window.confirm('Leave this group?') && run(async () => { await removeMemberApi(conv.id, currentUser.id); removeConversation(conv.id); onClose(); nav('/chat') })}>Leave group</button>
        )}
      </div>
    </Modal>
  )
}
