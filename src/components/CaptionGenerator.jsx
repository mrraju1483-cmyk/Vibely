import { useState } from 'react'
import { aiCaptionsApi } from '../api/aiApi.js'
import { getErrorMessage, getFieldErrors } from '../api/axios.js'

const TONES = [['fun', 'Fun'], ['casual', 'Casual'], ['witty', 'Witty'], ['inspiring', 'Inspiring'], ['professional', 'Professional']]

export default function CaptionGenerator() {
  const [form, setForm] = useState({ topic: '', tone: 'fun', count: 3, hashtags: true })
  const [captions, setCaptions] = useState([])
  const [model, setModel] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(-1)

  async function submit(e) {
    e.preventDefault()
    setError(''); setErrors({})
    if (!form.topic.trim()) return setErrors({ topic: 'Tell us what your post is about.' })
    setLoading(true)
    try {
      const d = await aiCaptionsApi({ ...form, count: Number(form.count) })
      setCaptions(d.captions); setModel(d.model || '')
    } catch (err) { setErrors(getFieldErrors(err)); setError(getErrorMessage(err)) } finally { setLoading(false) }
  }

  async function copy(text, i) {
    try { await navigator.clipboard.writeText(text); setCopied(i); setTimeout(() => setCopied(-1), 1500) } catch { setError('Could not copy. Select the text and copy it manually.') }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} noValidate className="space-y-3">
        <div>
          <label htmlFor="cap-topic" className="mb-1 block text-sm font-medium">What is your post about?</label>
          <textarea id="cap-topic" rows="2" maxLength={300} className="field" placeholder="Sunset at the beach with friends" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} aria-invalid={!!errors.topic} />
          {errors.topic && <p role="alert" className="mt-1 text-xs text-red-500">{errors.topic}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cap-tone" className="mb-1 block text-sm font-medium">Tone</label>
            <select id="cap-tone" className="field" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>{TONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
          <div>
            <label htmlFor="cap-count" className="mb-1 block text-sm font-medium">How many</label>
            <select id="cap-count" className="field" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.checked })} /> Include hashtags</label>
        <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? '✨ Writing captions...' : 'Generate captions'}</button>
      </form>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{error}</p>}
      {captions.length > 0 && (
        <section aria-label="Caption suggestions" className="space-y-2">
          <ul className="space-y-2">
            {captions.map((c, i) => (
              <li key={i} className="card flex items-start gap-2 p-3">
                <p className="min-w-0 flex-1 break-words text-sm">{c}</p>
                <button type="button" className="btn-ghost shrink-0 px-3 py-1" onClick={() => copy(c, i)}>{copied === i ? 'Copied!' : 'Copy'}</button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">Written by AI{model && ` (${model})`}. Check it before you post.</p>
        </section>
      )}
    </div>
  )
}
