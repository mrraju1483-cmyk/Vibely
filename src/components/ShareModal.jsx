import { useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { sharePostApi } from '../api/postApi.js'

export default function ShareModal({ post, onClose, onShared, path = `/post/${post.id}`, share = sharePostApi }) {
  const url = `${window.location.origin}${path}`
  const [message, setMessage] = useState('')
  const counted = useRef(false)

  async function record() {
    if (counted.current) return
    counted.current = true
    try { onShared((await share(post.id)).sharesCount) } catch { /* the share itself still worked */ }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setMessage('Link copied!'); record() } catch { setMessage('Could not copy. Select the link and copy it manually.') }
  }
  async function nativeShare() {
    try { await navigator.share({ title: 'Vibely', text: post.caption.slice(0, 100), url }); record() } catch { /* cancelled */ }
  }

  return (
    <Modal title="Share post" onClose={onClose}>
      <div className="space-y-3">
        <label htmlFor="share-url" className="sr-only">Post link</label>
        <input id="share-url" readOnly className="field" value={url} onFocus={(e) => e.target.select()} />
        <div className="flex gap-2">
          <button type="button" className="btn-primary flex-1" onClick={copy}>Copy link</button>
          {typeof navigator.share === 'function' && <button type="button" className="btn-ghost flex-1" onClick={nativeShare}>Share via...</button>}
        </div>
        {message && <p role="status" className="text-sm text-brand-600">{message}</p>}
      </div>
    </Modal>
  )
}
