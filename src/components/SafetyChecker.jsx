import { useState } from 'react'
import { aiSafetyApi } from '../api/aiApi.js'
import { getErrorMessage } from '../api/axios.js'

const SEVERITY = { none: 'Looks fine', low: 'Low concern', medium: 'Medium concern', high: 'High concern' }

export default function SafetyChecker() {
  const [text, setText] = useState('')
  const [mediaType, setMediaType] = useState('')
  const [filename, setFilename] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(''); setResult(null)
    if (!text.trim() && !filename.trim() && !mediaType) return setError('Add some text or file details to check.')
    const metadata = { ...(mediaType && { mediaType }), ...(filename.trim() && { filename: filename.trim() }) }
    setLoading(true)
    try { setResult(await aiSafetyApi({ ...(text.trim() && { text }), ...(Object.keys(metadata).length && { metadata }) })) } catch (err) { setError(getErrorMessage(err)) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} noValidate className="space-y-3">
        <div>
          <label htmlFor="safe-text" className="mb-1 block text-sm font-medium">Text to check</label>
          <textarea id="safe-text" rows="4" maxLength={5000} className="field" placeholder="Paste a caption, comment or message" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="safe-type" className="mb-1 block text-sm font-medium">Media type (optional)</label>
            <select id="safe-type" className="field" value={mediaType} onChange={(e) => setMediaType(e.target.value)}><option value="">None</option><option value="image">Image</option><option value="video">Video</option></select>
          </div>
          <div>
            <label htmlFor="safe-file" className="mb-1 block text-sm font-medium">File name (optional)</label>
            <input id="safe-file" className="field" maxLength={200} value={filename} onChange={(e) => setFilename(e.target.value)} />
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Checking...' : 'Check content'}</button>
      </form>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{error}</p>}
      {result && (
        <section aria-label="Safety result" className={`card space-y-1 p-4 ${result.flagged ? 'border-amber-400' : 'border-green-400'}`}>
          <p className="font-semibold">{result.flagged ? '⚠️ Might be unsafe' : '✅ No problems found'} <span className="text-sm font-normal text-slate-500">({SEVERITY[result.severity] || result.severity})</span></p>
          {result.categories.length > 0 && <p className="text-sm">Topics: {result.categories.join(', ').replaceAll('_', ' ')}</p>}
          {result.reason && <p className="text-sm">{result.reason}</p>}
          <p className="text-xs text-slate-500">
            {result.method === 'llm+rules' ? `Checked by AI${result.model ? ` (${result.model})` : ''} plus basic rules.` : 'Only basic rule checks ran: the AI model was not available. Treat this as a rough check.'}
          </p>
        </section>
      )}
    </div>
  )
}
